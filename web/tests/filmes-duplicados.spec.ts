import { test, expect } from "./apoio/base";
import { semear } from "./apoio/semear";

/**
 * Ronda 12 · Fase 0 — "filmes que só por ter marcado na lista para ver, agora
 * já vi mas continua lá".
 *
 * Reproduzido: um filme importado do TV Time tem a chave do TV Time e o nome
 * em inglês. Procurado na Biblioteca pelo nome português, a pesquisa local
 * não o encontra ("0 filmes na biblioteca"); a pesquisa no catálogo mostra-o
 * como se fosse novo, e "Marcar visto" cria um SEGUNDO registo (`tmdb-278`)
 * — porque o cartão da pesquisa só procura pela chave, e ignora que o
 * original já tem o mesmo `tmdbId`. O original fica em "para ver" para
 * sempre. O Explorar faz a verificação certa (por id ou por nome); a
 * pesquisa da Biblioteca não.
 *
 * BUG CONHECIDO, por corrigir na Fase 1. `test.fail()` mantém o CI verde
 * enquanto o bug existe — e põe-no vermelho no dia em que for corrigido,
 * para obrigar a tirar o `.fail()` e o teste passar a guardar a correção.
 */
test("marcar visto na pesquisa um filme que já está em 'para ver' não o duplica", async ({
  page,
  tmdb,
}) => {
  test.fail(true, "Bug conhecido — Ronda 12, Fase 1");
  await semear(page, {
    filmes: [
      {
        key: "0b6f-uuid-do-tvtime",
        name: "The Shawshank Redemption",
        watchedAt: null,
        tmdbId: 278,
        releaseDate: "1994-09-23",
      },
    ],
  });
  tmdb.multi = [
    {
      id: 278,
      media_type: "movie",
      title: "Os Condenados de Shawshank",
      original_title: "The Shawshank Redemption",
      release_date: "1994-09-23",
      poster_path: null,
      overview: "",
    },
  ];

  await page.goto("/library?tipo=filmes");
  await page.getByRole("button", { name: "Procurar na biblioteca" }).click();
  await page.locator('input[type="search"]').fill("condenados");
  await page.getByRole("button", { name: "Ver resultados" }).click();
  await page.getByTestId("remote-search-button").click();
  await page.getByRole("button", { name: "Marcar visto" }).click();
  await expect(page.getByText("Filme marcado como visto")).toBeVisible();

  const filmes = await page.evaluate(
    () =>
      new Promise<{ key: string; watchedAt: string | null }[]>((resolve) => {
        const pedido = indexedDB.open("tvlog", 4);
        pedido.onsuccess = () => {
          const todos = pedido.result
            .transaction("movies", "readonly")
            .objectStore("movies")
            .getAll();
          todos.onsuccess = () => resolve(todos.result);
        };
      }),
  );
  // Um filme, visto. Hoje dá dois: o original ainda em "para ver".
  expect(filmes).toHaveLength(1);
  expect(filmes[0].watchedAt).not.toBeNull();
});
