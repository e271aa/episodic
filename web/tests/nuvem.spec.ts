import { test, expect } from "./apoio/base";
import type { StoredMovie, StoredShow, WatchedEpisode } from "../src/lib/db";
import {
  compararComNuvem,
  juntarEpisodio,
  juntarFilme,
  juntarKv,
  juntarSerie,
  movieToRow,
  rowToMovie,
  rowToShow,
  rowToWatched,
  showToRow,
  watchedToRow,
  type MovieRow,
  type ShowRow,
  type WatchedRow,
} from "../src/lib/linhas";
import { escolherNumeracao } from "../src/lib/numeracao";

/**
 * Ronda 12, Fase 2 — o portão antes do nome novo.
 *
 * O iOS só mostra nome e ícone novos numa instalação nova, e apagar a app do
 * ecrã principal apaga o que ela guarda no telemóvel. Medido antes: uma
 * instalação nova perdia a numeração das séries (11 séries, 729 marcações
 * fora do sítio), as listas inteiras e metade do que a app sabe dos filmes. E
 * pior — cada "Sincronizar agora" já apagava a numeração no telemóvel.
 *
 * `Required<>` é de propósito: acrescentar um campo a StoredShow ou a
 * StoredMovie e não o pôr na cloud deixa de compilar aqui.
 *
 * A única exceção é a `runtime` (Ronda 12, 5c): volta-se a buscar ao
 * fornecedor — uma instalação nova não perde nada, o backfill repõe-na — e
 * uma coluna nova obrigava a correr SQL no Supabase ANTES do deploy, senão
 * a sincronização partia. Fica só no telemóvel, e o `juntarSerie` guarda-a.
 */

const SERIE: Required<Omit<StoredShow, "runtime">> = {
  uuid: "uuid-naruto",
  name: "Naruto",
  tvdbId: 78857,
  tmdbId: 46260,
  tvmazeId: 505,
  posterPath: "/naruto.jpg",
  backdropPath: "/naruto-fundo.jpg",
  overview: "Um ninja.",
  totalEpisodes: 220,
  firstAired: "2002-10-03",
  status: "Ended",
  genres: ["Animation", "Action"],
  imdbId: "tt0409591",
  tmdbAliases: ["Naruto", "ナルト"],
  numeracao: "tvmaze",
  followed: true,
  inWatchlist: false,
  archived: false,
  addedAt: "2024-01-01T00:00:00.000Z",
};

const FILME: Required<StoredMovie> = {
  key: "uuid-shawshank",
  name: "The Shawshank Redemption",
  watchedAt: "2020-02-02T21:00:00.000Z",
  dateIsExact: false,
  releaseDate: "1994-09-23",
  addedAt: "2019-01-01T00:00:00.000Z",
  tmdbId: 278,
  posterPath: "/shawshank.jpg",
  aliases: ["Os Condenados de Shawshank", "The Shawshank Redemption"],
};

/** O que a cloud devolve: a linha enviada, menos o que só serve para escrever. */
function pelaNuvem<T>(linha: Record<string, unknown>): T {
  const resto = { ...linha };
  delete resto.user_id;
  delete resto.updated_at;
  return resto as T;
}

test("uma série vai à cloud e volta igual — numeração incluída", () => {
  const volta = rowToShow(pelaNuvem<ShowRow>(showToRow(SERIE, "u")));
  expect(volta).toEqual(SERIE);
});

test("um filme vai à cloud e volta igual", () => {
  const volta = rowToMovie(pelaNuvem<MovieRow>(movieToRow(FILME, "u")));
  expect(volta).toEqual(FILME);
});

test("um episódio vai à cloud e volta igual; o id do TheTVDB fica cá", () => {
  const ep: WatchedEpisode = {
    id: "uuid-naruto:6:5",
    showUuid: "uuid-naruto",
    season: 6,
    episode: 5,
    watchedAt: "2021-05-05T20:00:00.000Z",
    dateIsExact: true,
    episodeTvdbId: 123456,
  };
  const daNuvem = rowToWatched(pelaNuvem<WatchedRow>(watchedToRow(ep, "u")));
  expect(juntarEpisodio(ep, daNuvem)).toEqual(ep);
});

