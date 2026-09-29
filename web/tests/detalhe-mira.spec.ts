import { test, expect } from "./apoio/base";
import { semear, type EpisodioVisto } from "./apoio/semear";

/**
 * Ronda 14, Fase 4 — o detalhe da série na Mira (B·2a, B·2b, B·E5).
 *
 * Uma coluna só: a temporada em curso abre sozinha, o Sobre e as
 * estatísticas vivem no «···», e o cartão dos buracos pergunta por eles
 * pelo nome e tem um «Um a um» que abre o Pôr em dia desta série.
 */

const TVMAZE = 495;

/** Duas temporadas (9 e 10). `sem` são os episódios da T2 que ficam por ver. */
async function severance(
  page: import("@playwright/test").Page,
  tmdb: { tvmaze: Record<number, number[]> },
  vistosT2: number[],
) {
  tmdb.tvmaze[TVMAZE] = [9, 10];
  const vistos: EpisodioVisto[] = [];
  for (let e = 1; e <= 9; e++) vistos.push({ showUuid: "s-1", season: 1, episode: e });
  for (const e of vistosT2) vistos.push({ showUuid: "s-1", season: 2, episode: e });
  await semear(page, {
    series: [{ uuid: "s-1", name: "Severance", tvmazeId: TVMAZE, numeracao: "tvmaze", totalEpisodes: 19 }],
    vistos,
  });
  await page.goto("/series/s-1");
  await page.getByTestId("temporadas").waitFor();
}

test("a temporada em curso abre sozinha, e tocar nela outra vez não a fecha", async ({
  page,
  tmdb,
}) => {
  await severance(page, tmdb, [1, 2, 3, 4, 5, 6]);
  // «qual é o próximo?» responde-se sem tocar em nada
  await expect(page.getByTestId("ep-2-7")).toBeVisible();
  await expect(page.getByTestId("season-2")).toHaveAttribute("aria-pressed", "true");

  await page.getByTestId("season-2").click();
  await expect(page.getByTestId("ep-2-7")).toBeVisible();

  // a T1 está toda vista: aparece numa corrida só
  await page.getByTestId("season-1").click();
  await expect(page.getByTestId("corrida-1-1-9")).toBeVisible();
  await expect(page.getByTestId("ep-2-7")).toHaveCount(0);
});

test("o «···» leva ao Sobre e às estatísticas da série", async ({ page, tmdb }) => {
  await severance(page, tmdb, [1, 2, 3, 4, 5, 6]);
  await page.getByTestId("menu-serie").click();
  const folha = page.getByRole("dialog");
  await folha.getByRole("button", { name: /^Sobre/ }).click();
  await expect(folha.locator("#painel-sobre")).toContainText("Episódios");

  await folha.getByRole("button", { name: "Opções" }).click();
  await folha.getByRole("button", { name: /^Estatísticas/ }).click();
  await expect(folha.locator("#painel-estatisticas")).toContainText("15");
  await expect(folha.locator("#painel-estatisticas")).toContainText("19");
});

test("arquivar pelo «···» tira a série do A seguir, e anula-se", async ({ page, tmdb }) => {
  await severance(page, tmdb, [1, 2, 3, 4, 5, 6]);
  await page.getByTestId("menu-serie").click();
  await page.getByRole("button", { name: /^Arquivar/ }).click();
  await expect(page.getByTestId("undo-toast")).toContainText("Arquivada");

  await page.getByTestId("menu-serie").click();
  await expect(page.getByRole("button", { name: /^Tirar do arquivo/ })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByTestId("undo-toast").getByRole("button", { name: "Anular" }).click();
  await page.getByTestId("menu-serie").click();
  await expect(page.getByRole("button", { name: /^Arquivar/ })).toBeVisible();
});

test("poucos buracos numa temporada: a pergunta nomeia-os um a um", async ({ page, tmdb }) => {
  await severance(page, tmdb, [1, 2, 3, 7, 8]);
  const cartao = page.getByTestId("aviso-buracos");
  await expect(cartao).toContainText("Viste o E04, o E05 e o E06 da T2?");
  await expect(page.getByTestId("marcar-buracos")).toHaveText("Sim, vi os três");
  await expect(page.getByTestId("estado-serie")).toContainText("3 por marcar");
});

test("«Um a um» abre o Pôr em dia desta série e marca só os que se dizem vistos", async ({
  page,
  tmdb,
}) => {
  await severance(page, tmdb, [1, 2, 3, 7, 8]);
  await page.getByTestId("um-a-um").click();
  await expect(page).toHaveURL(/\/em-dia\?serie=s-1/);
  await expect(page.getByText("1 de 3")).toBeVisible();

  await page.getByRole("button", { name: "Vi — marcar como visto" }).click();
  await expect(page.getByText("2 de 3")).toBeVisible();
  await page.getByRole("button", { name: "Ainda não — deixar por marcar" }).click();
  await expect(page.getByText("3 de 3")).toBeVisible();
  await page.getByRole("button", { name: "Vi — marcar como visto" }).click();
  await expect(page.getByTestId("um-a-um-fim")).toContainText("2 marcados");

  // o E05 ficou por marcar; o E04 e o E06 não
  await page.goto("/series/s-1");
  await expect(page.getByTestId("estado-serie")).toContainText("1 por marcar");
  await expect(page.getByTestId("aviso-buracos")).toContainText("Viste o E05 da T2?");
});
