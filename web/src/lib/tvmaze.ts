// Cliente TVmaze — API pública gratuita, sem chave, com CORS aberto.
// Docs: https://www.tvmaze.com/api  (limite ~20 pedidos/10s → retry em 429)

const BASE = "https://api.tvmaze.com";

// O TheTVDB tem entradas duplicadas para algumas séries: o TV Time exportou
// um ID e a TVmaze indexou outro. Equivalências confirmadas manualmente
// (nome + nº de episódios batem certo).
const TVDB_TO_TVMAZE: Record<number, number> = {
  437487: 77573, // Formula 1 Academy → F1: The Academy
  337623: 33934, // A Place Further Than the Universe → Sora yori mo Tooi Basho
};

export interface TvmazeShow {
  id: number;
  name: string;
  premiered: string | null;
  status: string;
  genres: string[];
  summary: string | null; // vem em HTML
  image: { medium: string; original: string } | null;
  externals: { thetvdb: number | null; imdb: string | null };
}

export interface TvmazeEpisode {
  id: number;
  season: number;
  number: number | null; // null em especiais
  name: string;
  airdate: string;
  summary: string | null;
  runtime: number | null;
}

interface TvmazeSearchHit {
  score: number;
  show: TvmazeShow;
}

async function get<T>(path: string): Promise<T | null> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await fetch(`${BASE}${path}`);
    if (response.status === 429) {
      await new Promise((resolve) => setTimeout(resolve, 1200 * attempt));
      continue;
    }
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`TVmaze ${path}: HTTP ${response.status}`);
    return (await response.json()) as T;
  }
  throw new Error(`TVmaze ${path}: rate limit persistente`);
}

export function stripHtml(html: string | null): string | null {
  if (!html) return null;
  const text = html.replace(/<[^>]*>/g, "").trim();
  return text || null;
}

/** Encontra a série TVmaze a partir do ID TheTVDB (o que o TV Time usa). */
export async function lookupByTvdb(tvdbId: number): Promise<TvmazeShow | null> {
  const alias = TVDB_TO_TVMAZE[tvdbId];
  if (alias) return getShowById(alias);
  return get<TvmazeShow>(`/lookup/shows?thetvdb=${tvdbId}`);
}

export async function getShowById(tvmazeId: number): Promise<TvmazeShow | null> {
  return get<TvmazeShow>(`/shows/${tvmazeId}`);
}

export async function searchShows(query: string): Promise<TvmazeShow[]> {
  const hits = await get<TvmazeSearchHit[]>(
    `/search/shows?q=${encodeURIComponent(query)}`,
  );
  return (hits ?? []).map((hit) => hit.show);
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // acentos
    .replace(/^(the|a|an)\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Segunda tentativa quando não há correspondência pelo ID do TheTVDB — procura
 * por nome e só aceita se o título normalizado coincidir exatamente, para não
 * arriscar atribuir o poster de uma série errada.
 */
export async function findBestByName(name: string): Promise<TvmazeShow | null> {
  const hits = await get<TvmazeSearchHit[]>(
    `/search/shows?q=${encodeURIComponent(name)}`,
  );
  const target = normalizeName(name);
  const exact = (hits ?? []).find((hit) => normalizeName(hit.show.name) === target);
  return exact?.show ?? null;
}

// A lista completa de episódios de uma série muda raramente. Dois níveis de
// cache: memória (sessão) e IndexedDB (24h) — sem isto, cada visita à página
// Séries refazia um pedido por série seguida, com esperas de rate limit.
const episodesCache = new Map<number, TvmazeEpisode[]>();
const EPISODES_TTL_MS = 24 * 60 * 60 * 1000;

interface EpisodesCacheEntry {
  at: number;
  eps: TvmazeEpisode[];
}

// O IndexedDB só existe no browser; nos scripts Node fica só a cache de memória.
const hasIdb = typeof indexedDB !== "undefined";

export async function getEpisodes(tvmazeId: number): Promise<TvmazeEpisode[]> {
  const cached = episodesCache.get(tvmazeId);
  if (cached) return cached;

  if (hasIdb) {
    const { kvGet } = await import("./db");
    const stored = await kvGet<EpisodesCacheEntry>(`tvmaze-eps:${tvmazeId}`);
    if (stored && Date.now() - stored.at < EPISODES_TTL_MS) {
      episodesCache.set(tvmazeId, stored.eps);
      return stored.eps;
    }
  }

  const episodes =
    (await get<TvmazeEpisode[]>(`/shows/${tvmazeId}/episodes`)) ?? [];
  const regular = episodes.filter((ep) => ep.number !== null);
  episodesCache.set(tvmazeId, regular);
  if (hasIdb) {
    const { kvSet } = await import("./db");
    void kvSet(`tvmaze-eps:${tvmazeId}`, { at: Date.now(), eps: regular });
  }
  return regular;
}
