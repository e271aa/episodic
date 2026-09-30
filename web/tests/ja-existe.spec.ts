import { test, expect } from "./apoio/base";
import { semear } from "./apoio/semear";
import type { LinhaTmdb } from "./apoio/tmdb";

/**
 * Ronda 12, Fase 1 — "filmes que marquei para ver, já vi, e continuam lá".
 *
 * Um filme ou uma série importados do TV Time têm a chave do TV Time e o nome
 * em inglês. A pesquisa da Biblioteca só os procurava pela chave `tmdb-<id>`
 * e mostrava-os como novos: "Marcar visto" criava um segundo filme (o
 * original ficava em "para ver" para sempre) e "Seguir" criava uma segunda
 * série, vazia, em "Por começar". Medido na Fase 0: dois registos em vez de
 * um, nos dois casos. Foi a segunda vez — em julho foi o Explorar.
 */

type Pagina = import("@playwright/test").Page;

function ler<T>(page: Pagina, store: "movies" | "shows") {
  return page.evaluate(
    (nome) =>
      new Promise<T[]>((resolve) => {
        const pedido = indexedDB.open("flicki", 4);
        pedido.onsuccess = () => {
          const todos = pedido.result.transaction(nome).objectStore(nome).getAll();
          todos.onsuccess = () => resolve(todos.result as T[]);
        };
      }),
    store,
  );
}

async function procurarNoCatalogo(page: Pagina, rota: string, termo: string) {
  await page.goto(rota);
  await page.locator('input[type="search"]').fill(termo);
  await page.getByTestId("remote-search-button").click();
}

const SHAWSHANK: LinhaTmdb = {
  id: 278,
  media_type: "movie",
  title: "Os Condenados de Shawshank",
  original_title: "The Shawshank Redemption",
  release_date: "1994-09-23",
  poster_path: null,
  overview: "",
};

test("marcar visto na pesquisa um filme que já está em 'para ver' marca esse, não cria outro", async ({
  page,
  tmdb,
}) => {
  await semear(page, {
    filmes: [
      {
        key: "0b6f-uuid-do-tvtime",
        name: "The Shawshank Redemption",
        watchedAt: null,
        tmdbId: 278,
        releaseDate: "1994-09-23",
        posterPath: "/shawshank.jpg",
      },
    ],
    // sem a revisão de filmes por baixo: ela também ensinaria o nome
    // português, e a última asserção passaria por outra razão
    kv: { "movies:enrich-v": 2 },
  });
  tmdb.multi = [SHAWSHANK];
  await procurarNoCatalogo(page, "/library?tipo=filmes", "condenados");

  // O cartão já sabe que o filme lá está — e só oferece o que faz sentido
  await expect(page.getByTestId("filme-ja-para-ver")).toBeVisible();
  await expect(page.getByRole("button", { name: "Para ver" })).toHaveCount(0);
  await page.getByRole("button", { name: "Marcar visto" }).click();
  await expect(page.getByTestId("filme-ja-visto")).toBeVisible();

  const filmes = await ler<{ key: string; watchedAt: string | null }>(page, "movies");
  expect(filmes).toHaveLength(1);
  expect(filmes[0].key).toBe("0b6f-uuid-do-tvtime");
  expect(filmes[0].watchedAt).not.toBeNull();

  // e aprendeu o nome português: a pesquisa local já o encontra
  await page.locator('input[type="search"]').fill("condenados");
  await expect(page.locator('a[href="/movies/0b6f-uuid-do-tvtime"]')).toBeVisible();
});

test("um filme já visto aparece como visto, sem botões para o duplicar", async ({
  page,
  tmdb,
}) => {
  await semear(page, {
    filmes: [
      {
        key: "uuid-tvtime",
        name: "The Shawshank Redemption",
        watchedAt: "2020-01-01T00:00:00.000Z",
        tmdbId: 278,
      },
    ],
  });
  tmdb.multi = [SHAWSHANK];
  await procurarNoCatalogo(page, "/library?tipo=filmes", "condenados");
  await expect(page.getByTestId("filme-ja-visto")).toContainText("Já viste");
  await expect(page.getByRole("button", { name: "Marcar visto" })).toHaveCount(0);
});

test("um remake com o mesmo título não é confundido com o original", async ({
  page,
  tmdb,
}) => {
  // O risco inverso: reconhecer demais marcava o filme errado como visto.
  await semear(page, {
    filmes: [
      {
        key: "uuid-rei-leao-1994",
        name: "The Lion King",
        watchedAt: "2015-01-01T00:00:00.000Z",
        tmdbId: 8587,
        releaseDate: "1994-06-15",
        posterPath: "/rei-leao-1994.jpg",
      },
    ],
    // A Biblioteca faz uma revisão completa dos filmes quando a regra de
    // escolha muda — e numa base nova "muda" sempre. Essa revisão pesquisa
    // cada filme pelo nome na TMDB falsa, que devolve o de 2019 a tudo, e
    // reescrevia o id do de 1994 antes de o teste medir o que interessa.
    kv: { "movies:enrich-v": 2 },
  });
  tmdb.multi = [
    {
      id: 420818,
      media_type: "movie",
      title: "O Rei Leão",
      original_title: "The Lion King",
      release_date: "2019-07-12",
      poster_path: null,
      overview: "",
    },
  ];
  await procurarNoCatalogo(page, "/library?tipo=filmes", "rei leao");
  // Âncora: o botão só fica ativo depois de a verificação responder "não
  // está". Sem isto, o `toHaveCount(0)` abaixo passava antes da resposta —
  // e passou mesmo, com o remake confundido, na primeira versão deste teste.
  const paraVer = page.getByRole("button", { name: "Para ver" });
  await expect(paraVer).toBeEnabled();
  await expect(page.getByTestId("filme-ja-visto")).toHaveCount(0);
  await paraVer.click();

  // Esperar pela gravação: o clique escreve de forma assíncrona, e ler a base
  // logo a seguir apanhava só o filme de 1994 (2 em 30 corridas com 6
  // trabalhadores, sem nada partido).
  await expect
    .poll(() => ler<{ key: string; watchedAt: string | null }>(page, "movies").then((f) => f.length))
    .toBe(2);
  const filmes = await ler<{ key: string; watchedAt: string | null }>(page, "movies");
  expect(filmes.find((f) => f.key === "uuid-rei-leao-1994")?.watchedAt).toBe(
    "2015-01-01T00:00:00.000Z",
  );
});

test("seguir na pesquisa uma série que já tens leva até ela, em vez de criar outra", async ({
  page,
  tmdb,
}) => {
  await semear(page, {
    series: [{ uuid: "uuid-do-tvtime", name: "Breaking Bad", tmdbId: 1396, totalEpisodes: 3 }],
    vistos: [1, 2, 3].map((episode) => ({ showUuid: "uuid-do-tvtime", season: 1, episode })),
  });
  tmdb.multi = [
    {
      id: 1396,
      media_type: "tv",
      name: "Ruptura Total",
      original_name: "Breaking Bad",
      first_air_date: "2008-01-20",
      poster_path: null,
      overview: "",
    },
  ];
  await procurarNoCatalogo(page, "/library", "ruptura");

  await expect(page.getByTestId("serie-ja-existe")).toHaveText("Já a segues");
  await expect(page.getByRole("button", { name: "Seguir" })).toHaveCount(0);
  await page.getByRole("link", { name: "Abrir →" }).click();
  await expect(page).toHaveURL(/\/series\/uuid-do-tvtime$/);

  expect(await ler<{ uuid: string }>(page, "shows")).toHaveLength(1);
});
