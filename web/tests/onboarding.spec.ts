import { test, expect } from "./apoio/base";
import { semear } from "./apoio/semear";

/**
 * Ronda 12, Fase 5c — P1 #6 da crítica 5b.4 (AUDITORIA.md): o primeiro uso
 * de um amigo.
 *
 * "Procurar uma série" ficava desbotado pelo degradê da dock e "Vens do TV
 * Time?" debaixo dela. A guarda da Fase 5 (`tapadoPelaDock`) só olha para o
 * ponto do meio, e o degradê deixa passar o toque — por isso passava. Aqui
 * mede-se contra o topo do degradê. E o texto: "Toca em Seguir" sem dizer
 * que o Seguir está na pesquisa (os cartazes do Explorar não o têm), e nada
 * para quem já vai a meio de uma série.
 */

test("no primeiro uso, as duas portas ficam acima do degradê da dock", async ({ page }) => {
  await semear(page, {});
  await page.goto("/series");
  const procurar = page.getByRole("link", { name: "Procurar uma série" });
  await expect(procurar).toBeVisible();

  const degrade = await page.locator("nav > div[aria-hidden]").boundingBox();
  for (const porta of [procurar, page.getByRole("link", { name: /Importar/ })]) {
    const caixa = (await porta.boundingBox())!;
    expect(caixa.y + caixa.height).toBeLessThanOrEqual(degrade!.y);
  }
});

test("o onboarding diz onde está o Seguir, e o que fazer a meio de uma série", async ({
  page,
}) => {
  await semear(page, {});
  await page.goto("/series");
  // Mira (Ronda 14): os quatro passos deram lugar a «Ainda sem sinal.» e a
  // uma nota curta — que continua a dizer o que a 5c exigiu
  const dicas = page.getByTestId("dicas-primeiro-uso");
  await expect(dicas).toContainText("pesquisa");
  await expect(dicas).toContainText("Seguir");
  await expect(dicas).toContainText("Já vais a meio");
});

test("o passo 02 é verdade: marcar só o último que se viu oferece os de trás", async ({
  page,
  tmdb,
}) => {
  // Um amigo segue uma série que já vai no 5.º episódio. Marca esse, e só
  // esse — a app não o obriga a marcar os quatro de trás um a um, nem os
  // marca por ele: oferece-se. E o próximo passa a ser o 6.º, não o 1.º.
  tmdb.tvmaze[495] = [10];
  await semear(page, {
    series: [{ uuid: "s-1", name: "Severance", tvmazeId: 495, numeracao: "tvmaze" }],
  });
  await page.goto("/series/s-1");
  await page.getByTestId("temporadas").waitFor();
  const quinto = page.getByTestId("ep-1-5");
  if (!(await quinto.isVisible())) await page.getByTestId("season-1").click();
  await quinto.click();

  await expect(page.getByTestId("aviso-buracos")).toContainText(
    "Viste os 4 que ficaram para trás?",
  );
  await expect(page.getByTestId("marcar-buracos")).toBeVisible();
  await expect(page.getByTestId("mark-next")).toHaveAccessibleName("Marcar S01·E06");
});
