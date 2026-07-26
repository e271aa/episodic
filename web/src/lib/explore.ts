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
  limit = 20,
): DiscoverItem[] {
  const out: DiscoverItem[] = [];
  for (const item of items) {
    const key = `${item.kind}:${item.tmdbId}`;
    if (seen.has(key)) continue;
    if (isDismissed(dismissed, item.kind, item.tmdbId)) continue;
    if (item.kind === "tv" && taste.knownShowTmdbIds.has(item.tmdbId)) continue;
    if (!item.posterPath) continue; // sem capa não vale a pena mostrar
    seen.add(key);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
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
    getTrending(kind),
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

  // "Porque viste X" — só faz sentido para séries, que é onde a TMDB tem
  // recomendações fortes e onde o histórico do Ruben é profundo
  if (kind === "tv") {
    for (const show of taste.topShows.slice(0, 2)) {
      if (!show.tmdbId) continue;
      try {
        const recs = await getRecommendations("tv", show.tmdbId);
        const items = clean(recs, taste, dismissed, seen, 12);
        if (items.length >= 3) {
          sections.push({
            id: `porque-${show.tmdbId}`,
            title: `Porque viste ${show.name}`,
            items,
          });
        }
      } catch {
        // uma recomendação falhada não pode deitar abaixo o ecrã inteiro
      }
    }
  }

  // Mais do que gostas, por género
  if (taste.topGenreIds.length > 0) {
    try {
      const byGenre = await discoverByGenres(kind, taste.topGenreIds.slice(0, 2));
      const items = clean(byGenre, taste, dismissed, seen, 20);
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
