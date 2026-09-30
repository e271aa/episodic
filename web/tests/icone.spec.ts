import { test, expect } from "./apoio/base";

/**
 * Ronda 14, Fase 12 — a Fase 2b: o ícone é a carta de teste da casa vazia
 * («Sem sinal»), o único desenho que só esta app tem. Até aqui era o da v1,
 * um triângulo de play âmbar sobre azul-noite.
 *
 * Lê-se o que o iPhone instala (o `apple-touch-icon` do `<head>`) e o que o
 * manifesto declara, e prova-se pelas cores em sítios certos: a barra amarela
 * em cima, a azul à direita, e na fila de acerto o azul à esquerda.
 */

const HEX = { cinza: [0xe5, 0xe5, 0xea], amarelo: [0xff, 0xd6, 0x0a], azul: [0x0a, 0x84, 0xff], magenta: [0xda, 0x5c, 0xe8] };

async function amostra(page: import("@playwright/test").Page, src: string) {
  return page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext("2d")!;
    g.drawImage(img, 0, 0);
    const em = (fx: number, fy: number) => [...g.getImageData(Math.floor(fx * c.width), Math.floor(fy * c.height), 1, 1).data];
    // coluna n (1–7) ao centro; em cima a 40% da altura, a fila de acerto a 90%
    const col = (n: number) => (n - 0.5) / 7;
    return {
      largura: c.width,
      altura: c.height,
      cinzaEmCima: em(col(1), 0.4),
      amareloEmCima: em(col(2), 0.4),
      azulEmCima: em(col(7), 0.4),
      azulEmBaixo: em(col(1), 0.9),
      magentaEmBaixo: em(col(3), 0.9),
    };
  }, src);
}

const perto = (px: number[], cor: number[]) => cor.every((v, i) => Math.abs(px[i] - v) <= 6) && px[3] === 255;

test("o ícone que o iPhone instala é a carta de teste, sem transparência", async ({ page }) => {
  await page.goto("/login");
  const href = await page.locator('link[rel="apple-touch-icon"]').first().getAttribute("href");
  expect(href).toBeTruthy();
  const a = await amostra(page, href!);
  expect(a.largura).toBe(180);
  expect(perto(a.cinzaEmCima, HEX.cinza), `cinza ${a.cinzaEmCima}`).toBe(true);
  expect(perto(a.amareloEmCima, HEX.amarelo), `amarelo ${a.amareloEmCima}`).toBe(true);
  expect(perto(a.azulEmCima, HEX.azul), `azul ${a.azulEmCima}`).toBe(true);
  expect(perto(a.azulEmBaixo, HEX.azul), `acerto azul ${a.azulEmBaixo}`).toBe(true);
  expect(perto(a.magentaEmBaixo, HEX.magenta), `acerto magenta ${a.magentaEmBaixo}`).toBe(true);
});

test("os ícones do manifesto (192 e 512) são o mesmo desenho", async ({ page }) => {
  await page.goto("/login");
  const manifesto = await (await page.request.get("/manifest.webmanifest")).json();
  const srcs = [...new Set((manifesto.icons as { src: string }[]).map((i) => i.src))];
  expect(srcs.length).toBeGreaterThan(0);
  for (const src of srcs) {
    const a = await amostra(page, src);
    expect(a.largura).toBe(a.altura);
    expect(perto(a.amareloEmCima, HEX.amarelo), `${src}: amarelo ${a.amareloEmCima}`).toBe(true);
    expect(perto(a.azulEmBaixo, HEX.azul), `${src}: acerto azul ${a.azulEmBaixo}`).toBe(true);
  }
});
