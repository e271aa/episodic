import type { Page } from "@playwright/test";
import { test, expect } from "./apoio/base";
import { semear } from "./apoio/semear";

/**
 * Ronda 5 — o que só se vê com a app na mão.
 *
 * Estes três não se veem a ler código: são geometria (o que tapa o quê, o que
 * fica fora do ecrã) e por isso são medidos, não inspecionados.
 */

const HOJE = new Date().toISOString();

/** A dock flutua sobre tudo, com um degradê de 110px por cima do conteúdo. */
async function tapadoPelaDock(page: Page, seletor: string): Promise<boolean> {
  return page.evaluate((sel: string) => {
    const alvo = document.querySelector(sel);
    if (!alvo) throw new Error(`sem elemento para ${sel}`);
    const caixa = alvo.getBoundingClientRect();
    const emCima = document.elementFromPoint(
      caixa.left + caixa.width / 2,
      caixa.top + caixa.height / 2,
    );
    return !(emCima === alvo || alvo.contains(emCima));
  }, seletor);
}

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

test("o painel de filtros abre por cima do ecrã, mesmo com a página a meio", async ({
  page,
}) => {
  await semear(page, {
    series: Array.from({ length: 30 }, (_, i) => ({
      uuid: `s-${i}`,
      name: `Serie ${i}`,
    })),
  });
  await page.goto("/library");
  await page.locator('a[href="/series/s-29"]').waitFor();
  await page.evaluate(() => window.scrollTo(0, 2000));

  await page.getByRole("button", { name: "Filtros e ordenação" }).click();

  // `position: fixed` dentro de um antepassado com `transform` deixa de ser
  // relativo ao ecrã e passa a sê-lo à página — o painel abria no sítio certo
  // de um ecrã que já não estava à vista, a 2000px de scroll daqui.
  const painel = page.getByRole("dialog", { name: "Filtros e ordenação" });
  const caixa = await painel.boundingBox();
  const ecra = page.viewportSize()!;
  expect(caixa).not.toBeNull();
  expect(caixa!.y).toBeGreaterThanOrEqual(0);
  expect(caixa!.y).toBeLessThan(ecra.height);
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
