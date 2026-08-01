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

/**
 * Guarda a *promessa*, não o resultado. Com o enriquecimento a correr em
 * paralelo, os trabalhadores chegam aqui todos ao mesmo tempo e nenhum
 * encontrava a resposta ainda escrita — pediam `/api/tmdb/status` um por
 * cada, à mesma pergunta.
 */
let tmdbAvailable: Promise<boolean> | null = null;

export function hasTmdb(): Promise<boolean> {
  tmdbAvailable ??= (async () => {
    try {
      const response = await fetch("/api/tmdb/status");
      return response.ok && (await response.json()).available === true;
    } catch {
      return false;
    }
  })();
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

/** Minúsculas, sem acentos nem pontuação — "Your Name." e "your name" batem certo. */
function normTitle(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Abaixo disto o título exato é ruído, não um filme: o TMDB está cheio de
 * entradas com 0 votos e sem poster que roubariam o lugar ao filme verdadeiro.
 */
const MIN_VOTES_EXACT = 10;

const votesOf = (r: tmdb.TmdbMovieLite) => r.vote_count ?? 0;

function isExactTitle(r: tmdb.TmdbMovieLite, wanted: string): boolean {
  return (
    normTitle(r.title) === wanted ||
    (r.original_title ? normTitle(r.original_title) === wanted : false)
  );
}

/**
 * Escolhe o filme certo entre os resultados do TMDB.
 *
 * Ficar-se pelo `results[0]` dava filmes errados de duas maneiras diferentes,
 * ambas medidas contra a API:
 *
 *  - "Ciao Alberto" devolve dois filmes com o título EXATO: um obscuro de 2003
 *    (1 voto) e o spin-off do Luca de 2021 (707 votos). O TMDB devolve o de
 *    2003 primeiro — a ordem dele não é por notoriedade.
 *  - "Your Name" devolve "Chama-me Pelo Teu Nome" (Call Me by Your Name) em
 *    primeiro: só contém o título como pedaço, mas tem 12 840 votos.
 *
 * Regra: ganha o título exato mais votado; se nenhum exato passar o piso de
 * notoriedade, ganha o mais votado de todos.
 */
function pickBestMovie(
  results: tmdb.TmdbMovieLite[],
  name: string,
): tmdb.TmdbMovieLite | undefined {
  if (results.length === 0) return undefined;
  const wanted = normTitle(name);
  const exact = results.filter(
    (r) => isExactTitle(r, wanted) && votesOf(r) >= MIN_VOTES_EXACT,
  );
  const pool = exact.length > 0 ? exact : results;
  return pool.reduce((best, r) => (votesOf(r) > votesOf(best) ? r : best));
}

/**
 * Poster e id TMDB de um filme (a TVmaze não tem filmes — sem chave TMDB não
 * há enriquecimento). Pesquisa por nome + ano de estreia e escolhe o resultado
 * com `pickBestMovie`. Falhas lembradas por 24h como nas séries.
 *
 * `refresh` reescreve a estreia guardada em vez de a preservar — serve para
 * corrigir filmes que já foram enriquecidos com o filme errado, onde a data
 * guardada é ela própria o erro.
 */
export async function enrichMovie(
  movie: { key: string; name: string; releaseDate?: string | null },
  refresh = false,
): Promise<{ tmdbId: number; posterPath: string | null; releaseDate?: string | null } | null> {
  if (!(await hasTmdb())) return null;
  if (!refresh && (await enrichFailedRecently(`movie:${movie.key}`))) return null;
  try {
    const year = movie.releaseDate?.slice(0, 4);
    let results = await tmdb.searchMovie(movie.name, year);
    // ano de estreia TV Time por vezes difere um ano do TMDB — repete sem ano
    if (results.length === 0 && year) {
      results = await tmdb.searchMovie(movie.name);
    }
    let hit = pickBestMovie(results, movie.name);

    // O ano guardado pode ser ele próprio o erro: o "Ciao Alberto" tinha 2003
    // (o homónimo obscuro) e uma pesquisa presa a 2003 nunca encontraria o
    // spin-off do Luca. Quando o candidato do ano não é um título exato
    // conhecido, vale a pena ver o que aparece sem o ano — mas só se o que
    // aparecer for exato E notório, senão o resultado com ano manda. Isto
    // protege o caso inverso: "Your Name" só encontra o Kimi no Na wa com
    // year=2016, e sem ano viriam homónimos de 0 votos.
    const wanted = normTitle(movie.name);
    if (year && hit && !(isExactTitle(hit, wanted) && votesOf(hit) >= MIN_VOTES_EXACT)) {
      const semAno = pickBestMovie(await tmdb.searchMovie(movie.name), movie.name);
      if (semAno && isExactTitle(semAno, wanted) && votesOf(semAno) >= MIN_VOTES_EXACT) {
        hit = semAno;
      }
    }

    if (!hit) {
      await rememberEnrichFailure(`movie:${movie.key}`);
      return null;
    }
    return {
      tmdbId: hit.id,
      posterPath: hit.poster_path,
      // O TV Time nem sempre trazia a estreia — sem isto, o ano do filme
      // ficava preso ao dia em que o marcaste como visto, para sempre
      // (é o que fazia as décadas do filtro saírem todas erradas).
      ...(movie.releaseDate && !refresh ? null : { releaseDate: hit.release_date ?? null }),
    };
  } catch {
    return null;
  }
}

/** Lista de temporadas de uma série (null quando não há fornecedor mapeado). */
export async function getSeasons(show: StoredShow): Promise<MetaSeason[] | null> {
  try {
    if (show.tmdbId && (await hasTmdb())) {
      const details = await tmdb.getShowDetails(show.tmdbId);
      return details.seasons
        .filter((s) => s.season_number > 0)
        .sort((a, b) => a.season_number - b.season_number)
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
      // O nome usa a posição (1ª, 2ª…), não o número literal do fornecedor —
      // alguns animes longos são indexados por ano de emissão (2007, 2008…)
      // e "Temporada 2007" confundiria mais do que ajudaria
      return [...counts.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([number, episodeCount], i) => ({
          number,
          episodeCount,
          name: `Temporada ${i + 1}`,
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

export interface MetaMovieResult {
  tmdbId: number;
  name: string;
  year: string | null;
  posterPath: string | null;
  posterUrl: string | null;
  releaseDate: string | null;
  overview: string | null;
}

/**
 * Pesquisa de filmes para adicionar à biblioteca. Só TMDB — a TVmaze é de
 * televisão, não tem catálogo de cinema.
 */
export async function searchMovies(query: string): Promise<MetaMovieResult[]> {
  if (!(await hasTmdb())) return [];
  const results = await tmdb.searchMovie(query);
  return results.map((movie) => ({
    tmdbId: movie.id,
    name: movie.title,
    year: movie.release_date?.slice(0, 4) || null,
    posterPath: movie.poster_path,
    posterUrl: tmdb.imageUrl(movie.poster_path, "w185"),
    releaseDate: movie.release_date || null,
    overview: movie.overview || null,
  }));
}
