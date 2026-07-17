// Script único: importa o export GDPR do TV Time e empurra diretamente para a
// Supabase, sem depender do IndexedDB do browser. Reaproveita o mesmo parser
// (tvtime/parser.ts) e a mesma lógica de deduplicação de órfãos que db.ts usa
// em importExport(), e o mesmo enriquecimento de metadados (metadata.ts).
//
// Uso:
//   SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/push-to-supabase.ts <pasta-gdpr> <email>
//
// A service_role key nunca é guardada em ficheiro — só existe na env var
// desta execução única, porque só um script de confiança (nunca o browser)
// pode ignorar o Row Level Security.
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { parseEmotions, parseTrackingV2 } from "../src/lib/tvtime/parser";
import { enrichShow } from "../src/lib/metadata";
import type { StoredShow, WatchedEpisode, StoredMovie } from "../src/lib/db";

const SUPABASE_URL = "https://xcqcciovhpddsqnpxtqf.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const [, , dirArg, emailArg] = process.argv;

if (!serviceKey) {
  console.error("Falta SUPABASE_SERVICE_ROLE_KEY na env.");
  process.exit(1);
}
if (!dirArg || !emailArg) {
  console.error("Uso: npx tsx scripts/push-to-supabase.ts <pasta-gdpr> <email>");
  process.exit(1);
}

const dir = path.resolve(dirArg);
const readCsv = (name: string) => {
  const p = path.join(dir, name);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
};

const trackingText = readCsv("tracking-prod-records-v2.csv");
if (!trackingText) {
  console.error(`Não encontrei tracking-prod-records-v2.csv em ${dir}`);
  process.exit(1);
}
const data = parseTrackingV2(trackingText);
const emotionsText = readCsv("episode_emotion.csv");
if (emotionsText) data.emotions = parseEmotions(emotionsText);

console.log(
  `Export lido: ${data.shows.length} séries, ${data.episodes.length} episódios, ${data.movies.length} filmes`,
);

// ── Mesma transformação de db.ts::importExport (dedup de órfãos) ──────────
const showUuids = new Set(data.shows.map((s) => s.uuid));
const followedByName = new Map<string, string>();
for (const show of data.shows) {
  if (!followedByName.has(show.name)) followedByName.set(show.name, show.uuid);
}

const shows: StoredShow[] = data.shows.map((show) => ({
  uuid: show.uuid,
  name: show.name,
  tvdbId: show.tvdbId,
  tmdbId: null,
  tvmazeId: null,
  posterPath: null,
  backdropPath: null,
  overview: null,
  totalEpisodes: null,
  followed: show.followed,
  inWatchlist: show.inWatchlist,
  archived: show.archived,
  addedAt: show.createdAt,
}));

const watchedMap = new Map<string, WatchedEpisode>();
for (const ep of data.episodes) {
  const showUuid = showUuids.has(ep.seriesUuid)
    ? ep.seriesUuid
    : (followedByName.get(ep.seriesName) ?? ep.seriesUuid);
  const id = `${showUuid}:${ep.season}:${ep.episode}`;
  watchedMap.set(id, {
    id,
    showUuid,
    season: ep.season,
    episode: ep.episode,
    watchedAt: ep.watchedAt,
    dateIsExact: ep.dateIsExact,
  });
}
const watched = [...watchedMap.values()];

const movies: StoredMovie[] = data.movies.map((m) => ({
  key: m.key,
  name: m.name,
  watchedAt: m.watchedAt,
  dateIsExact: m.dateIsExact,
}));

console.log(`Após dedup: ${shows.length} séries, ${watched.length} episódios, ${movies.length} filmes`);

// ── Enriquecimento (posters/sinopses) via TVmaze — mesma lógica da app ────
async function enrichAll() {
  let done = 0;
  for (const show of shows) {
    const patch = await enrichShow(show);
    if (patch) Object.assign(show, patch);
    done++;
    if (done % 20 === 0) console.log(`  enriquecidas ${done}/${shows.length}…`);
  }
  const withPoster = shows.filter((s) => s.posterPath).length;
  console.log(`Enriquecimento: ${withPoster}/${shows.length} séries com poster`);
}

// ── Envio para a Supabase (service_role — ignora RLS, só aqui) ────────────
async function push() {
  const admin = createClient(SUPABASE_URL, serviceKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Encontra ou cria o utilizador pelo email (sem password — login continua
  // a ser só por magic link, isto só garante que a conta existe)
  let userId: string | null = null;
  for (let page = 1; !userId; page++) {
    const { data: list, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = list.users.find((u) => u.email?.toLowerCase() === emailArg.toLowerCase());
    if (hit) userId = hit.id;
    if (list.users.length < 200) break;
  }
  if (!userId) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email: emailArg,
      email_confirm: true,
    });
    if (error) throw error;
    userId = created.user.id;
    console.log(`Conta criada para ${emailArg} (${userId})`);
  } else {
    console.log(`Conta existente encontrada: ${emailArg} (${userId})`);
  }

  const chunked = async (table: string, rows: Record<string, unknown>[]) => {
    const size = 500;
    for (let i = 0; i < rows.length; i += size) {
      const { error } = await admin.from(table).upsert(rows.slice(i, i + size));
      if (error) throw new Error(`${table}: ${error.message}`);
    }
  };

  await chunked(
    "shows",
    shows.map((s) => ({
      user_id: userId,
      uuid: s.uuid,
      name: s.name,
      tvdb_id: s.tvdbId,
      tmdb_id: s.tmdbId,
      tvmaze_id: s.tvmazeId ?? null,
      poster_path: s.posterPath,
      backdrop_path: s.backdropPath,
      overview: s.overview,
      total_episodes: s.totalEpisodes,
      first_aired: s.firstAired ?? null,
      status: s.status ?? null,
      genres: s.genres ?? null,
      imdb_id: s.imdbId ?? null,
      followed: s.followed,
      in_watchlist: s.inWatchlist,
      archived: s.archived,
      added_at: s.addedAt,
      updated_at: new Date().toISOString(),
    })),
  );
  await chunked(
    "watched_episodes",
    watched.map((w) => ({
      user_id: userId,
      show_uuid: w.showUuid,
      season: w.season,
      episode: w.episode,
      watched_at: w.watchedAt,
      date_is_exact: w.dateIsExact,
      updated_at: new Date().toISOString(),
    })),
  );
  await chunked(
    "watched_movies",
    movies.map((m) => ({
      user_id: userId,
      key: m.key,
      name: m.name,
      watched_at: m.watchedAt,
      date_is_exact: m.dateIsExact,
      updated_at: new Date().toISOString(),
    })),
  );

  console.log(
    `\n✓ Enviado: ${shows.length} séries, ${watched.length} episódios, ${movies.length} filmes para ${emailArg}`,
  );
}

async function main() {
  await enrichAll();
  await push();
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
