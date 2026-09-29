import { test, expect } from "./apoio/base";
import { semear, type EpisodioVisto } from "./apoio/semear";
import { serieCompleta } from "./apoio/tmdb";

/**
 * Ronda 14, Fase 2 — a casa da Mira: o progresso por temporada em segmentos,
 * a arte sem texto por cima e que sai com texto grande, o aviso de anular.
 */

async function serieAMeio(
  page: import("@playwright/test").Page,
  tmdb: import("./apoio/tmdb").Catalogo,
  temporadas: number[],
  vistosNaUltima: number,
) {
  const c = serieCompleta(930, "Severance", temporadas);
  Object.assign(tmdb.series, c.series);
  Object.assign(tmdb.episodios, c.episodios);
  const t = temporadas.length;
  const vistos: EpisodioVisto[] = [];
  temporadas.slice(0, -1).forEach((n, i) => {
    for (let e = 1; e <= n; e++) vistos.push({ showUuid: "s-1", season: i + 1, episode: e });
  });
  for (let e = 1; e <= vistosNaUltima; e++) vistos.push({ showUuid: "s-1", season: t, episode: e });
  await semear(page, {
    series: [
      {
        uuid: "s-1",
        name: "Severance",
        tmdbId: 930,
        numeracao: "tmdb",
        posterPath: "/cartaz.jpg",
        totalEpisodes: temporadas.reduce((a, b) => a + b, 0),
      },
    ],
    vistos,
  });
  await page.goto("/series");
}

test("o progresso é da temporada, um segmento por episódio: 6/10", async ({ page, tmdb }) => {
  await serieAMeio(page, tmdb, [9, 10], 6);
  const progresso = page.getByTestId("progresso-casa");
  await expect(progresso.locator("i")).toHaveCount(10);
  await expect(progresso.locator('i[data-visto="true"]')).toHaveCount(6);
  await expect(page.getByTestId("cartao-casa")).toContainText("6/10");
  await expect(page.getByRole("img", { name: "6 de 10 vistos na temporada 2" })).toBeVisible();

  // marcar acende mais um segmento
  await page.getByRole("button", { name: "Marcar visto" }).click();
  await expect(progresso.locator('i[data-visto="true"]')).toHaveCount(7);
  await expect(page.getByTestId("cartao-casa")).toContainText("7/10");
});

test("uma temporada de mais de 24 episódios é uma barra contínua, não 25 riscos", async ({
  page,
  tmdb,
}) => {
  await serieAMeio(page, tmdb, [25], 5);
  const progresso = page.getByTestId("progresso-casa");
  await expect(page.getByTestId("cartao-casa")).toContainText("5/25");
  await expect(progresso.locator("i")).toHaveCount(0);
});

test("com o texto a 150% num ecrã de 320, a arte sai do cartão e nada transborda", async ({
  page,
  tmdb,
}) => {
  await serieAMeio(page, tmdb, [9, 10], 6);
  await page.getByTestId("progresso-casa").locator("i").first().waitFor();
  const arte = page.getByTestId("cartao-casa").locator("a[aria-hidden]").first();
  await expect(arte).toBeVisible();
  await page.setViewportSize({ width: 320, height: 568 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "150%";
  });
  await expect(arte).toBeHidden();
  await expect(page.getByRole("heading", { level: 2, name: "Severance" })).toBeVisible();
  const titulo = page.getByRole("heading", { level: 1, name: "A seguir" });
  await expect(titulo).toBeVisible();
  // numa linha só: o «Pôr em dia» passa para baixo em vez de o espremer
  // («A / seguir», visto na captura da Fase 2)
  const { altura, linha } = await titulo.evaluate((el) => ({
    altura: el.getBoundingClientRect().height,
    linha: parseFloat(getComputedStyle(el).lineHeight),
  }));
  expect(altura).toBeLessThan(linha * 1.5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test("o aviso de anular é vidro, e «Anular» não é a cápsula da ação", async ({ page, tmdb }) => {
  await serieAMeio(page, tmdb, [9, 10], 6);
  await page.getByRole("button", { name: "Marcar visto" }).click();
  const anular = page.getByTestId("undo-button");
  await expect(anular).toBeVisible();
  // a cápsula da ação, à noite, é o cinza da mira (#e5e5ea — Fase 3)
  const ACAO = "rgb(229, 229, 234)";
  const fundo = await anular.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(fundo).not.toBe(ACAO);
  // e há uma só cápsula da ação à vista: o «Marcar visto»
  const acoes = await page.evaluate(
    (cor) =>
      [...document.querySelectorAll("button, a")].filter((el) => getComputedStyle(el).backgroundColor === cor)
        .length,
    ACAO,
  );
  expect(acoes).toBe(1);
});

test("a casa vazia é «sem sinal»: a mira, e as duas portas", async ({ page }) => {
  await semear(page, {});
  await page.goto("/series");
  await expect(page.getByRole("heading", { level: 1, name: "A seguir" })).toBeVisible();
  // a carta de teste: as sete barras em cima, e a fila de acerto por baixo
  await expect(page.getByTestId("mira-sem-sinal").locator("span")).toHaveCount(14);
  await expect(page.getByText("Ainda sem sinal.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Procurar uma série" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Importar/ })).toBeVisible();
});
