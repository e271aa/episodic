import { test, expect } from "./apoio/base";
import { semear } from "./apoio/semear";

/**
 * Ronda 12, Fase 5b.1 — achado #15 (AUDITORIA.md, Fase 4): duas datas
 * apareciam cruas em ISO ("2024-06-26"), nunca formatadas.
 */

const CRUA = /\d{4}-\d{2}-\d{2}/;

test("a última importação no Perfil não aparece em ISO cru", async ({ page }) => {
  await semear(page, { kv: { "import-meta": { importedAt: "2026-07-11T10:00:00.000Z" } } });
  await page.goto("/profile/definicoes");
  const texto = page.getByText(/Última importação/);
  await expect(texto).toBeVisible();
  await expect(texto).not.toHaveText(CRUA);
  await expect(texto).toContainText("11 de julho de 2026");
});

test("a data de um filme repetido, na verificação, não aparece em ISO cru", async ({ page }) => {
  await semear(page, {
    filmes: [
      { key: "tvtime-a", name: "Duna", tmdbId: 900, watchedAt: "2024-06-26T00:00:00.000Z" },
      { key: "tmdb-900", name: "Duna", tmdbId: 900, watchedAt: null },
    ],
  });
  await page.goto("/profile/definicoes");
  await page.getByRole("button", { name: "Verificar" }).click();
  const linha = page.locator('[data-testid="filmes-repetidos"] li').first();
  await expect(linha).toBeVisible();
  await expect(linha).not.toHaveText(CRUA);
  await expect(linha).toContainText("26 de junho de 2024");
});