test("sincronizar com uma cloud antiga não apaga o que só o telemóvel sabe", () => {
  // Exatamente o que a cloud tinha antes desta ronda: sem numeração, sem
  // nomes alternativos. Substituir a série local por isto era o que fazia o
  // "Sincronizar agora" apagar a numeração.
  const antiga = rowToShow({
    ...pelaNuvem<ShowRow>(showToRow(SERIE, "u")),
    numeracao: undefined,
    tmdb_aliases: undefined,
    // e uma intenção que mudou noutro dispositivo: essa tem de chegar
    archived: true,
  });
  const junta = juntarSerie(SERIE, antiga);
  expect(junta.numeracao).toBe("tvmaze");
  expect(junta.tmdbAliases).toEqual(SERIE.tmdbAliases);
  expect(junta.archived).toBe(true);
});

test("a duração de um episódio, só no telemóvel, sobrevive a uma sincronização", () => {
  const local: StoredShow = { ...SERIE, runtime: 23 };
  const daNuvem = rowToShow(pelaNuvem<ShowRow>(showToRow(local, "u")));
  expect(juntarSerie(local, daNuvem).runtime).toBe(23);
});

test("num filme, vazio na cloud quer dizer 'para ver' — mas só a data de visto", () => {
  const paraVer = rowToMovie({
    key: FILME.key,
    name: FILME.name,
    watched_at: null,
    date_is_exact: true,
  });
  const junto = juntarFilme(FILME, paraVer);
  expect(junto.watchedAt).toBeNull();
  // o que a cloud antiga não sabia fica como estava
  expect(junto.tmdbId).toBe(278);
  expect(junto.aliases).toEqual(FILME.aliases);
});

test("as listas: a cloud é um cofre — só entra o que o telemóvel não tem", () => {
  const minhas = [{ id: "l-1", name: "Minha", createdAt: "x", items: [] }];
  const daNuvem = [{ id: "l-2", name: "Antiga", createdAt: "y", items: [] }];
  expect(juntarKv(minhas, daNuvem)).toBe(minhas);
  expect(juntarKv([], daNuvem)).toBe(daNuvem);
  expect(juntarKv(null, daNuvem)).toBe(daNuvem);
});

test("a numeração perdida volta pela divisão em que as marcações encaixam", () => {
  // Divisões medidas nas duas APIs a 25-09
  const naruto = { tvmaze: [13, 51, 51, 50, 50, 5], tmdb: [52, 52, 54, 62] };
  const marcadasNaruto = [13, 51, 51, 50, 50, 5].flatMap((n, i) =>
    Array.from({ length: n }, (_, e) => ({ season: i + 1, episode: e + 1 })),
  );
  expect(escolherNumeracao(naruto.tvmaze, naruto.tmdb, marcadasNaruto)).toBe("tvmaze");

  const friends = {
    tvmaze: [24, 24, 25, 24, 24, 25, 24, 24, 24, 18],
    tmdb: [24, 24, 25, 23, 23, 23, 23, 23, 23, 17],
  };
  expect(escolherNumeracao(friends.tvmaze, friends.tmdb, [{ season: 4, episode: 24 }])).toBe(
    "tvmaze",
  );
  // as duas aceitam (a maioria das séries): não se decide nada
  expect(escolherNumeracao(friends.tvmaze, friends.tmdb, [{ season: 1, episode: 3 }])).toBeNull();
  // nenhuma aceita: também não
  expect(escolherNumeracao([10], [10], [{ season: 2, episode: 1 }])).toBeNull();
});

test("a prova: uma instalação nova recuperava tudo só se a cloud tiver o mesmo", () => {
  const aqui = { series: 74, episodios: 3345, filmes: 180, listas: 3, seriesComNumeracao: 69 };

  expect(compararComNuvem(aqui, { ...aqui }).tudoCerto).toBe(true);

  // a cloud de antes do SQL: sem a coluna da numeração
  const semSql = compararComNuvem(aqui, { ...aqui, listas: 0, seriesComNumeracao: null });
  expect(semSql.faltaSql).toBe(true);
  expect(semSql.tudoCerto).toBe(false);

  // a cloud com MAIS também é diferença: o que apagaste aqui voltava
  const aMais = compararComNuvem(aqui, { ...aqui, episodios: 3350 });
  expect(aMais.tudoCerto).toBe(false);
  expect(aMais.linhas.find((l) => l.nome === "Episódios vistos")?.certo).toBe(false);
});
