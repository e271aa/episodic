// Monta as secções do Explorar. Vive à parte da página para a lógica de
// "o que sugerir" ser testável e legível sem JSX pelo meio.
import {
  discoverByGenres,
  getGenreMap,
  getRecommendations,
  getTrending,
  type DiscoverItem,
} from "./tmdb";
import { buildTasteProfile, type TasteProfile } from "./taste";
import { isDismissed, loadDismissed } from "./dismissed";

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
    if (item.kind === "tv" && taste.knownShowTmdbIds.has(item.tmdbId)) continue;
    if (item.kind === "movie" && taste.knownMovieTmdbIds.has(item.tmdbId)) continue;
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

  return { sections, taste };
}
