import { test, expect } from "./apoio/base";
import { semear } from "./apoio/semear";

/**
 * Ronda 12, Fase 5b.3 — achado #10 (AUDITORIA.md, Fase 4): havia quatro
 * formas de recuar, três delas texto no canto superior direito, longe do
 * polegar; e a dock acendia pelo tipo do ecrã, não por onde se tinha vindo.
 * O DESIGN.md já decidia as duas coisas: recuar é o círculo de 44px com
 * seta; a navegação desfaz-se, não se empurra.
 */

const SEMENTE = {
  series: [{ uuid: "s-1", name: "Serie Um", totalEpisodes: 10 }],
  vistos: [{ showUuid: "s-1", season: 1, episode: 1 }],
  listas: [{ id: "l-1", name: "Uma lista", items: [{ kind: "show" as const, refId: "s-1" }] }],
};

for (const [rota, rotulo] of [
  ["/estrear", "Voltar a A seguir"],
  ["/rever", "Voltar ao perfil"],
  ["/estatisticas", "Voltar ao perfil"],
  ["/profile/definicoes", "Voltar ao perfil"],
  ["/listas/l-1", "Voltar às listas"],
] as const) {
  test(`${rota}: recuar é o círculo de 44px, em cima à esquerda`, async ({ page }) => {
    await semear(page, SEMENTE);
    await page.goto(rota);
    const voltar = page.getByRole("button", { name: rotulo });
    await expect(voltar).toBeVisible();
    const caixa = (await voltar.boundingBox())!;
    expect(caixa.x).toBeLessThan(40);
    // 43,99999…: a caixa no ecrã passa por um transform de entrada e vem
    // com resto de subpíxel — o círculo tem os 44px certos
    expect(caixa.width).toBeGreaterThan(43.9);
    expect(caixa.height).toBeGreaterThan(43.9);
    // o círculo com seta, não um texto ("← Listas", "Perfil") — o nome vem
    // do aria-label, a seta é o que se vê
    expect((await voltar.textContent())?.trim()).toBe("");
  });
}

test("uma série aberta a partir da Biblioteca acende a Biblioteca na dock", async ({
  page,
}) => {
  await semear(page, SEMENTE);
  await page.goto("/library");
  await page.locator('a[href="/series/s-1"]').first().click();
  await expect(page).toHaveURL(/\/series\/s-1$/);
  await expect(page.locator('nav a[href="/library"]')).toHaveAttribute("aria-current", "page");
  await expect(page.locator('nav a[href="/series"]')).not.toHaveAttribute("aria-current", "page");
});

test("aberta de raiz (sem origem), uma série acende A seguir e um filme a Biblioteca", async ({
  page,
}) => {
  await semear(page, {
    ...SEMENTE,
    filmes: [{ key: "f-1", name: "Um Filme", watchedAt: "2024-01-01T00:00:00.000Z" }],
  });
  await page.goto("/series/s-1");
  await expect(page.locator('nav a[href="/series"]')).toHaveAttribute("aria-current", "page");
  await page.goto("/movies/f-1");
  await expect(page.locator('nav a[href="/library"]')).toHaveAttribute("aria-current", "page");
});
