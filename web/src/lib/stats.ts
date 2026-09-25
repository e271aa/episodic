// Estatísticas do perfil, calculadas a partir do armazém local. O perfil é o
// "cartão de estação" do utilizador: tempo de antena, o seu espetro de géneros
// (as barras SMPTE, mas construídas com os dados reais dele) e a série-farol.
import { getAllWatched, getImportMeta, getMovies, getShows } from "./db";

export interface GenreSlice {
  name: string;
  count: number;
  pct: number;
  color: string;
}

export interface YearBar {
  year: number;
  count: number;
}

export interface TopShow {
  uuid: string;
  name: string;
  posterPath: string | null;
  count: number;
}

export interface ProfileStats {
  shows: number;
  following: number;
  episodes: number;
  movies: number;
  hours: number | null;
  importedAt: string | null;
  firstYear: number | null;
  topShow: TopShow | null;
  genres: GenreSlice[];
  perYear: YearBar[];
}

// Cores das barras SMPTE, reordenadas para os géneros mais vistos ficarem com
// as cores mais vivas; o cinzento fica para "Outros".
const SPECTRUM = ["#e6483c", "#e6c832", "#37c837", "#3fd2c8", "#3c46e6", "#d24bd2"];
const OUTROS_COLOR = "#c8c8c8";

// Nomes de género dos fornecedores muitas vezes vêm em inglês (sobretudo
// TVmaze) — traduz para pt-PT e assim fundem-se com os que já vêm traduzidos.
const GENRE_PT: Record<string, string> = {
  "Action & Adventure": "Ação & Aventura",
  "Sci-Fi & Fantasy": "Ficção & Fantasia",
  "War & Politics": "Guerra & Política",
  "Science-Fiction": "Ficção Científica",
  "Science Fiction": "Ficção Científica",
  Action: "Ação",
  Adventure: "Aventura",
  Animation: "Animação",
  Comedy: "Comédia",
  Crime: "Crime",
  Documentary: "Documentário",
  Drama: "Drama",
  Family: "Família",
  Fantasy: "Fantasia",
  History: "História",
  Horror: "Terror",
  Mystery: "Mistério",
  Romance: "Romance",
  Thriller: "Suspense",
  War: "Guerra",
  Western: "Faroeste",
  Anime: "Anime",
  Music: "Música",
  Sports: "Desporto",
  Supernatural: "Sobrenatural",
  Kids: "Infantil",
  Reality: "Reality",
  Soap: "Novela",
  Talk: "Talk Show",
  Espionage: "Espionagem",
  Medical: "Médico",
  Legal: "Jurídico",
};

function translateGenre(name: string): string {
  return GENRE_PT[name] ?? name;
}

export async function loadProfileStats(): Promise<ProfileStats> {
  const [shows, watched, movies, meta] = await Promise.all([
    getShows(),
    getAllWatched(),
    getMovies(),
    getImportMeta(),
  ]);

  // episódios por série — base para a série-farol e para pesar géneros por
  // tempo real gasto (e não por nº de séries)
  const perShow = new Map<string, number>();
  for (const ep of watched) {
    perShow.set(ep.showUuid, (perShow.get(ep.showUuid) ?? 0) + 1);
  }

  // série-farol: a mais vista (com poster de preferência, para o cartão brilhar)
  let topShow: TopShow | null = null;
  for (const show of shows) {
    const count = perShow.get(show.uuid) ?? 0;
    if (count === 0) continue;
    if (!topShow || count > topShow.count) {
      topShow = { uuid: show.uuid, name: show.name, posterPath: show.posterPath, count };
    }
  }

  // espetro de géneros, pesado por episódios vistos
  const genreWeight = new Map<string, number>();
  for (const show of shows) {
    const weight = perShow.get(show.uuid) ?? 0;
    if (weight === 0 || !show.genres) continue;
    for (const g of show.genres) {
      const name = translateGenre(g);
      genreWeight.set(name, (genreWeight.get(name) ?? 0) + weight);
    }
  }
  const sortedGenres = [...genreWeight.entries()].sort((a, b) => b[1] - a[1]);
  const totalGenreWeight = sortedGenres.reduce((sum, [, w]) => sum + w, 0);
  const genres: GenreSlice[] = [];
  if (totalGenreWeight > 0) {
    const top = sortedGenres.slice(0, SPECTRUM.length);
    top.forEach(([name, count], i) => {
      genres.push({
        name,
        count,
        pct: (count / totalGenreWeight) * 100,
        color: SPECTRUM[i],
      });
    });
    const restWeight = sortedGenres
      .slice(SPECTRUM.length)
      .reduce((sum, [, w]) => sum + w, 0);
    if (restWeight > 0) {
      genres.push({
        name: "Outros",
        count: restWeight,
        pct: (restWeight / totalGenreWeight) * 100,
        color: OUTROS_COLOR,
      });
    }
  }

  // atividade por ano + primeiro ano de registo
  const yearCount = new Map<number, number>();
  for (const ep of watched) {
    // só o que tem data certa — ver o mesmo filtro em advancedStats.ts
    if (ep.dateIsExact === false) continue;
    const year = Number(ep.watchedAt.slice(0, 4));
    if (Number.isFinite(year)) yearCount.set(year, (yearCount.get(year) ?? 0) + 1);
  }
  const perYear: YearBar[] = [...yearCount.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, count]) => ({ year, count }));
  const firstYear = perYear.length > 0 ? perYear[0].year : null;

  return {
    shows: shows.length,
    following: shows.filter((s) => s.followed).length,
    episodes: watched.length,
    movies: movies.length,
    hours: meta?.totalSeriesRuntimeSec
      ? Math.round(meta.totalSeriesRuntimeSec / 3600)
      : null,
    importedAt: meta?.importedAt ?? null,
    firstYear,
    topShow,
    genres,
    perYear,
  };
}
