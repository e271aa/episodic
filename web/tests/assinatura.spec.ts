import { test, expect } from "./apoio/base";
import { semear, type EpisodioVisto } from "./apoio/semear";
import { serieCompleta, type Catalogo } from "./apoio/tmdb";

/**
 * Ronda 14, Fase 3 — a assinatura da Mira, escolhida pelo Ruben depois da
 * crítica: o ritual (no toque, fatia a fatia) e o fim de temporada, a
 * gramática de TV (código em mono, segmentos), o diário no cabeçalho, e a
 * carta de teste. Mais os P1 da crítica: o salto do cartão, o erro calado,
 * o contraste do modo claro.
 */

async function casa(
  page: import("@playwright/test").Page,
  tmdb: Catalogo,
  temporadas: number[],
  vistos: [number, number][],
  quando?: string,
) {
  const c = serieCompleta(940, "Severance", temporadas);
  Object.assign(tmdb.series, c.series);
  Object.assign(tmdb.episodios, c.episodios);
  const lista: EpisodioVisto[] = vistos.map(([season, episode]) => ({
    showUuid: "s-1",
    season,
    episode,
    ...(quando ? { watchedAt: quando } : {}),
  }));
  await semear(page, {
    series: [
      {
        uuid: "s-1",
        name: "Severance",
        tmdbId: 940,
        numeracao: "tmdb",
        posterPath: "/cartaz.jpg",
        totalEpisodes: temporadas.reduce((a, b) => a + b, 0),
      },
    ],
    vistos: lista,
  });
  await page.goto("/series");
  await page.getByTestId("progresso-casa").locator("i").first().waitFor();
}

test("o ritual começa no toque: a mira já corre antes de o episódio mudar", async ({ page, tmdb }) => {
  await casa(page, tmdb, [9, 10], [[1, 1], [1, 2], [1, 3]]);
  const cartao = page.getByTestId("cartao-casa");
  await expect(cartao).toContainText("S01·E04");
  // A gravação fica presa 2s: uma transação nossa ocupa o store dos vistos, e a
  // da app espera por ela. Sem isto o teste dependia do relógio — a escrita
  // local acaba em milissegundos, e com o episódio já mudado um ritual que
  // esperasse pela gravação passava por um ritual no toque (a primeira versão
  // deste teste deixou sobreviver as duas mutações do ritual).
  await page.evaluate(
    () =>
      new Promise<void>((pronto) => {
        const pedido = indexedDB.open("tvlog");
        pedido.onsuccess = () => {
          const store = pedido.result.transaction("watched", "readwrite").objectStore("watched");
          const fim = Date.now() + 2000;
          const ocupar = () => {
            if (Date.now() < fim) store.get("nada").onsuccess = ocupar;
          };
          store.get("nada").onsuccess = () => {
            pronto();
            ocupar();
          };
        };
      }),
  );
  await page.getByRole("button", { name: "Marcar visto" }).click();
  // ainda com o S01·E04 à vista (a gravação não acabou), a mira já pinta:
  // os vistos e o marcado — os por ver nunca acendem — e a contagem já rolou
  const fatias = page.locator('[data-ritual="fatia"]');
  await expect(fatias).toHaveCount(4, { timeout: 1000 });
  await expect(cartao).toContainText("4/9");
  await expect(cartao).toContainText("S01·E04");
  // e quando a gravação acaba, o episódio segue
  await expect(cartao).toContainText("S01·E05", { timeout: 5000 });
});

test("fechar uma temporada tem o seu momento: «T1 ✓», e a seguinte constrói-se", async ({ page, tmdb }) => {
  await casa(page, tmdb, [3, 4], [[1, 1], [1, 2]]);
  await page.getByRole("button", { name: "Marcar visto" }).click();
  const progresso = page.getByTestId("progresso-casa");
  await expect(progresso).toHaveAttribute("data-fim", "sim");
  await expect(progresso).toContainText("T1 ✓");
  await expect(page.getByRole("img", { name: "Temporada 1 completa" })).toBeVisible();
  await expect(page.getByTestId("undo-toast")).toContainText("T1 completa · 3 episódios");
  // depois, a temporada 2, do zero
  await expect(progresso).toContainText("0/4", { timeout: 3000 });
  await expect(progresso).not.toHaveAttribute("data-fim", "sim");
});

test("o diário no cabeçalho: marcar soma «1 episódio», anular tira", async ({ page, tmdb }) => {
  await casa(page, tmdb, [9], [[1, 1]], "2020-01-01T21:00:00.000Z");
  await expect(page.getByTestId("diario")).toHaveCount(0);
  await page.getByRole("button", { name: "Marcar visto" }).click();
  await expect(page.getByTestId("diario")).toContainText("1 episódio");
  await page.getByTestId("undo-button").click();
  await expect(page.getByTestId("diario")).toHaveCount(0);
});

