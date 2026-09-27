import { test, expect } from "./apoio/base";
import { semear } from "./apoio/semear";

/**
 * Ronda 12, Fase 5 — os P1 de acessibilidade da auditoria (Fase 4).
 * Nenhum destes se vê numa captura de ecrã: um botão que só aparece com o
 * rato, um aviso que o VoiceOver não lê, um campo sem nome.
 */

const LISTA = {
  series: [
    { uuid: "s-1", name: "Serie Um" },
    { uuid: "s-2", name: "Serie Dois" },
  ],
  listas: [
    {
      id: "l-1",
      name: "A minha lista",
      items: [
        { kind: "show" as const, refId: "s-1" },
        { kind: "show" as const, refId: "s-2" },
      ],
    },
  ],
};

test("remover da lista vê-se num ecrã tátil, sem hover", async ({ page }) => {
  // Estava a `opacity-0` até haver hover — num telemóvel nunca aparecia, e
  // um toque no canto da capa apagava o item sem se ver porquê (medido: a
  // lista passou de 3 para 2).
  await semear(page, LISTA);
  await page.goto("/listas/l-1");
  const remover = page.getByRole("button", { name: "Remover Serie Um da lista" });
  await expect(remover).toBeAttached();
  const opacidade = await remover.evaluate((b) => Number(getComputedStyle(b).opacity));
  expect(opacidade).toBe(1);
});

test("o aviso de anular é anunciado, e a região já existe antes dele", async ({ page }) => {
  // Sem `role="status"`, o VoiceOver não dizia que se tinha removido nada
  // (WCAG 4.1.3). E uma região que nasce já com o texto dentro muitas vezes
  // não é lida — tem de estar lá, vazia, antes.
  await semear(page, LISTA);
  await page.goto("/listas/l-1");
  const regiao = page.getByRole("status");
  await expect(regiao).toHaveCount(1);
  await expect(regiao).toHaveAttribute("aria-live", "polite");

  await page.getByRole("button", { name: "Remover Serie Um da lista" }).click();
  await expect(regiao).toContainText("Removido da lista");

  // e o "Anular" chega aos 44px que o PRODUCT.md pede para um alvo de toque
  // (altura de layout: a caixa no ecrã mede menos durante a entrada, que
  // anima com `scale`)
  const altura = await page
    .getByRole("button", { name: "Anular" })
    .evaluate((b) => (b as HTMLElement).offsetHeight);
  expect(altura).toBeGreaterThanOrEqual(44);
});

test("renomear uma lista é um botão, e o campo tem nome", async ({ page }) => {
  // O título era um <h1> com onClick — sem teclado nem leitor de ecrã — e o
  // campo que abria não tinha nome acessível (WCAG 4.1.2).
  await semear(page, LISTA);
  await page.goto("/listas/l-1");
  await page.getByRole("button", { name: "Renomear a lista A minha lista" }).click();
  const campo = page.getByRole("textbox", { name: "Nome da lista" });
  await expect(campo).toBeFocused();
  await campo.fill("Para o fim de semana");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Para o fim de semana");
});
