import { test, expect } from "./apoio/base";
import { semear } from "./apoio/semear";

/**
 * Duas apanhas da sonda do `/qualidade-movel` (Ronda 8), medidas antes de
 * corrigir e verificadas depois. Nenhuma delas era grave — a primeira só
 * afeta quem abre no Safari sem a PWA instalada, a segunda é 4px numa
 * beira — mas as duas são exatamente o tipo de coisa que nenhuma captura de
 * ecrã denuncia.
 */

test("a dica de instalar a PWA não tapa os controlos da Biblioteca", async ({ page }) => {
  await semear(page, { series: [{ uuid: "s-1", name: "Serie Um" }] });
  // Ao contrário dos outros testes, este quer a dica VISÍVEL — é o cenário
  // que a reproduz. `semear` dispensa-a por omissão; aqui repõe-se de propósito.
  await page.evaluate(() => localStorage.removeItem("episodic-ios-install-dismissed"));
  await page.goto("/library");
  await expect(page.getByText("Instala o Episodic")).toBeVisible();

  // Visível não é o mesmo que tocável — a dica flutuava por cima com o
  // mesmo z-index da barra, e ganhava por vir depois no DOM.
  const filtros = page.getByRole("button", { name: "Filtros e ordenação" });
  await filtros.click();
  await expect(page.getByRole("dialog", { name: "Filtros e ordenação" })).toBeVisible();
});

test("os botões 'cartões'/'grelha' não roubam toques um ao outro", async ({ page }) => {
  await semear(page, {});
  await page.goto("/explorar");

  const cartoes = page.getByRole("button", { name: "Ver em cartões, um a um" });
  const caixa = (await cartoes.boundingBox())!;

  // Um toque na própria beira direita do botão "cartões" tem de ativar
  // "cartões" — antes, essa faixa pertencia à área invisível (44px) do
  // vizinho "grelha", que vinha depois no DOM e ganhava o toque.
  await page.mouse.click(caixa.x + caixa.width - 2, caixa.y + caixa.height / 2);
  await expect(cartoes).toHaveAttribute("aria-pressed", "true");
});
