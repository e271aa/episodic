import { test, expect } from "./apoio/base";
import { semear } from "./apoio/semear";
import { tapadoPelaDock } from "./apoio/geometria";

/**
 * Ronda 5 — o que só se vê com a app na mão.
 *
 * Estes três não se veem a ler código: são geometria (o que tapa o quê, o que
 * fica fora do ecrã) e por isso são medidos, não inspecionados.
 */

const HOJE = new Date().toISOString();


test("os botões do Pôr em dia ficam por cima da dock, não por baixo", async ({ page }) => {
  await semear(page, {
    series: [{ uuid: "s-ativa", name: "Serie Ativa" }],
    vistos: [{ showUuid: "s-ativa", season: 1, episode: 1, watchedAt: HOJE }],
    kv: {
      "nextup-cache": {
        "s-ativa": {
          episode: { season: 1, episode: 2, name: "Segundo", airDate: "2020-01-08" },
          lastWatchedAt: HOJE,
        },
      },
    },
  });
  await page.goto("/em-dia");

  const marcar = page.getByRole("button", { name: "Marcar como visto" });
  await expect(marcar).toBeVisible();

  // Estar "visível" não chega: o degradê da dock é um elemento a sério e
  // ficava por cima destes botões. Ser visível e não se poder tocar é a
  // avaria que não aparece em nenhuma captura de ecrã.
  expect(await tapadoPelaDock(page, '[aria-label="Marcar como visto"]')).toBe(false);
  expect(await tapadoPelaDock(page, '[aria-label="Saltar — ainda não vi"]')).toBe(false);
});

test("o menu de filtro abre dentro do ecrã, mesmo depois de a página ter rolado", async ({ page }) => {
  await semear(page, {
    series: Array.from({ length: 30 }, (_, i) => ({
      uuid: `s-${i}`,
      name: `Serie ${i}`,
    })),
  });
  await page.goto("/library");
  await page.locator('a[href="/series/s-29"]').waitFor();
  // rola-se até ao fundo e volta-se ao filtro
  await page.evaluate(() => window.scrollTo(0, 2000));
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole("button", { name: /^Filtrar séries/ }).click();

  const menu = page.getByRole("menu", { name: "Filtrar séries" });
  const caixa = await menu.boundingBox();
  const ecra = page.viewportSize()!;
  expect(caixa).not.toBeNull();
  expect(caixa!.y).toBeGreaterThanOrEqual(0);
  expect(caixa!.y + caixa!.height).toBeLessThanOrEqual(ecra.height);
  expect(caixa!.x + caixa!.width).toBeLessThanOrEqual(ecra.width);
});

test("o Explorar abre em grelha, não no baralho", async ({ page, tmdb }) => {
  tmdb.tendencias = [1, 2, 3].map((n) => ({
    id: 700 + n,
    name: `Tendencia ${n}`,
    poster_path: "/cartaz.jpg",
    backdrop_path: null,
    overview: "",
    first_air_date: "2022-01-01",
  }));

  await semear(page, {});
  await page.goto("/explorar");

  // Vê-se tudo de uma vez; o baralho continua lá, num toque.
  await expect(page.getByText("Em alta esta semana")).toBeVisible();
  await expect(page.getByText("arrasta ou decide aqui")).toHaveCount(0);
});
