import { test, expect } from "./apoio/base";
import { semear } from "./apoio/semear";

/**
 * Ronda 14, Fase 12 — o que só servia para construir a Mira sai antes de ela
 * ir para o `main`: a vitrine `/mira` (dados de exemplo) e `/diagnostico` (a
 * leitura da PWA no iPhone, feita a 30-09), com a sua entrada nas Definições.
 */

for (const rota of ["/mira", "/diagnostico"]) {
  test(`${rota} já não existe`, async ({ page }) => {
    const r = await page.goto(rota);
    expect(r?.status()).toBe(404);
  });
}

test("as Definições já não levam ao diagnóstico", async ({ page }) => {
  await semear(page, {});
  await page.goto("/profile/definicoes");
  await expect(page.getByRole("heading", { level: 2, name: "Aparência" })).toBeVisible();
  await expect(page.getByText(/Diagnóstico/)).toHaveCount(0);
  await expect(page.locator('a[href="/diagnostico"]')).toHaveCount(0);
});
