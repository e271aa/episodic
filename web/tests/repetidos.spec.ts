import { test, expect } from "./apoio/base";
import { semear } from "./apoio/semear";

/**
 * Ronda 12, Fase 1 — o que a pesquisa já tinha duplicado antes da correção.
 *
 * A limpeza de repetidos do Perfil só juntava séries com o mesmo nome — e as
 * cópias criadas pela pesquisa têm o nome português da TMDB ("Ruptura Total"
 * ao lado de "Breaking Bad"). E não existia para filmes. Tudo o que sai é
 * mostrado antes do toque.
 */

type Pagina = import("@playwright/test").Page;

function ler<T>(page: Pagina, store: "movies" | "shows" | "lists") {
  return page.evaluate(
    (nome) =>
      new Promise<T[]>((resolve) => {
        const pedido = indexedDB.open("tvlog", 4);
        pedido.onsuccess = () => {
          const todos = pedido.result.transaction(nome).objectStore(nome).getAll();
          todos.onsuccess = () => resolve(todos.result as T[]);
        };
      }),
    store,
  );
}

async function verificar(page: Pagina) {
  await page.goto("/profile");
  await page.getByRole("button", { name: /Verificar biblioteca/ }).click();
}

test("um filme em 'para ver' e a cópia vista pela pesquisa juntam-se num só, visto", async ({
  page,
}) => {
  await semear(page, {
    filmes: [
      {
        key: "uuid-tvtime",
        name: "The Shawshank Redemption",
        watchedAt: null,
        tmdbId: 278,
        releaseDate: "1994-09-23",
        addedAt: "2024-01-01T00:00:00.000Z",
      },
      {
        key: "tmdb-278",
        name: "Os Condenados de Shawshank",
        watchedAt: "2026-09-20T21:00:00.000Z",
        tmdbId: 278,
        releaseDate: "1994-09-23",
        addedAt: "2026-09-20T21:00:00.000Z",
      },
    ],
    // a cópia estava numa lista — tem de continuar lá, pelo original
    listas: [{ id: "l-1", name: "Favoritos", items: [{ kind: "movie", refId: "tmdb-278" }] }],
    kv: { "movies:enrich-v": 2 },
  });
  await verificar(page);

  const aviso = page.getByTestId("filmes-repetidos");
  await expect(aviso).toContainText("1 filme repetido");
  await expect(aviso).toContainText("The Shawshank Redemption = Os Condenados de Shawshank");
  await expect(aviso).toContainText("fica visto a 20 de setembro de 2026");
  await page.getByRole("button", { name: "Juntar o filme" }).click();
  await expect(page.getByText("1 cópia de filme juntada ao original.")).toBeVisible();

  const filmes = await ler<{ key: string; watchedAt: string | null; aliases?: string[] }>(
    page,
    "movies",
  );
  expect(filmes).toHaveLength(1);
  expect(filmes[0].key).toBe("uuid-tvtime");
  expect(filmes[0].watchedAt).toBe("2026-09-20T21:00:00.000Z");
  expect(filmes[0].aliases).toContain("Os Condenados de Shawshank");

  const [lista] = await ler<{ items: { refId: string }[] }>(page, "lists");
  expect(lista.items.map((i) => i.refId)).toEqual(["uuid-tvtime"]);

  // e saiu mesmo de "para ver"
  await page.goto("/library?tipo=filmes&filtro=para-ver");
  await expect(page.locator('a[href="/movies/uuid-tvtime"]')).toHaveCount(0);
});

test("a cópia vazia de uma série com outro nome é encontrada e sai", async ({ page }) => {
  await semear(page, {
    series: [
      { uuid: "uuid-do-tvtime", name: "Breaking Bad", tmdbId: 1396, totalEpisodes: 3 },
      { uuid: "tmdb-1396", name: "Ruptura Total", tmdbId: 1396, followed: true },
    ],
    vistos: [1, 2, 3].map((episode) => ({ showUuid: "uuid-do-tvtime", season: 1, episode })),
  });
  await verificar(page);

  await expect(page.getByText("1 série repetida")).toBeVisible();
  await expect(page.getByText(/Ruptura Total = Breaking Bad · fica a que tem 3 episódios/)).toBeVisible();
  await page.getByRole("button", { name: "Remover a repetida" }).click();
  await expect(page.getByText("1 série repetida removida.")).toBeVisible();

  const series = await ler<{ uuid: string; tmdbAliases?: string[] }>(page, "shows");
  expect(series.map((s) => s.uuid)).toEqual(["uuid-do-tvtime"]);
  // e a pesquisa passa a encontrá-la pelo nome português
  expect(series[0].tmdbAliases).toContain("Ruptura Total");
});

test("um remake com o mesmo título nunca é juntado ao original", async ({ page }) => {
  await semear(page, {
    filmes: [
      { key: "uuid-1994", name: "The Lion King", watchedAt: "2015-01-01T00:00:00.000Z", tmdbId: 8587, releaseDate: "1994-06-15" },
      { key: "tmdb-420818", name: "The Lion King", watchedAt: null, tmdbId: 420818, releaseDate: "2019-07-12" },
      // sem ano nem id: ligava os dois por transitividade, se se deixasse
      { key: "uuid-sem-nada", name: "The Lion King", watchedAt: null },
    ],
    kv: { "movies:enrich-v": 2 },
  });
  await verificar(page);

  // O registo sem nada é o mesmo que um deles, e junta-se — mas o de 1994 e o
  // de 2019 nunca: o invariante está nos dados, não no texto do aviso.
  await page.getByRole("button", { name: /Juntar/ }).click();
  await expect(page.getByText(/juntada ao original/)).toBeVisible();

  const filmes = await ler<{ key: string; watchedAt: string | null }>(page, "movies");
  const porChave = Object.fromEntries(filmes.map((f) => [f.key, f.watchedAt]));
  expect(Object.keys(porChave).sort()).toEqual(["tmdb-420818", "uuid-1994"]);
  expect(porChave["uuid-1994"]).toBe("2015-01-01T00:00:00.000Z");
  // o de 2019 continua por ver — juntá-lo ao de 1994 tê-lo-ia dado como visto
  expect(porChave["tmdb-420818"]).toBeNull();
});