test("o cartão não salta ao marcar uma série parada: a linha de contexto fica", async ({ page, tmdb }) => {
  const ha60 = new Date(Date.now() - 60 * 864e5).toISOString();
  await casa(page, tmdb, [9], [[1, 1], [1, 2]], ha60);
  await expect(page.getByTestId("contexto-casa")).toContainText("Parada há");
  const botao = page.getByRole("button", { name: "Marcar visto" });
  const antes = (await botao.boundingBox())!.y;
  await botao.click();
  await expect(page.getByTestId("cartao-casa")).toContainText("S01·E04");
  await expect(page.getByTestId("contexto-casa")).toContainText("Viste o anterior hoje");
  const depois = (await botao.boundingBox())!.y;
  expect(Math.abs(depois - antes)).toBeLessThanOrEqual(1);
});

test("se não der para gravar, diz-se — e o episódio não fica aceso", async ({ page, tmdb }) => {
  await casa(page, tmdb, [9, 10], [[1, 1], [1, 2], [1, 3]]);
  // a base local recusa escrever (disco cheio, modo privado…)
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = function () {
      throw new DOMException("sem espaço", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "Marcar visto" }).click();
  // no cartão: o Next tem o seu próprio `role="alert"` (o anunciador de rotas)
  await expect(page.getByTestId("cartao-casa").getByRole("alert")).toContainText("Não deu para marcar");
  await expect(page.getByTestId("cartao-casa")).toContainText("3/9");
  await expect(page.getByTestId("cartao-casa")).toContainText("S01·E04");
});

test("a letra da TV: o código em mono, os nomes não", async ({ page, tmdb }) => {
  await casa(page, tmdb, [9, 10], [[1, 1], [1, 2], [1, 3]]);
  const mono = (sel: import("@playwright/test").Locator) =>
    sel.evaluate((el) => /mono|menlo/i.test(getComputedStyle(el).fontFamily));
  expect(await mono(page.getByTestId("cartao-casa").getByText("S01·E04", { exact: true }))).toBe(true);
  expect(await mono(page.getByRole("heading", { level: 2, name: "Severance" }))).toBe(false);
  // no aviso de anular: o código em mono, o nome da série não
  await page.getByRole("button", { name: "Marcar visto" }).click();
  const aviso = page.getByTestId("undo-toast");
  await expect(aviso).toContainText("S01·E04 visto");
  expect(await mono(aviso.getByText("S01·E04", { exact: true }))).toBe(true);
  expect(await mono(aviso.getByText("Severance", { exact: true }))).toBe(false);
});

test("os nomes da barra não descem dos 10px com o texto pequeno do Ruben (15px)", async ({ page }) => {
  await semear(page, {});
  await page.goto("/series");
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "15px";
  });
  const tamanho = await page
    .getByRole("navigation", { name: "Separadores" })
    .getByText("Biblioteca", { exact: true })
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(tamanho).toBeGreaterThanOrEqual(10);
});

test.describe("modo claro", () => {
  test.use({ colorScheme: "light" });
  test("o texto secundário passa AA: 76% e não os 60% do iOS", async ({ page, tmdb }) => {
    await casa(page, tmdb, [9, 10], [[1, 1], [1, 2], [1, 3]]);
    const cor = await page.getByTestId("contexto-casa").evaluate((el) => getComputedStyle(el).color);
    expect(cor.replace(/\s/g, "")).toMatch(/0\.76\)$/);
  });
});

test("a vitrine carrega a biblioteca de exemplo: The Bear a um episódio de fechar a T1", async ({ page, tmdb }) => {
  // para o Ruben julgar a assinatura no iPhone, na pré-visualização sem nuvem
  for (const [id, nome, temporadas] of [
    [136315, "The Bear", [8, 10]],
    [95396, "Severance", [9, 10]],
    [83867, "Andor", [12, 12]],
    [126308, "Shōgun", [10]],
  ] as [number, string, number[]][]) {
    const c = serieCompleta(id, nome, temporadas);
    Object.assign(tmdb.series, c.series);
    Object.assign(tmdb.episodios, c.episodios);
  }
  tmdb.filmes[666277] = { id: 666277, title: "Past Lives", release_date: "2023-06-02", poster_path: null };
  await page.goto("/mira");
  await page.getByRole("button", { name: "Carregar biblioteca de exemplo" }).click();
  await expect(page).toHaveURL(/\/series$/);
  const cartao = page.getByTestId("cartao-casa");
  await expect(cartao.getByRole("heading", { level: 2 })).toHaveText("The Bear");
  await expect(cartao).toContainText("S01·E08");
  await expect(cartao).toContainText("7/8");
  await expect(page.getByTestId("contexto-casa")).toHaveText("Viste o anterior ontem");
  // vistos de ontem: o diário parte do zero
  await expect(page.getByTestId("diario")).toHaveCount(0);
  await page.getByRole("button", { name: "Marcar visto" }).click();
  await expect(page.getByTestId("progresso-casa")).toContainText("T1 ✓");
});
