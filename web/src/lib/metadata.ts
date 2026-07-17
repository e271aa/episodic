// Camada unificada de metadados. Escolhe o fornecedor automaticamente:
//  - TMDB quando há chave configurada (posters HD, sinopses PT, filmes)
//  - TVmaze caso contrário (grátis, sem chave — o predefinido)
import type { StoredShow } from "./db";
import * as tmdb from "./tmdb";
import * as tvmaze from "./tvmaze";

export interface MetaSeason {
  number: number;
  episodeCount: number;
  name: string;
}

export interface MetaEpisode {
  season: number;
  episode: number;
  name: string;
  airDate: string | null;
}

export interface MetaSearchResult {
  provider: "tmdb" | "tvmaze";
  providerId: number;
  name: string;
  year: string | null;
  posterUrl: string | null;
  overview: string | null;
  backdropUrl: string | null;
}

let tmdbAvailable: boolean | null = null;

export async function hasTmdb(): Promise<boolean> {
  if (tmdbAvailable === null) {
    try {
      const response = await fetch("/api/tmdb/status");
      tmdbAvailable = response.ok && (await response.json()).available === true;
    } catch {
      tmdbAvailable = false;
    }
  }
  return tmdbAvailable;
}

// Séries que os fornecedores não têm (ex.: TVmaze sem "Road to 2002") não
// devem ser tentadas de novo a cada visita — no browser, guarda a última
// tentativa falhada e só repete passadas 24h.
const ENRICH_RETRY_MS = 24 * 60 * 60 * 1000;
const canRemember = typeof indexedDB !== "undefined";

async function enrichFailedRecently(uuid: string): Promise<boolean> {
  if (!canRemember) return false;
  const { kvGet } = await import("./db");
  const at = await kvGet<number>(`enrich-fail:${uuid}`);
  return at !== null && Date.now() - at < ENRICH_RETRY_MS;
}

async function rememberEnrichFailure(uuid: string): Promise<void> {
  if (!canRemember) return;
  const { kvSet } = await import("./db");
  await kvSet(`enrich-fail:${uuid}`, Date.now());
}

/**
 * Completa uma série da biblioteca com poster, sinopse e nº de episódios.
 * Devolve o patch a aplicar ao registo, ou null se não houver dados novos.
 */
export async function enrichShow(show: StoredShow): Promise<Partial<StoredShow> | null> {
  if (await enrichFailedRecently(show.uuid)) return null;
  try {
    // 1º TMDB (posters HD, pt-PT); a TVmaze entra como fallback total quando
    // a TMDB não tem a série, e como complemento quando lhe faltam campos
    // (sinopse sem tradução, poster em falta, link IMDb — que só a TVmaze dá).
    // O nome local mantém-se sempre — a TMDB devolve o nome original (ex.:
    // japonês) quando falta a tradução, e renomear séries só confunde.
    let fromTmdb: Partial<StoredShow> | null = null;
    if (await hasTmdb()) {
      let tmdbId = show.tmdbId;
      if (!tmdbId && show.tvdbId) {
        const hit = await tmdb.findShowByTvdbId(show.tvdbId);
        tmdbId = hit?.id ?? null;
      }
      if (tmdbId) {
        const details = await tmdb.getShowDetails(tmdbId);
        fromTmdb = {
          tmdbId,
          posterPath: details.poster_path,
          backdropPath: details.backdrop_path,
          overview: details.overview || null,
          totalEpisodes: details.number_of_episodes || null,
          firstAired: details.first_air_date || null,
          status: details.status || null,
          genres: details.genres?.map((g) => g.name) ?? null,
        };
      }
    }

    // TMDB completa (poster + sinopse + imdb já não é possível aqui)? Só vale
    // a pena consultar a TVmaze se faltar algo que ela possa preencher.
    const needsMaze =
      !fromTmdb || !fromTmdb.posterPath || !fromTmdb.overview || !show.imdbId;

    let fromMaze: Partial<StoredShow> | null = null;
    if (needsMaze) {
      let mazeShow =
        show.tvmazeId != null ? await tvmaze.getShowById(show.tvmazeId) : null;
      if (!mazeShow && show.tvdbId) {
        mazeShow = await tvmaze.lookupByTvdb(show.tvdbId);
      }
      // A TVmaze nem sempre indexa pelo ID do TheTVDB — tenta por nome antes
      // de desistir (só correspondência exata, para não trocar posters)
      if (!mazeShow) {
        mazeShow = await tvmaze.findBestByName(show.name);
      }
      if (mazeShow) {
        const episodes = await tvmaze.getEpisodes(mazeShow.id);
        fromMaze = {
          tvmazeId: mazeShow.id,
          posterPath: mazeShow.image?.original ?? mazeShow.image?.medium ?? null,
          backdropPath: mazeShow.image?.original ?? null,
          overview: tvmaze.stripHtml(mazeShow.summary),
          totalEpisodes: episodes.length || null,
          firstAired: mazeShow.premiered ?? null,
          status: mazeShow.status ?? null,
          genres: mazeShow.genres.length > 0 ? mazeShow.genres : null,
          imdbId: mazeShow.externals?.imdb ?? null,
        };
      }
    }

    if (!fromTmdb && !fromMaze) {
      await rememberEnrichFailure(show.uuid);
      return null;
    }
    if (!fromTmdb) return fromMaze;
    if (!fromMaze) return fromTmdb;

    // Fusão: TMDB manda; TVmaze preenche o que faltar
    return {
      ...fromTmdb,
      posterPath: fromTmdb.posterPath ?? fromMaze.posterPath,
      backdropPath: fromTmdb.backdropPath ?? fromMaze.backdropPath,
      overview: fromTmdb.overview ?? fromMaze.overview,
      totalEpisodes: fromTmdb.totalEpisodes ?? fromMaze.totalEpisodes,
      firstAired: fromTmdb.firstAired ?? fromMaze.firstAired,
      status: fromTmdb.status ?? fromMaze.status,
      genres: fromTmdb.genres ?? fromMaze.genres,
      tvmazeId: fromMaze.tvmazeId,
      imdbId: fromMaze.imdbId,
    };
  } catch {
    return null; // rede em baixo ou série não encontrada — fica para a próxima
  }
}

