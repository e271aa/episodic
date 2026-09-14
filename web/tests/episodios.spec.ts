import { test, expect } from "./apoio/base";
import { semear } from "./apoio/semear";

/**
 * Fase 2 da Ronda 11 — a lista de episódios cabe num ecrã.
 *
 * Medido no Naruto: T2 dava 3609px de documento, 51 linhas quase idênticas,
 * 5,5 ecrãs até ao primeiro buraco. O que colapsa é o que já foi visto; o
 * que fica aberto é o que quebra a sequência — os buracos, e o ponto onde a
 * série ainda não foi vista.
 */

const TVMAZE = 495;

async function serieCom(
  page: import("@playwright/test").Page,
  tmdb: { tvmaze: Record<number, number[]> },
  episodios: number,
  vistos: number[],
) {
  tmdb.tvmaze[TVMAZE] = [episodios];
  await semear(page, {
    series: [
      {
        uuid: "s-1",
        name: "Serie Longa",
        tvmazeId: TVMAZE,
        numeracao: "tvmaze",
        totalEpisodes: episodios,
      },
    ],
    vistos: vistos.map((episode) => ({ showUuid: "s-1", season: 1, episode })),
  });
  await page.goto("/series/s-1");
  await page.getByTestId("season-1").click();
}

test("uma corrida de vistos colapsa, o buraco no meio fica aberto", async ({ page, tmdb }) => {
  // 1–19 vistos, 20–41 por marcar, 42–51 vistos — o caso do Naruto T2, à escala.
  const vistos = [
    ...Array.from({ length: 19 }, (_, i) => i + 1),
    ...Array.from({ length: 10 }, (_, i) => i + 42),
  ];
  await serieCom(page, tmdb, 51, vistos);

  await expect(page.getByTestId("corrida-1-1-19")).toContainText("19 episódios vistos");
  await expect(page.getByTestId("corrida-1-42-51")).toContainText("10 episódios vistos");

  // O buraco fica aberto, linha a linha: é o que interessa ver.
  await expect(page.getByTestId("ep-1-20")).toBeVisible();
  await expect(page.getByTestId("ep-1-41")).toBeVisible();
  expect(await page.locator('[data-testid^="ep-1-"]').count()).toBe(22);
});

test("tocar na corrida abre os episódios lá dentro, e fecha outra vez", async ({ page, tmdb }) => {
  await serieCom(page, tmdb, 10, Array.from({ length: 10 }, (_, i) => i + 1));

  const corrida = page.getByTestId("corrida-1-1-10");
  await expect(corrida).toBeVisible();
  await expect(page.getByTestId("ep-1-1")).toHaveCount(0);

  await corrida.click();
  await expect(page.getByTestId("ep-1-1")).toBeVisible();
  await expect(page.getByTestId("ep-1-10")).toBeVisible();
  await expect(page.getByTestId("corrida-1-1-10")).toHaveCount(0);

  await page.getByRole("button", { name: /Fechar E01–E10/ }).click();
  await expect(page.getByTestId("corrida-1-1-10")).toBeVisible();
  await expect(page.getByTestId("ep-1-1")).toHaveCount(0);
});

test("visto e por ver distinguem-se sem depender só do círculo", async ({ page, tmdb }) => {
  // Alternados de propósito: nenhuma corrida chega a 4, tudo fica individual.
  await serieCom(page, tmdb, 6, [1, 3, 5]);

  const visto = page.getByTestId("ep-1-1");
  const porVer = page.getByTestId("ep-1-2");

  await expect(visto).toHaveClass(/opacity-60/);
  await expect(porVer).not.toHaveClass(/opacity-60/);
  await expect(visto.locator("span.block").first()).toHaveClass(/text-dim/);
  await expect(porVer.locator("span.block").first()).toHaveClass(/font-medium/);
});

test("o cabeçalho da temporada fica fixo ao rolar a lista", async ({ page, tmdb }) => {
  await serieCom(page, tmdb, 60, Array.from({ length: 50 }, (_, i) => i + 1));

  const cabecalho = page.getByText("Temporada 1", { exact: true });
  await expect(cabecalho).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, 1000));
  // Sem `sticky`, o cabeçalho tinha subido com o resto do conteúdo — muito
  // acima do topo do ecrã, ou fora dele. Fixo, fica colado perto de y=0.
  await expect(cabecalho).toBeVisible();
  const topo = await cabecalho.evaluate((el) => el.getBoundingClientRect().top);
  expect(topo).toBeGreaterThanOrEqual(0);
  expect(topo).toBeLessThan(40);
});
