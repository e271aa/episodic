import { test, expect } from "./apoio/base";
import { semear } from "./apoio/semear";

/**
 * Ronda 12, Fase 5b.1 — achado #16 (AUDITORIA.md, Fase 4): 82px de scroll
 * fantasma em três ecrãs que definem a própria altura em `100dvh`. A causa:
 * vivem dentro do wrapper do layout raiz, que reserva `--dock-h + 0.5rem`
 * por baixo de TODO o conteúdo — e um ecrã que já reserva a sua própria
 * altura fica com esse respiro a mais, duas vezes.
 */

async function medir(page: import("@playwright/test").Page) {
  return page.evaluate(() => ({
    doc: document.documentElement.scrollHeight,
    janela: innerHeight,
  }));
}

test("o Explorar não tem scroll fantasma", async ({ page }) => {
  await semear(page, {});
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/explorar");
  await page.waitForTimeout(800);
  const { doc, janela } = await medir(page);
  expect(doc).toBeLessThanOrEqual(janela + 1);
});

test("o Pôr em dia não tem scroll fantasma", async ({ page }) => {
  await semear(page, {
    series: [{ uuid: "s-1", name: "Serie" }],
    kv: {
      "nextup-cache": {
        "s-1": { episode: { season: 1, episode: 1, name: "Um", airDate: "2020-01-01" }, lastWatchedAt: null },
      },
    },
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/em-dia");
  await page.waitForTimeout(500);
  const { doc, janela } = await medir(page);
  expect(doc).toBeLessThanOrEqual(janela + 1);
});

test("o Entrar não tem scroll fantasma", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await page.waitForTimeout(300);
  const { doc, janela } = await medir(page);
  expect(doc).toBeLessThanOrEqual(janela + 1);
});
