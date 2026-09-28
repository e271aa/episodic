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
  /** título na língua original — guardado como alias, ver StoredShow.tmdbAliases */
  original_name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  first_air_date?: string;
  /** só vem preenchido em resultados de pesquisa — usado para desempatar
   *  homónimos, como o `pickBestMovie` já faz para filmes */
  vote_count?: number;
}

export interface TmdbSeasonSummary {
  season_number: number;
  episode_count: number;
  name: string;
  poster_path: string | null;
}

export interface TmdbShowDetails extends TmdbShowLite {
  /** conta também os episódios anunciados — ver `lib/estreados.ts` */
  number_of_episodes: number;
  /** o último episódio já emitido; `null` se ainda não estreou nada */
  last_episode_to_air?: {
    season_number: number;
    episode_number: number;
    air_date: string | null;
    runtime?: number | null;
  } | null;
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
  /** título na língua original — o pt-PT do TMDB nem sempre bate com o do TV Time */
  original_title?: string;
  poster_path: string | null;
  release_date?: string;
  overview: string;
  /** quantos votos tem — o sinal mais fiável de "é este o filme conhecido" */
  vote_count?: number;
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

// ── Descoberta (Explorar) ──────────────────────────────────────

/** Um resultado do Explorar, já normalizado — série e filme lado a lado. */
export interface DiscoverItem {
  kind: "tv" | "movie";
  tmdbId: number;
  name: string;
  /**
   * Título na língua original. A TMDB responde em pt-PT, e a biblioteca do
   * Ruben guarda os nomes como o TV Time os exportou (quase sempre em
   * inglês): o "Prison Break" que ele tem é o "Prison Break: Fuga da Prisão"
   * da TMDB. Sem isto, comparar títulos falha exatamente nas séries que ele
   * já tem — que são as que não deviam aparecer.
   */
  originalName: string | null;
  year: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string | null;
  genreIds: number[];
  /** 0–10 da TMDB; serve para desempatar, não para mostrar em destaque */
  rating: number;
}

interface TmdbDiscoverRow {
  id: number;
  name?: string; // séries
  title?: string; // filmes
  original_name?: string; // séries, na língua original
  original_title?: string; // filmes, idem
  first_air_date?: string;
  release_date?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  genre_ids?: number[];
  vote_average?: number;
}

function toDiscoverItem(row: TmdbDiscoverRow, kind: "tv" | "movie"): DiscoverItem {
  const date = kind === "tv" ? row.first_air_date : row.release_date;
  const original = kind === "tv" ? row.original_name : row.original_title;
  return {
    kind,
    tmdbId: row.id,
    name: (kind === "tv" ? row.name : row.title) ?? "",
    originalName: original || null,
    year: date ? date.slice(0, 4) : null,
    posterPath: row.poster_path,
    backdropPath: row.backdrop_path,
    overview: row.overview || null,
    genreIds: row.genre_ids ?? [],
    rating: row.vote_average ?? 0,
  };
}

/** O que está a dar esta semana. */
export async function getTrending(kind: "tv" | "movie", page = 1): Promise<DiscoverItem[]> {
  const data = await tmdbGet<{ results: TmdbDiscoverRow[] }>(`trending/${kind}/week`, {
    page: String(page),
  });
  return (data.results ?? []).map((r) => toDiscoverItem(r, kind));
}

/** "Porque viste X" — a TMDB calcula isto a partir de um título concreto. */
export async function getRecommendations(
  kind: "tv" | "movie",
  tmdbId: number,
): Promise<DiscoverItem[]> {
  const data = await tmdbGet<{ results: TmdbDiscoverRow[] }>(
    `${kind}/${tmdbId}/recommendations`,
  );
  return (data.results ?? []).map((r) => toDiscoverItem(r, kind));
}

/** Catálogo filtrado por género — a base do "mais do que gostas". */
export async function discoverByGenres(
  kind: "tv" | "movie",
  genreIds: number[],
  page = 1,
): Promise<DiscoverItem[]> {
  const data = await tmdbGet<{ results: TmdbDiscoverRow[] }>(`discover/${kind}`, {
    with_genres: genreIds.join(","),
    sort_by: "popularity.desc",
    // corta o ruído: títulos sem votos suficientes são quase sempre lixo
    "vote_count.gte": "200",
    page: String(page),
  });
  return (data.results ?? []).map((r) => toDiscoverItem(r, kind));
}

/** Listas prontas da TMDB. `top_rated` é o equivalente ao "top IMDb":
 *  ordenado por nota com um mínimo de votos, calculado do lado deles. */
export type TmdbList =
  | "top_rated"
  | "popular"
  | "now_playing" // só filmes
  | "upcoming" // só filmes
  | "on_the_air" // só séries
  | "airing_today"; // só séries

export async function getTmdbList(
  kind: "tv" | "movie",
  list: TmdbList,
  page = 1,
): Promise<DiscoverItem[]> {
  const data = await tmdbGet<{ results: TmdbDiscoverRow[] }>(`${kind}/${list}`, {
    page: String(page),
  });
  return (data.results ?? []).map((r) => toDiscoverItem(r, kind));
}

/** Pesquisa por título no catálogo TMDB — não fica presa ao que já foi
 *  sugerido, procura em tudo. Mesma forma de linha que trending/discover,
 *  por isso reaproveita o mesmo mapeamento. */
export async function searchDiscover(
  kind: "tv" | "movie",
  query: string,
): Promise<DiscoverItem[]> {
  const data = await tmdbGet<{ results: TmdbDiscoverRow[] }>(`search/${kind}`, {
    query,
    include_adult: "false",
  });
  return (data.results ?? []).map((r) => toDiscoverItem(r, kind));
}

/**
 * Séries e filmes na mesma pesquisa, ordenados por popularidade real da
 * TMDB — não uma ordenação inventada a juntar dois pedidos separados. A
 * pesquisa do Explorar usa sempre isto: procurar não devia depender de
 * saber de antemão se a coisa é série ou filme.
 */
export async function searchMulti(query: string): Promise<DiscoverItem[]> {
  const data = await tmdbGet<{ results: (TmdbDiscoverRow & { media_type?: string })[] }>(
    "search/multi",
    { query, include_adult: "false" },
  );
  return (data.results ?? [])
    .filter((r): r is TmdbDiscoverRow & { media_type: "tv" | "movie" } =>
      r.media_type === "tv" || r.media_type === "movie",
    )
    .map((r) => toDiscoverItem(r, r.media_type));
}

/** Mapa id→nome dos géneros, para traduzir os `genre_ids` dos resultados. */
export async function getGenreMap(kind: "tv" | "movie"): Promise<Map<number, string>> {
  const data = await tmdbGet<{ genres: { id: number; name: string }[] }>(
    `genre/${kind}/list`,
  );
  return new Map((data.genres ?? []).map((g) => [g.id, g.name]));
}

// ── Elenco (personagem favorita do perfil) ─────────────────────

export interface CastMember {
  /** id da PESSOA na TMDB — o mesmo ator noutra série tem o mesmo id */
  personId: number;
  actorName: string;
  character: string;
  profilePath: string | null;
}

interface TmdbAggregateCast {
  id: number;
  name: string;
  profile_path: string | null;
  roles?: { character: string; episode_count: number }[];
  total_episode_count?: number;
}

/**
 * Elenco de uma série, do papel mais presente para o menos. Usa
 * `aggregate_credits` e não `credits`: numa série longa, o `credits` normal
 * devolve só a ficha do primeiro episódio, e ficariam de fora personagens
 * que entraram depois.
 */
export async function getSeriesCast(tmdbId: number): Promise<CastMember[]> {
  const data = await tmdbGet<{ cast: TmdbAggregateCast[] }>(
    `tv/${tmdbId}/aggregate_credits`,
  );
  return (data.cast ?? [])
    .map((c) => ({
      personId: c.id,
      actorName: c.name,
      character: c.roles?.[0]?.character ?? "",
      profilePath: c.profile_path,
      episodes: c.total_episode_count ?? 0,
    }))
    .filter((c) => c.character)
    .sort((a, b) => b.episodes - a.episodes)
    .map(({ personId, actorName, character, profilePath }) => ({
      personId,
      actorName,
      character,
      profilePath,
    }));
}
