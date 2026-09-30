import { test, expect } from "./apoio/base";
import { semear } from "./apoio/semear";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * O nome é «Flicki» (30-09), também no que fica gravado no aparelho: a base
 * `flicki` (era `tvlog`) e as preferências `flicki:pref:` (eram `episodic:pref:`).
 * A base antiga não se apaga — fica sem uso — e a biblioteca volta da nuvem.
 */

test("o aparelho vê «Flicki»: manifesto, título, nome na PWA instalada", async ({ page }) => {
  const manifesto = await (await page.request.get("/manifest.webmanifest")).json();
  expect(manifesto.name).toBe("Flicki");
  expect(manifesto.short_name).toBe("Flicki");

  await semear(page, {});
  await page.goto("/profile/definicoes");
  expect(await page.title()).toMatch(/Flicki/);
  expect(await page.title()).not.toMatch(/Episodic/);
  const nomeNaPwa = await page.locator('meta[name="apple-mobile-web-app-title"]').getAttribute("content");
  expect(nomeNaPwa).toBe("Flicki");
  const app = await page.locator('meta[name="application-name"]').getAttribute("content");
  expect(app).toBe("Flicki");
});

test("a palavra «flicki» segue o modo: clara à noite, escura de dia, sem cor fixa", async ({ page }) => {
  await semear(page, {});
  const luz = async (modo: "dark" | "light") => {
    await page.emulateMedia({ colorScheme: modo });
    await page.goto("/profile/definicoes");
    const palavra = page.getByRole("img", { name: "Flicki" });
    await expect(palavra).toBeVisible();
    return palavra.evaluate((el) => {
      const [r, g, b] = getComputedStyle(el).color.match(/[\d.]+/g)!.map(Number);
      return (r + g + b) / 3;
    });
  };
  expect(await luz("dark")).toBeGreaterThan(200);
  expect(await luz("light")).toBeLessThan(100);
});

test("as Definições já não dizem «Episodic»", async ({ page }) => {
  await semear(page, {});
  await page.goto("/profile/definicoes");
  await expect(page.getByText("os teus dados vivem neste dispositivo")).toBeVisible();
  await expect(page.getByText(/Episodic/)).toHaveCount(0);
});

test("o ícone é a «barra premida»: a 4.ª barra desce, com o espaço por cima escuro", async ({ page }) => {
  await page.goto("/login");
  const href = await page.locator('link[rel="apple-touch-icon"]').first().getAttribute("href");
  const pixeis = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src!;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext("2d")!;
    g.drawImage(img, 0, 0);
    const em = (col: number, fy: number) => [...g.getImageData(Math.floor(((col - 0.5) / 7) * c.width), Math.floor(fy * c.height), 1, 1).data];
    return { cimaDaQuarta: em(4, 0.04), meioDaQuarta: em(4, 0.4), sobreAFila: em(4, 0.8), baixoDaQuarta: em(4, 0.95), cimaDaTerceira: em(3, 0.04) };
  }, href);
  const perto = (px: number[], rgb: number[]) => rgb.every((v, i) => Math.abs(px[i] - v) <= 6);
  expect(perto(pixeis.cimaDaQuarta, [0x0b, 0x0b, 0x0d]), `cima ${pixeis.cimaDaQuarta}`).toBe(true);
  expect(perto(pixeis.meioDaQuarta, [0x30, 0xd1, 0x58]), `meio ${pixeis.meioDaQuarta}`).toBe(true);
  expect(perto(pixeis.sobreAFila, [0x30, 0xd1, 0x58]), `desce ${pixeis.sobreAFila}`).toBe(true);
  expect(perto(pixeis.baixoDaQuarta, [0x0b, 0x0b, 0x0d]), `fundo ${pixeis.baixoDaQuarta}`).toBe(true);
  // as outras barras não descem: a terceira começa em cima, em ciano
  expect(perto(pixeis.cimaDaTerceira, [0x64, 0xd2, 0xff]), `terceira ${pixeis.cimaDaTerceira}`).toBe(true);
});

test("a carta da casa vazia é o mesmo desenho do ícone, com a barra premida", async ({ page }) => {
  await semear(page, {});
  await page.goto("/series");
  const carta = page.getByTestId("mira-sem-sinal");
  await expect(carta).toBeVisible();
  const cores = await carta.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const col = (n: number) => r.left + ((n - 0.5) / 7) * r.width;
    const fundo = (n: number, fy: number) => {
      const topo = document.elementsFromPoint(col(n), r.top + fy * r.height).find((e) => el.contains(e) && e !== el);
      return topo ? getComputedStyle(topo).backgroundColor : "?";
    };
    return { cimaDaQuarta: fundo(4, 0.04), sobreAFila: fundo(4, 0.8), cimaDaTerceira: fundo(3, 0.04) };
  });
  expect(cores.cimaDaQuarta).toBe("rgb(11, 11, 13)");
  expect(cores.sobreAFila).toBe("rgb(48, 209, 88)");
  expect(cores.cimaDaTerceira).toBe("rgb(100, 210, 255)");
});

test("nada gravado no aparelho fala do nome antigo: base «flicki», preferências «flicki:pref:»", async ({ page }) => {
  await page.goto("/series");
  await page.getByRole("link", { name: "Procurar uma série" }).waitFor();
  const bases = await page.evaluate(async () => (await indexedDB.databases()).map((b) => b.name));
  expect(bases).toContain("flicki");
  expect(bases).not.toContain("tvlog");

  await page.goto("/profile/definicoes");
  await page.getByRole("radio", { name: "Claro" }).click();
  await page.goBack();
  const chaves = await page.evaluate(() => Object.keys(localStorage));
  expect(chaves.filter((k) => /episodic|tvlog/i.test(k))).toEqual([]);
});

test("o service worker usa caches «flicki-…»", async ({ page }) => {
  const sw = await (await page.request.get("/sw.js")).text();
  expect(sw).toContain("flicki-app-");
  expect(sw).not.toMatch(/episodic|tvlog/i);
});

test("o código já não tem o nome antigo em lado nenhum (nem nas chaves gravadas)", () => {
  const ficheiros = (d: string): string[] =>
    readdirSync(d).flatMap((n) => {
      const p = join(d, n);
      return statSync(p).isDirectory() ? ficheiros(p) : /\.(tsx?|css|js)$/.test(n) ? [p] : [];
    });
  const maus: string[] = [];
  for (const f of [...ficheiros("src"), "public/sw.js"])
    readFileSync(f, "utf8")
      .split("\n")
      .forEach((l, i) => {
        if (/tvlog|episodic/i.test(l)) maus.push(`${f}:${i + 1}: ${l.trim().slice(0, 80)}`);
      });
  expect(maus).toEqual([]);
});
