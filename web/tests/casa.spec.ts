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
  await page.getByRole("heading", { level: 2, name: "Severance" }).waitFor();
}

test("por baixo do herói: outra série e o filme mais recente da lista, à vista", async ({
  page,
  tmdb,
}) => {
  await casa(page, tmdb);
  const ouEntao = page.getByTestId("ou-entao");
  await expect(ouEntao).toBeVisible();
  // o porquê e o episódio, à Mira: «Retomar · S01·E02»
  await expect(ouEntao.locator('a[href="/series/s-parada"]')).toContainText(/Retomar · S\d{2}·E\d{2}/);
  await expect(ouEntao.locator('a[href="/movies/f-novo"]')).toContainText("Past Lives");
  // o mais recente da lista, não um filme já visto nem o mais antigo
  await expect(ouEntao.locator('a[href="/movies/f-antigo"]')).toHaveCount(0);
  await expect(ouEntao.locator('a[href="/movies/f-visto"]')).toHaveCount(0);

  // Na primeira dobra (escolha do Ruben, 27-09). O cartão da Mira é mais alto
  // do que o herói da v2: num ecrã baixo (664px, o Safari com as barras) só o
  // título «Ou então» cabe acima da barra — diz que há mais. No iPhone dele
  // (15 Pro Max, 430×932, app instalada) cabe inteiro.
  const barra = async () => (await page.locator("nav > div.vidro").boundingBox())!;
  const titulo = (await ouEntao.getByRole("heading", { name: "Ou então" }).boundingBox())!;
  expect(titulo.y + titulo.height).toBeLessThanOrEqual((await barra()).y);
  await page.setViewportSize({ width: 430, height: 932 });
  await page.waitForTimeout(200);
  const caixa = (await ouEntao.boundingBox())!;
  expect(caixa.y + caixa.height).toBeLessThanOrEqual((await barra()).y);
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

test("a série do 'Ou então' não aparece outra vez na lista de baixo", async ({ page, tmdb }) => {
  // Escolhido pelo Ruben a 29-09: a mesma série duas vezes na casa lia-se
  // como um erro. Como o cartão grande, a que sobe para o «Ou então» sai da
  // secção de baixo — e a contagem da secção diz as que lá ficam.
  const series = [
    [510, "s-a", "Severance"],
    [511, "s-b", "The Bear"],
    [512, "s-c", "Andor"],
  ] as const;
  for (const [id, , nome] of series) {
    Object.assign(tmdb.series, serieCompleta(id, nome, [9]).series);
    Object.assign(tmdb.episodios, serieCompleta(id, nome, [9]).episodios);
  }
  // a ordem da fila é a da última marcação: A, depois B, depois C
  const quando = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
  await semear(page, {
    series: series.map(([id, uuid, name]) => ({ uuid, name, tmdbId: id, numeracao: "tmdb" as const })),
    vistos: series.map(([, uuid], i) => ({ showUuid: uuid, season: 1, episode: 1, watchedAt: quando(i + 1) })),
    kv: { "nextup-cache": Object.fromEntries(series.map(([, uuid], i) => [uuid, proximo(quando(i + 1))])) },
  });
  await page.goto("/series");
  await page.getByRole("heading", { level: 2, name: "Severance" }).waitFor();

  await expect(page.getByTestId("ou-entao").locator('a[href="/series/s-b"]')).toBeVisible();
  await expect(page.locator('main a[href="/series/s-b"]')).toHaveCount(1);
  await expect(page.locator('main a[href="/series/s-c"]')).toHaveCount(1);
  await expect(page.getByRole("heading", { name: /^Continuar/ })).toContainText("1");
});
