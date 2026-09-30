import { test, expect } from "./apoio/base";
import { semear } from "./apoio/semear";

/**
 * Duas apanhas da sonda do `/qualidade-movel` (Ronda 8), medidas antes de
 * corrigir e verificadas depois. Nenhuma delas era grave — a primeira só
 * afeta quem abre no Safari sem a PWA instalada, a segunda é 4px numa
 * beira — mas as duas são exatamente o tipo de coisa que nenhuma captura de
 * ecrã denuncia.
 */

test("a dica de instalar a PWA não tapa nada: vive no fluxo da casa, por baixo das portas", async ({
  page,
}) => {
  await semear(page, {});
  // Ao contrário dos outros testes, este quer a dica VISÍVEL — é o cenário
  // que a reproduz. `semear` dispensa-a por omissão; aqui repõe-se de propósito.
  await page.evaluate(() => localStorage.removeItem("episodic-ios-install-dismissed"));
  await page.goto("/series");
  const dica = page.getByTestId("dica-instalar");
  await expect(dica).toBeVisible();
  // Flutuava (`fixed`) por cima de qualquer ecrã: na Biblioteca tapava os
  // filtros (Ronda 8) e na casa vazia da Mira as duas portas (Fase 3). Agora
  // está no fluxo, depois das portas — e as portas apanham o toque.
  let el: import("@playwright/test").ElementHandle<HTMLElement | SVGElement> | null = await dica.elementHandle();
  while (el) {
    const pos = await el.evaluate((n) => getComputedStyle(n).position);
    expect(pos).not.toBe("fixed");
    el = (await el.evaluateHandle((n) => n.parentElement)).asElement() as typeof el;
  }
  const importar = page.getByRole("link", { name: /Importar/ });
  const caixaDica = (await dica.boundingBox())!;
  const caixaImportar = (await importar.boundingBox())!;
  expect(caixaDica.y).toBeGreaterThanOrEqual(caixaImportar.y + caixaImportar.height);
  await page.getByRole("link", { name: "Procurar uma série" }).click();
  await expect(page).toHaveURL(/explorar/);
  // e na Biblioteca já não aparece
  await page.goto("/library");
  await expect(page.getByTestId("dica-instalar")).toHaveCount(0);
});
