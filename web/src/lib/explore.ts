// Monta as secções do Explorar. Vive à parte da página para a lógica de
// "o que sugerir" ser testável e legível sem JSX pelo meio.
import {
  discoverByGenres,
  getGenreMap,
  getRecommendations,
  getTmdbList,
  getTrending,
  type DiscoverItem,
  type TmdbList,
} from "./tmdb";
import { buildTasteProfile, type TasteProfile } from "./taste";
import { isDismissed, loadDismissed } from "./dismissed";
import { normalizeTitle } from "./names";

export interface ExploreSection {
  id: string;
  title: string;
  /** o "porquê" desta secção — dito ao utilizador, não escondido */
  reason?: string;
  items: DiscoverItem[];
}

export interface ExploreData {
  sections: ExploreSection[];
  taste: TasteProfile;
}

/**
 * Já está na biblioteca?
 *
 * Por id TMDB E por nome normalizado. Só por id não chegava: a esmagadora
 * maioria da biblioteca veio do TV Time e foi enriquecida pela TVmaze, ficando
 * com `tmdbId` a null — e por isso o Explorar sugeria (e deixava adicionar
 * outra vez) séries que já lá estavam, como o Arrow e o Prison Break.
 */
export function alreadyInLibrary(item: DiscoverItem, taste: TasteProfile): boolean {
  const nome = normalizeTitle(item.name);
  return item.kind === "tv"
    ? taste.knownShowTmdbIds.has(item.tmdbId) || taste.knownShowNames.has(nome)
    : taste.knownMovieTmdbIds.has(item.tmdbId) || taste.knownMovieNames.has(nome);
}

/** Remove o que já tens e o que dispensaste, e corta duplicados entre secções. */
function clean(
  items: DiscoverItem[],
  taste: TasteProfile,
  dismissed: Set<string>,
  seen: Set<string>,
  limit = 24,
): DiscoverItem[] {
  const out: DiscoverItem[] = [];
  for (const item of items) {
    const key = `${item.kind}:${item.tmdbId}`;
    if (seen.has(key)) continue;
    if (isDismissed(dismissed, item.kind, item.tmdbId)) continue;
    if (alreadyInLibrary(item, taste)) continue;
    if (!item.posterPath) continue; // sem capa não vale a pena mostrar
    seen.add(key);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

/** Duas páginas em vez de uma — filtrar o que já se tem e o que se dispensou
 *  come itens a sério, e uma página só (20 em bruto) esvaziava depressa a
 *  secção de filmes, que não tinha "porque viste X" nenhum a compensar. */
async function trendingPages(kind: "tv" | "movie"): Promise<DiscoverItem[]> {
  const [p1, p2] = await Promise.all([getTrending(kind, 1), getTrending(kind, 2)]);
  return [...p1, ...p2];
}

async function generoPages(kind: "tv" | "movie", genreIds: number[]): Promise<DiscoverItem[]> {
  const [p1, p2] = await Promise.all([
    discoverByGenres(kind, genreIds, 1),
    discoverByGenres(kind, genreIds, 2),
  ]);
  return [...p1, ...p2];
}

/**
 * As listas prontas da TMDB, a seguir ao que é personalizado. Antes o
 * Explorar vivia só de tendências e do gosto calculado — quem não tem
 * histórico via meia dúzia de títulos, e quem tem esgotava-os depressa.
 *
 * Cada uma é um eixo diferente de "vale a pena ver": a nota de sempre, o
 * que toda a gente está a ver agora, e o que está mesmo a sair.
 */
const LISTAS: Record<"tv" | "movie", { id: string; title: string; list: TmdbList }[]> = {
  movie: [
    { id: "melhores", title: "Melhores de sempre", list: "top_rated" },
    { id: "populares", title: "Populares agora", list: "popular" },
    { id: "cinemas", title: "Nos cinemas", list: "now_playing" },
    { id: "estreias", title: "A estrear", list: "upcoming" },
  ],
  tv: [
    { id: "melhores", title: "Melhores de sempre", list: "top_rated" },
    { id: "populares", title: "Populares agora", list: "popular" },
    { id: "no-ar", title: "A dar agora", list: "on_the_air" },
  ],
};

/**
 * As secções do Explorar, para o tipo escolhido (séries ou filmes).
 *
 * Sem histórico, mostra só tendências — nunca uma página vazia à espera de
 * dados que não existem.
 */
export async function loadExplore(kind: "tv" | "movie"): Promise<ExploreData> {
  const genreMap = await getGenreMap(kind);
  const nameToId = new Map([...genreMap].map(([id, name]) => [name, id]));

  const [taste, dismissed, trending] = await Promise.all([
    buildTasteProfile(nameToId),
    loadDismissed(),
    trendingPages(kind),
  ]);

  const seen = new Set<string>();
  const sections: ExploreSection[] = [];

  const trendingItems = clean(trending, taste, dismissed, seen);
  if (trendingItems.length > 0) {
    sections.push({
      id: "tendencias",
      title: "Em alta esta semana",
      items: trendingItems,
    });
  }

  // "Porque viste X" — a TMDB dá recomendações fortes a partir de um título
  // concreto, tanto para séries como para filmes. Para séries pesa-se pelos
  // episódios vistos; um filme não tem "quantidade", por isso usam-se os
  // vistos mais recentemente.
  const baseTitles =
    kind === "tv"
      ? taste.topShows.slice(0, 2).map((s) => ({ id: s.tmdbId, name: s.name, key: s.uuid }))
      : taste.topMovies.slice(0, 2).map((m) => ({ id: m.tmdbId, name: m.name, key: m.key }));

  for (const title of baseTitles) {
    if (!title.id) continue;
    try {
      const recs = await getRecommendations(kind, title.id);
      const items = clean(recs, taste, dismissed, seen, 12);
      if (items.length >= 3) {
        sections.push({
          id: `porque-${title.id}`,
          title: `Porque viste ${title.name}`,
          items,
        });
      }
    } catch {
      // uma recomendação falhada não pode deitar abaixo o ecrã inteiro
    }
  }

  // Mais do que gostas, por género — a pesagem de géneros vem só das séries
  // (é onde a biblioteca guarda o género de cada título); para filmes isto
  // continua a assumir que o gosto se sobrepõe, o que é uma aproximação, não
  // um cálculo feito a sério a partir dos filmes vistos.
  if (taste.topGenreIds.length > 0) {
    try {
      const byGenre = await generoPages(kind, taste.topGenreIds.slice(0, 2));
      const items = clean(byGenre, taste, dismissed, seen, 24);
      if (items.length > 0) {
        sections.push({
          id: "generos",
          title: "Mais do que costumas ver",
          reason: taste.topGenreNames.slice(0, 2).join(" · "),
          items,
        });
      }
    } catch {
      // idem
    }
  }

  // As listas prontas vão todas ao mesmo tempo — são independentes umas das
  // outras e esperar por elas em fila somava meio segundo por secção.
  const listas = LISTAS[kind];
  const resultados = await Promise.all(
    listas.map((l) => getTmdbList(kind, l.list).catch(() => [] as DiscoverItem[])),
  );
  for (const [i, itens] of resultados.entries()) {
    // O `clean` corta o que já apareceu acima, por isso a ordem aqui importa:
    // o que é personalizado fica no topo e estas completam o resto.
    const items = clean(itens, taste, dismissed, seen, 20);
    if (items.length >= 3) {
      sections.push({ id: listas[i].id, title: listas[i].title, items });
    }
  }

  return { sections, taste };
}
