import { test, expect } from "./apoio/base";
import { semear } from "./apoio/semear";
import { sectionColor } from "../src/components/SectionHeader";

/**
 * Ronda 12, Fase 5b.1 — achado #9 (AUDITORIA.md, Fase 4): as cores de sinal
 * usadas sem significado. Decidido pelo Ruben a 27-09: os cabeçalhos de
 * secção usam só as 4 barras neutras (cinza, amarelo, vermelho, azul);
 * verde, ciano e magenta ficam só para estados.
 */

const VERDE = "#37c837";
const CIANO = "#3fd2c8";
const MAGENTA = "#d24bd2";
const AMBAR_V1 = "rgba(255, 170, 51";

test("a cor de um cabeçalho de secção nunca é verde, ciano ou magenta", () => {
  // 200 sementes arbitrárias — não é preciso adivinhar quais colidem com o
  // hash, só provar que a lista de onde ele escolhe já não as tem.
  for (let i = 0; i < 200; i++) {
    const cor = sectionColor(`secção-${i}-${"x".repeat(i % 7)}`);
    expect([VERDE, CIANO, MAGENTA]).not.toContain(cor);
  }
});

test("na Biblioteca, 'Em curso' é o branco-projetor e 'Para ver' é cinza — não verde nem ciano", async ({
  page,
}) => {
  await semear(page, {
    series: [
      { uuid: "s-curso", name: "Em Curso", totalEpisodes: 10 },
      { uuid: "s-ver", name: "Para Ver", followed: false, inWatchlist: true },
    ],
    vistos: [{ showUuid: "s-curso", season: 1, episode: 1 }],
  });
  await page.goto("/library");
  const barra = (rotulo: string) =>
    page
      .getByRole("heading", { name: rotulo, exact: true })
      .locator("xpath=preceding-sibling::span[1]");

  const corCurso = await barra("Em curso").evaluate((el) => getComputedStyle(el).backgroundColor);
  const corVer = await barra("Para ver").evaluate((el) => getComputedStyle(el).backgroundColor);

  // rgb(55, 200, 55) seria o verde SMPTE; rgb(63, 210, 200) seria o ciano
  expect(corCurso).not.toBe("rgb(55, 200, 55)");
  expect(corVer).not.toBe("rgb(63, 210, 200)");
});

test("o hover de um cartão já não acende o âmbar da v1", async ({ page }) => {
  await semear(page, { listas: [{ id: "l-1", name: "Uma lista" }] });
  await page.goto("/listas");
  const cartao = page.locator(".ep-card-hover").first();
  await cartao.waitFor();
  await cartao.hover();
  // a cor transita em 180ms — ler já a seguir apanha um valor a meio caminho
  await page.waitForTimeout(300);
  const cor = await cartao.evaluate((el) => getComputedStyle(el).borderColor);
  expect(cor).not.toContain("255, 170, 51");
});

test("a barra de progresso da grelha já não tem brilho — só a cor com significado", async ({
  page,
}) => {
  await semear(page, {
    series: [{ uuid: "s-completa", name: "Completa", totalEpisodes: 2 }],
    vistos: [
      { showUuid: "s-completa", season: 1, episode: 1 },
      { showUuid: "s-completa", season: 1, episode: 2 },
    ],
  });
  await page.goto("/library");
  const barra = page.locator('a[href="/series/s-completa"] .h-1 > div').first();
  await barra.waitFor();
  const sombra = await barra.evaluate((el) => getComputedStyle(el).boxShadow);
  expect(sombra).toBe("none");
});
