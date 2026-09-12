import Papa from "papaparse";
import type {
  TvTimeEmotion,
  TvTimeEpisodeWatch,
  TvTimeExport,
  TvTimeMovieWatch,
  TvTimeShow,
  TvTimeStats,
} from "./types";

type Row = Record<string, string>;

function parseCsv(text: string): Row[] {
  const result = Papa.parse<Row>(text.trim(), {
    header: true,
    skipEmptyLines: true,
  });
  return result.data;
}

function toBool(value: string | undefined): boolean {
  return value === "true" || value === "1";
}

function toNum(value: string | undefined): number | null {
  if (value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// created_at/updated_at vêm como "2015-04-18 08:51:27" sem timezone; o backend
// do TV Time guardava em UTC.
function sqlDateToIso(value: string): string {
  const d = new Date(value.replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime()) ? value : d.toISOString();
}

// Nos check-ins feitos em tempo real, a coluna `gsi` traz o momento exato do
// visto como "watch-episode-<unix-seconds>" (ou watch-movie-). Nos registos em
// massa vem vazia e só temos a data de criação da linha.
function resolveWatchDate(
  gsi: string | undefined,
  createdAt: string,
): { watchedAt: string; dateIsExact: boolean } {
  const match = gsi?.match(/^watch-(?:episode|movie)-(\d{9,13})$/);
  if (match) {
    let ts = Number(match[1]);
    if (ts < 1e11) ts *= 1000; // segundos → milissegundos
    return { watchedAt: new Date(ts).toISOString(), dateIsExact: true };
  }
  return { watchedAt: sqlDateToIso(createdAt), dateIsExact: false };
}

// Reduz uma `key` ao seu prefixo lógico, removendo os UUIDs,
// ex.: "watch-episode-200a6f37-...-f7cbcacd-..." → "watch-episode"
function keyPrefix(key: string): string {
  const uuidStart = key.search(/-[0-9a-f]{8}-[0-9a-f]{4}/);
  return uuidStart > 0 ? key.slice(0, uuidStart) : key;
}

/**
 * Interpreta o ficheiro central do export GDPR: tracking-prod-records-v2.csv.
 * Cada linha é identificada pela coluna `key`:
 *  - "tracking-stats"      → totais agregados da conta
 *  - "user-series-<uuid>"  → série seguida / na watchlist (s_id = ID TheTVDB)
 *  - "watch-episode-<...>" → um episódio visto
 *  - linhas com movie_name → um filme visto
 */
export function parseTrackingV2(csvText: string): TvTimeExport {
  const rows = parseCsv(csvText);

  const stats: TvTimeStats = {
    epWatchCount: null,
    movieWatchCount: null,
    totalSeriesRuntimeSec: null,
    totalMoviesRuntimeSec: null,
  };
  const shows: TvTimeShow[] = [];
  const episodes: TvTimeEpisodeWatch[] = [];
  const movies: TvTimeMovieWatch[] = [];
  const unknownKeys: Record<string, number> = {};

  // uuid da série → tvdbId/nome, para enriquecer episódios cujo s_id vem vazio
  const seriesByUuid = new Map<string, { tvdbId: number | null; name: string }>();

  for (const row of rows) {
    const key = row.key ?? "";

    if (key === "tracking-stats") {
      stats.epWatchCount = toNum(row.ep_watch_count);
      stats.movieWatchCount = toNum(row.movie_watch_count);
      stats.totalSeriesRuntimeSec = toNum(row.total_series_runtime);
      stats.totalMoviesRuntimeSec = toNum(row.total_movies_runtime);
      continue;
    }

    if (key.startsWith("user-series-")) {
      const uuid = row.uuid || key.slice("user-series-".length);
      const show: TvTimeShow = {
        uuid,
        tvdbId: toNum(row.s_id),
        name: row.series_name || "",
        followed: toBool(row.is_followed),
        inWatchlist: toBool(row.is_for_later),
        archived: toBool(row.is_archived),
        createdAt: sqlDateToIso(row.created_at ?? ""),
      };
      shows.push(show);
      seriesByUuid.set(uuid, { tvdbId: show.tvdbId, name: show.name });
      continue;
    }

    // "watch-episode-<uuid>…" e "rewatch-episode-<uuid>…" partilham a mesma
    // estrutura; uma revisão marca o mesmo episódio (deduplicado no import).
    const epPrefix = key.startsWith("watch-episode-")
      ? "watch-episode-"
      : key.startsWith("rewatch-episode-")
        ? "rewatch-episode-"
        : null;
    if (epPrefix) {
      const seriesUuid = key.slice(epPrefix.length, epPrefix.length + 36);
      const known = seriesByUuid.get(seriesUuid);
      const { watchedAt, dateIsExact } = resolveWatchDate(row.gsi, row.created_at ?? "");
      episodes.push({
        seriesUuid,
        seriesTvdbId: toNum(row.s_id) ?? known?.tvdbId ?? null,
        seriesName: row.series_name || known?.name || "",
        season: toNum(row.s_no) ?? toNum(row.season_number) ?? 0,
        episode: toNum(row.ep_no) ?? toNum(row.episode_number) ?? 0,
        episodeTvdbId: toNum(row.ep_id),
        rewatchCount: toNum(row.rewatch_count) ?? 0,
        watchedAt,
        dateIsExact,
      });
      continue;
    }

    if (row.movie_name) {
      const { watchedAt, dateIsExact } = resolveWatchDate(row.gsi, row.created_at ?? "");
      movies.push({ key, name: row.movie_name, watchedAt, dateIsExact });
      continue;
    }

    if (key) {
      const prefix = keyPrefix(key);
      unknownKeys[prefix] = (unknownKeys[prefix] ?? 0) + 1;
    }
  }

  return { stats, shows, episodes, movies, emotions: [], unknownKeys };
}

/**
 * Interpreta o ficheiro v1 (tracking-prod-records.csv) — só para FILMES.
 * As séries/episódios vivem no v2; os filmes só existem aqui, como linhas
 * `type=watch` + `entity_type=movie`, com nome, data e estreia.
 */
export function parseTrackingV1Movies(csvText: string): TvTimeMovieWatch[] {
  const vistos: TvTimeMovieWatch[] = [];
  const paraVer: TvTimeMovieWatch[] = [];
  for (const row of parseCsv(csvText)) {
    if (row.entity_type !== "movie") continue;
    if (!row.movie_name || !row.uuid) continue;

    if (row.type === "watch") {
      const when = row.watch_date || row.created_at || "";
      vistos.push({
        key: row.uuid,
        name: row.movie_name,
        watchedAt: sqlDateToIso(when),
        dateIsExact: Boolean(when),
        releaseDate: row.release_date ? row.release_date.slice(0, 10) : null,
      });
      continue;
    }

    /**
     * `towatch` = marcado "para ver" no TV Time, e a app tem exatamente esse
     * conceito para filmes desde a Fase L. Só se lia `type=watch`, e estes
     * caíam no chão — medido no export do Ruben: **22 linhas, 21 de filmes
     * que ele nunca viu**. Vinte e um filmes que ele escolheu a dizer "quero
     * ver isto", perdidos na única importação que a app faz.
     */
    if (row.type === "towatch") {
      paraVer.push({
        key: row.uuid,
        name: row.movie_name,
        watchedAt: null,
        dateIsExact: false,
        releaseDate: row.release_date ? row.release_date.slice(0, 10) : null,
      });
    }
  }

  // Um filme que entretanto foi visto não volta para "para ver" — o registo
  // `towatch` fica lá no export, mas já não é a verdade sobre ele.
  const nomesVistos = new Set(vistos.map((m) => m.name));
  return [...vistos, ...paraVer.filter((m) => !nomesVistos.has(m.name))];
}

/** Funde listas de filmes sem duplicar (a chave é o uuid do TV Time). */
export function mergeMovieLists(
  ...lists: TvTimeMovieWatch[][]
): TvTimeMovieWatch[] {
  const byKey = new Map<string, TvTimeMovieWatch>();
  for (const list of lists) {
    for (const movie of list) {
      if (!byKey.has(movie.key)) byKey.set(movie.key, movie);
    }
  }
  return [...byKey.values()];
}

/** Interpreta episode_emotion.csv (reações por episódio; emotion_id 1 = gostei). */
export function parseEmotions(csvText: string): TvTimeEmotion[] {
  return parseCsv(csvText).map((row) => ({
    seriesName: row.tv_show_name || "",
    season: toNum(row.episode_season_number),
    episode: toNum(row.episode_number),
    episodeTvdbId: toNum(row.episode_id),
    emotionId: toNum(row.emotion_id) ?? 0,
    createdAt: sqlDateToIso(row.created_at ?? ""),
  }));
}
