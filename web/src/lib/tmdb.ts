// Cliente TMDB (lado do browser) — fala com o proxy /api/tmdb que guarda a chave.

export class TmdbKeyMissingError extends Error {
  constructor() {
    super("TMDB_API_KEY não configurada");
    this.name = "TmdbKeyMissingError";
  }
}

export interface TmdbShowLite {
  id: number;
  name: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  first_air_date?: string;
}

export interface TmdbSeasonSummary {
  season_number: number;
  episode_count: number;
  name: string;
  poster_path: string | null;
}

export interface TmdbShowDetails extends TmdbShowLite {
  number_of_episodes: number;
  number_of_seasons: number;
  seasons: TmdbSeasonSummary[];
  status: string;
  episode_run_time: number[];
  genres?: { id: number; name: string }[];
}

export interface TmdbEpisode {
  episode_number: number;
  season_number: number;
  name: string;
  overview: string;
  air_date: string | null;
  still_path: string | null;
  runtime: number | null;
}

async function tmdbGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const search = new URLSearchParams(params);
  const query = search.size ? `?${search}` : "";
  const response = await fetch(`/api/tmdb/${path}${query}`);
  if (response.status === 503) throw new TmdbKeyMissingError();
  if (!response.ok) throw new Error(`TMDB ${path}: HTTP ${response.status}`);
  return (await response.json()) as T;
}

/** Mapeia um ID TheTVDB (usado pelo TV Time) para a série no TMDB. */
export async function findShowByTvdbId(tvdbId: number): Promise<TmdbShowLite | null> {
  const result = await tmdbGet<{ tv_results: TmdbShowLite[] }>(`find/${tvdbId}`, {
    external_source: "tvdb_id",
  });
  return result.tv_results?.[0] ?? null;
}

export async function searchTv(query: string): Promise<TmdbShowLite[]> {
  const result = await tmdbGet<{ results: TmdbShowLite[] }>("search/tv", {
    query,
    include_adult: "false",
  });
  return result.results ?? [];
}

export async function getShowDetails(tmdbId: number): Promise<TmdbShowDetails> {
  return tmdbGet<TmdbShowDetails>(`tv/${tmdbId}`);
}

export interface TmdbMovieLite {
  id: number;
  title: string;
  poster_path: string | null;
  release_date?: string;
  overview: string;
}

/** Pesquisa de filmes; `year` (da estreia) desambigua remakes e homónimos. */
export async function searchMovie(
  query: string,
  year?: string,
): Promise<TmdbMovieLite[]> {
  const params: Record<string, string> = { query, include_adult: "false" };
  if (year) params.year = year;
  const result = await tmdbGet<{ results: TmdbMovieLite[] }>("search/movie", params);
  return result.results ?? [];
}

export interface TmdbMovieDetails extends TmdbMovieLite {
  backdrop_path: string | null;
  runtime: number | null;
  genres: { id: number; name: string }[];
  tagline: string;
}

/** Detalhe completo — pedido só quando se abre a página do filme (não em massa). */
export async function getMovieDetails(tmdbId: number): Promise<TmdbMovieDetails> {
  return tmdbGet<TmdbMovieDetails>(`movie/${tmdbId}`);
}

export async function getSeasonEpisodes(
  tmdbId: number,
  seasonNumber: number,
): Promise<TmdbEpisode[]> {
  const season = await tmdbGet<{ episodes: TmdbEpisode[] }>(
    `tv/${tmdbId}/season/${seasonNumber}`,
  );
  return season.episodes ?? [];
}

export interface StreamingProvider {
  id: number;
  name: string;
  logoPath: string | null;
}

export interface StreamingAvailability {
  /** por assinatura — o que interessa no dia a dia */
  streaming: StreamingProvider[];
  rent: StreamingProvider[];
  buy: StreamingProvider[];
  /** página da JustWatch com todos os detalhes — a TMDB pede para linkar para lá */
  link: string | null;
}

interface TmdbProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
}

interface TmdbWatchProviders {
  results?: Record<
    string,
    { link?: string; flatrate?: TmdbProvider[]; rent?: TmdbProvider[]; buy?: TmdbProvider[] }
  >;
}

const toProviders = (list?: TmdbProvider[]): StreamingProvider[] =>
  (list ?? []).map((p) => ({ id: p.provider_id, name: p.provider_name, logoPath: p.logo_path }));

/** Onde ver, em Portugal — TMDB agrega isto da JustWatch. */
export async function getStreamingAvailability(
  kind: "movie" | "tv",
  tmdbId: number,
): Promise<StreamingAvailability> {
  const data = await tmdbGet<TmdbWatchProviders>(`${kind}/${tmdbId}/watch/providers`);
  const pt = data.results?.PT;
  return {
    streaming: toProviders(pt?.flatrate),
    rent: toProviders(pt?.rent),
    buy: toProviders(pt?.buy),
    link: pt?.link ?? null,
  };
}

export function imageUrl(
  path: string | null | undefined,
  size: "w185" | "w342" | "w500" | "w780" | "original" = "w342",
): string | null {
  if (!path) return null;
  // URLs absolutos (ex.: imagens TVmaze) passam tal como estão
  if (path.startsWith("http")) return path;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}
