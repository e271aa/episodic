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

test("na Biblioteca, a barra de uma série a meio é neutra e a de uma em dia é verde — nunca ciano", async ({
  page,
}) => {
  await semear(page, {
    series: [
      { uuid: "s-curso", name: "Em Curso", totalEpisodes: 10, status: "Returning Series" },
      { uuid: "s-dia", name: "Em Dia", totalEpisodes: 1, status: "Returning Series" },
    ],
    vistos: [
      { showUuid: "s-curso", season: 1, episode: 1 },
      { showUuid: "s-dia", season: 1, episode: 1 },
    ],
  });
  await page.goto("/library");
  const cor = (uuid: string) =>
    page
      .locator(`a[href="/series/${uuid}"] [style*="width"]`)
      .evaluate((el) => getComputedStyle(el).backgroundColor);

  // a meio de ver: só progresso, sem cor de estado (o `label`, branco à noite)
  expect(await cor("s-curso")).toBe("rgb(255, 255, 255)");
  // em dia, e a série continua: o verde do estado (#30d158)
  expect(await cor("s-dia")).toBe("rgb(48, 209, 88)");
  // e os cabeçalhos das secções não levam cor nenhuma
  const cores = await page
    .getByRole("heading", { level: 2, name: /Em curso|Completas/ })
    .first()
    .evaluate((h) =>
      [...(h.parentElement?.querySelectorAll("*") ?? [])]
        .map((el) => getComputedStyle(el).backgroundColor)
        .filter((c) => c !== "rgba(0, 0, 0, 0)"),
    );
  expect(cores).toEqual([]);
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
  const barra = page.locator('a[href="/series/s-completa"] [style*="width"]').first();
  await barra.waitFor();
  const sombra = await barra.evaluate((el) => getComputedStyle(el).boxShadow);
  expect(sombra).toBe("none");
});
