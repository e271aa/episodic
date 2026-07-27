// O teu perfil de gosto, calculado da biblioteca local. Nada disto sai do
// dispositivo: serve só para escolher o que pedir à TMDB no Explorar.
//
// Nota sobre géneros: a biblioteca guarda-os por NOME (vindos do fornecedor),
// mas a API de descoberta da TMDB filtra por ID. Por isso o mapa id→nome é
// invertido aqui para traduzir de volta.
import { getAllWatched, getMovies, getShows, type StoredShow } from "./db";

export interface TasteProfile {
  /** ids de género TMDB, do mais visto para o menos */
  topGenreIds: number[];
  /** nomes correspondentes, para dizer ao utilizador porque está a ver aquilo */
  topGenreNames: string[];
  /** séries com mais episódios vistos — a base do "porque viste X" */
  topShows: { uuid: string; name: string; tmdbId: number | null; watched: number }[];
  /** filmes vistos mais recentemente — a base do "porque viste X" em filmes.
   *  Sem contagem de episódios para pesar, a ordem possível é a de quando
   *  os viste. */
  topMovies: { key: string; name: string; tmdbId: number | null; watchedAt: string }[];
  /** tudo o que já está na biblioteca, para não sugerir o que já tens */
  knownShowTmdbIds: Set<number>;
  /** idem, para filmes — visto ou só na lista para ver, os dois já contam */
  knownMovieTmdbIds: Set<number>;
  /** true quando ainda não há histórico suficiente para personalizar */
  isEmpty: boolean;
}

export async function buildTasteProfile(
  genreNameToId: Map<string, number>,
): Promise<TasteProfile> {
  const [shows, watched, movies] = await Promise.all([getShows(), getAllWatched(), getMovies()]);

  const perShow = new Map<string, number>();
  for (const ep of watched) {
    perShow.set(ep.showUuid, (perShow.get(ep.showUuid) ?? 0) + 1);
  }

  // géneros pesados por episódios vistos — 60 episódios de comédia contam
  // mais que 1 de terror, que é o que "gosto" quer dizer na prática
  const genreWeight = new Map<string, number>();
  for (const show of shows) {
    const weight = perShow.get(show.uuid) ?? 0;
    if (weight === 0 || !show.genres) continue;
    for (const name of show.genres) {
      genreWeight.set(name, (genreWeight.get(name) ?? 0) + weight);
    }
  }

  const sortedGenres = [...genreWeight.entries()].sort((a, b) => b[1] - a[1]);
  const topGenreNames: string[] = [];
  const topGenreIds: number[] = [];
  for (const [name] of sortedGenres) {
    const id = genreNameToId.get(name);
    if (id === undefined) continue; // género que a TMDB não reconhece
    topGenreNames.push(name);
    topGenreIds.push(id);
    if (topGenreIds.length === 3) break;
  }

  const topShows = shows
    .map((s: StoredShow) => ({
      uuid: s.uuid,
      name: s.name,
      tmdbId: s.tmdbId,
      watched: perShow.get(s.uuid) ?? 0,
    }))
    .filter((s) => s.watched > 0 && s.tmdbId)
    .sort((a, b) => b.watched - a.watched)
    .slice(0, 5);

  const knownShowTmdbIds = new Set(
    shows.map((s) => s.tmdbId).filter((id): id is number => id !== null),
  );

  const topMovies = movies
    .filter((m) => m.watchedAt && m.tmdbId)
    .sort((a, b) => (b.watchedAt ?? "").localeCompare(a.watchedAt ?? ""))
    .slice(0, 5)
    .map((m) => ({ key: m.key, name: m.name, tmdbId: m.tmdbId ?? null, watchedAt: m.watchedAt! }));

  const knownMovieTmdbIds = new Set(
    movies.map((m) => m.tmdbId).filter((id): id is number => id !== null),
  );

  return {
    topGenreIds,
    topGenreNames,
    topShows,
    topMovies,
    knownShowTmdbIds,
    knownMovieTmdbIds,
    isEmpty: topGenreIds.length === 0 && topShows.length === 0 && topMovies.length === 0,
  };
}
