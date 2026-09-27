import type { Page } from "@playwright/test";

/**
 * A dock flutua sobre tudo, com um degradê de 110px por cima do conteúdo.
 * "Visível" não chega: um botão por baixo dela vê-se e não se pode tocar.
 */
export async function tapadoPelaDock(page: Page, seletor: string): Promise<boolean> {
  return page.evaluate((sel: string) => {
    const alvo = document.querySelector(sel);
    if (!alvo) throw new Error(`sem elemento para ${sel}`);
    const caixa = alvo.getBoundingClientRect();
    const emCima = document.elementFromPoint(
      caixa.left + caixa.width / 2,
      caixa.top + caixa.height / 2,
    );
    return !(emCima === alvo || alvo.contains(emCima));
  }, seletor);
}
