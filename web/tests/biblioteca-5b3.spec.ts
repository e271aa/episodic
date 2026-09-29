import { test, expect } from "./apoio/base";
import { semear } from "./apoio/semear";

/**
 * Ronda 12, Fase 5b.3 — achado #12 e a parte das Listas do #10
 * (AUDITORIA.md, Fase 4). Escolhido pelo Ruben (27-09): a Biblioteca abre em
 * 3 colunas, com o título à vista; as Listas passam a 3.º separador. E os
 * filmes "para ver" deixam de ficar escondidos: "Filmes 14" mostrava 10.
 */

const SERIES = Array.from({ length: 9 }, (_, i) => ({
  uuid: `s-${i}`,
  name: `Serie ${i}`,
  totalEpisodes: 10,
}));

test("a Biblioteca abre em 3 colunas, com o título à vista", async ({ page }) => {
  await semear(page, { series: SERIES });
  await page.goto("/library");
  const titulo = page.getByRole("heading", { level: 1, name: "Biblioteca" });
  await expect(titulo).toBeVisible();
  expect((await titulo.boundingBox())!.height).toBeGreaterThan(20);

  // com secções, a grelha vive dentro de cada uma; sem secções, é o próprio
  // contentor
  const grelha = page
    .locator('[data-testid="library-grid"].grid, [data-testid="library-grid"] .grid')
    .first();
  await grelha.waitFor();
  const colunas = await grelha.evaluate(
    (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
  );
  expect(colunas).toBe(3);
});

test("os filmes 'para ver' aparecem por omissão, e o número bate certo", async ({ page }) => {
  await semear(page, {
    filmes: [
      { key: "f-1", name: "Visto Um", watchedAt: "2024-01-01T00:00:00.000Z" },
      { key: "f-2", name: "Visto Dois", watchedAt: "2024-02-01T00:00:00.000Z" },
      { key: "f-3", name: "Visto Tres", watchedAt: "2024-03-01T00:00:00.000Z" },
      { key: "f-4", name: "Guardado Um", watchedAt: null },
      { key: "f-5", name: "Guardado Dois", watchedAt: null },
    ],
  });
  await page.goto("/library?tipo=filmes");
  await expect(page.getByRole("radio", { name: /^Filmes/ })).toContainText("5");
  for (const nome of ["Visto Um", "Visto Tres", "Guardado Um", "Guardado Dois"])
    await expect(page.locator("p", { hasText: nome }).first()).toBeVisible();
});

test("as Listas são o terceiro separador da Biblioteca", async ({ page }) => {
  await semear(page, {
    series: SERIES,
    listas: [{ id: "l-1", name: "Fim de semana", items: [{ kind: "show", refId: "s-1" }] }],
  });
  await page.goto("/library");
  await page.getByRole("radio", { name: /^Listas/ }).click();
  await expect(page).toHaveURL(/tipo=listas/);
  await page.getByRole("link", { name: /Fim de semana/ }).click();
  await expect(page).toHaveURL(/\/listas\/l-1$/);
});

test("/listas leva ao separador das Listas", async ({ page }) => {
  await semear(page, { listas: [{ id: "l-1", name: "Fim de semana" }] });
  await page.goto("/listas");
  await expect(page).toHaveURL(/\/library\?tipo=listas$/);
  await expect(page.getByRole("link", { name: /Fim de semana/ })).toBeVisible();
});

test("com três separadores, o controlo segmentado cabe a 320px", async ({ page }) => {
  // com os números do Ruben (138 · 266 · 3): são eles que apertam a linha
  await page.setViewportSize({ width: 320, height: 700 });
  await semear(page, {
    series: Array.from({ length: 138 }, (_, i) => ({ uuid: `s-${i}`, name: `Serie ${i}` })),
    filmes: Array.from({ length: 266 }, (_, i) => ({ key: `f-${i}`, name: `Filme ${i}` })),
    listas: [1, 2, 3].map((n) => ({ id: `l-${n}`, name: `Lista ${n}` })),
  });
  await page.goto("/library");
  for (const nome of [/^Séries/, /^Filmes/, /^Listas/]) {
    const separador = page.getByRole("radio", { name: nome });
    await separador.waitFor();
    // uma linha só — "Séries 138" partido em dois seria a avaria
    expect((await separador.boundingBox())!.height).toBeLessThan(50);
  }
  const grupo = (await page.getByRole("radiogroup", { name: "Tipo de biblioteca" }).boundingBox())!;
  expect(grupo.x + grupo.width).toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