/** Lista de temporadas de uma série (null quando não há fornecedor mapeado). */
export async function getSeasons(show: StoredShow): Promise<MetaSeason[] | null> {
  try {
    if (show.tmdbId && (await hasTmdb())) {
      const details = await tmdb.getShowDetails(show.tmdbId);
      return details.seasons
        .filter((s) => s.season_number > 0)
        .map((s) => ({
          number: s.season_number,
          episodeCount: s.episode_count,
          name: s.name,
        }));
    }
    if (show.tvmazeId != null) {
      const episodes = await tvmaze.getEpisodes(show.tvmazeId);
      const counts = new Map<number, number>();
      for (const ep of episodes) {
        counts.set(ep.season, (counts.get(ep.season) ?? 0) + 1);
      }
      return [...counts.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([number, episodeCount]) => ({
          number,
          episodeCount,
          name: `Temporada ${number}`,
        }));
    }
    return null;
  } catch {
    return null;
  }
}

/** Episódios de uma temporada, com nome e data de estreia. */
export async function getEpisodesOfSeason(
  show: StoredShow,
  seasonNumber: number,
): Promise<MetaEpisode[]> {
  try {
    if (show.tmdbId && (await hasTmdb())) {
      const episodes = await tmdb.getSeasonEpisodes(show.tmdbId, seasonNumber);
      return episodes.map((ep) => ({
        season: ep.season_number,
        episode: ep.episode_number,
        name: ep.name,
        airDate: ep.air_date,
      }));
    }
    if (show.tvmazeId != null) {
      const episodes = await tvmaze.getEpisodes(show.tvmazeId);
      return episodes
        .filter((ep) => ep.season === seasonNumber && ep.number !== null)
        .map((ep) => ({
          season: ep.season,
          episode: ep.number as number,
          name: ep.name,
          airDate: ep.airdate || null,
        }));
    }
    return [];
  } catch {
    return [];
  }
}

/** Pesquisa de séries para o Explorar — TMDB primeiro, TVmaze quando não há resultados. */
export async function searchShows(query: string): Promise<MetaSearchResult[]> {
  if (await hasTmdb()) {
    const results = await tmdb.searchTv(query);
    if (results.length > 0) {
      return results.map((show) => ({
        provider: "tmdb" as const,
        providerId: show.id,
        name: show.name,
        year: show.first_air_date?.slice(0, 4) ?? null,
        posterUrl: tmdb.imageUrl(show.poster_path, "w185"),
        backdropUrl: tmdb.imageUrl(show.backdrop_path, "w780"),
        overview: show.overview || null,
      }));
    }
    // sem resultados na TMDB — cai para a TVmaze em vez de mostrar vazio
  }
  const results = await tvmaze.searchShows(query);
  return results.map((show) => ({
    provider: "tvmaze" as const,
    providerId: show.id,
    name: show.name,
    year: show.premiered?.slice(0, 4) ?? null,
    posterUrl: show.image?.medium ?? null,
    backdropUrl: show.image?.original ?? null,
    overview: tvmaze.stripHtml(show.summary),
  }));
}
