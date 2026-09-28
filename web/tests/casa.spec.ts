import { test, expect } from "./apoio/base";
import { semear } from "./apoio/semear";
import { serieCompleta } from "./apoio/tmdb";

/**
 * Ronda 12, Fase 5b.3 — achado #7 (AUDITORIA.md, Fase 4): a casa dava uma
 * resposta só, escolhida pela última marcação, e os filmes "para ver" nunca
 * entravam. Escolhido pelo Ruben (27-09, variante C): o herói fica; por
 * baixo do "Marcar visto", "Ou então" com outra série e um filme da lista.
 */

const HOJE = new Date().toISOString();
const HA_60_DIAS = new Date(Date.now() - 60 * 864e5).toISOString();
const proximo = (lastWatchedAt: string) => ({
  episode: { season: 1, episode: 2, name: "Dois", airDate: "2020-01-01" },
  lastWatchedAt,
});

async function casa(
  page: import("@playwright/test").Page,
  tmdb: import("./apoio/tmdb").Catalogo,
  { comFilme = true, comOutraSerie = true } = {},
) {
  for (const [id, nome] of [
    [500, "Severance"],
    [501, "Greys Anatomy"],
  ] as const) {
    Object.assign(tmdb.series, serieCompleta(id, nome, [9]).series);
    Object.assign(tmdb.episodios, serieCompleta(id, nome, [9]).episodios);
  }
  await semear(page, {
    series: [
      { uuid: "s-ativa", name: "Severance", tmdbId: 500, numeracao: "tmdb" },
      ...(comOutraSerie
        ? [{ uuid: "s-parada", name: "Greys Anatomy", tmdbId: 501, numeracao: "tmdb" as const }]
        : []),
    ],
    vistos: [
      { showUuid: "s-ativa", season: 1, episode: 1, watchedAt: HOJE },
      ...(comOutraSerie ? [{ showUuid: "s-parada", season: 1, episode: 1, watchedAt: HA_60_DIAS }] : []),
    ],
    filmes: comFilme
      ? [
          { key: "f-antigo", name: "Filme Antigo", watchedAt: null, addedAt: "2024-01-01T00:00:00.000Z" },
          { key: "f-novo", name: "Past Lives", watchedAt: null, addedAt: "2026-09-01T00:00:00.000Z" },
          { key: "f-visto", name: "Filme Visto", watchedAt: HOJE },
        ]
      : [],
    kv: {
      "nextup-cache": {
        "s-ativa": proximo(HOJE),
        ...(comOutraSerie ? { "s-parada": proximo(HA_60_DIAS) } : {}),
      },
    },
  });
  await page.goto("/series");
  await page.getByRole("heading", { level: 1, name: "Severance" }).waitFor();
}

test("por baixo do herói: outra série e o filme mais recente da lista, à vista", async ({
  page,
  tmdb,
}) => {
  await casa(page, tmdb);
  const ouEntao = page.getByTestId("ou-entao");
  await expect(ouEntao).toBeVisible();
  await expect(ouEntao.locator('a[href="/series/s-parada"]')).toContainText("retomar");
  await expect(ouEntao.locator('a[href="/movies/f-novo"]')).toContainText("Past Lives");
  // o mais recente da lista, não um filme já visto nem o mais antigo
  await expect(ouEntao.locator('a[href="/movies/f-antigo"]')).toHaveCount(0);
  await expect(ouEntao.locator('a[href="/movies/f-visto"]')).toHaveCount(0);

  // na primeira dobra, acima da dock — não enterrado por baixo dela
  const caixa = (await ouEntao.boundingBox())!;
  const dock = (await page.locator("nav").boundingBox())!;
  expect(caixa.y + caixa.height).toBeLessThanOrEqual(dock.y);
});

test("tocar numa alternativa abre-a — não marca nada", async ({ page, tmdb }) => {
  await casa(page, tmdb);
  await page.getByTestId("ou-entao").locator('a[href="/series/s-parada"]').click();
  await expect(page).toHaveURL(/\/series\/s-parada$/);
});

test("sem filme para ver nem outra série, não há 'Ou então'", async ({ page, tmdb }) => {
  await casa(page, tmdb, { comFilme: false, comOutraSerie: false });
  await expect(page.getByTestId("ou-entao")).toHaveCount(0);
});
