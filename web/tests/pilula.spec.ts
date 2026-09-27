import { test, expect } from "./apoio/base";
import { semear } from "./apoio/semear";

/**
 * Ronda 12, Fase 5b.3 — achado #8 (AUDITORIA.md, Fase 4): a pílula branca
 * devia marcar a ação principal do ecrã, e estava em todo o lado — um "Para
 * ver" branco em cada cartaz do Explorar, o separador ativo da Biblioteca
 * por cima do item ativo da dock. Escolhido pelo Ruben (27-09, variante A):
 * "Para ver" passa a contorno, uma seleção passa a painel levantado, a dock
 * fica branca.
 */

const BRANCO = "rgb(245, 243, 238)";
const fundo = (loc: import("@playwright/test").Locator) =>
  loc.evaluate((el) => getComputedStyle(el).backgroundColor);

test("no Explorar, 'Para ver' é contorno, não uma pílula branca", async ({ page, tmdb }) => {
  tmdb.multi = [
    {
      id: 603,
      media_type: "movie",
      title: "Matrix",
      original_title: "The Matrix",
      release_date: "1999-03-31",
      poster_path: "/cartaz.jpg", // a pesquisa descarta resultados sem capa
      overview: "",
    },
  ];
  await semear(page, {});
  await page.goto("/explorar?procurar=1");
  await page.locator('input[type="search"]').fill("matrix");
  const paraVer = page.getByRole("button", { name: "Para ver" }).first();
  await paraVer.waitFor();
  expect(await fundo(paraVer)).not.toBe(BRANCO);
});

test("na Biblioteca, o separador ativo não é branco — a dock é", async ({ page }) => {
  await semear(page, { series: [{ uuid: "s-1", name: "Serie Um" }] });
  await page.goto("/library");
  const separador = page.getByRole("button", { name: /^Séries/ });
  await expect(separador).toHaveAttribute("aria-pressed", "true");
  // a transição de cor dura 150ms — esperar que assente antes de ler
  await page.waitForTimeout(300);
  expect(await fundo(separador)).not.toBe(BRANCO);
  expect(await fundo(page.locator('nav a[aria-current="page"]'))).toBe(BRANCO);
});

test("uma escolha na folha de filtros não é uma pílula branca", async ({ page }) => {
  await semear(page, { series: [{ uuid: "s-1", name: "Serie Um" }] });
  await page.goto("/library");
  await page.getByRole("button", { name: "Filtros e ordenação" }).click();
  const escolhida = page.getByRole("dialog").getByRole("button", { name: /^Tudo/ });
  await escolhida.waitFor();
  await page.waitForTimeout(300);
  expect(await fundo(escolhida)).not.toBe(BRANCO);
});

test("no Pôr em dia, o filtro escolhido não é uma pílula branca", async ({ page }) => {
  await semear(page, {
    series: [{ uuid: "s-1", name: "Serie Um" }],
    kv: {
      "nextup-cache": {
        "s-1": { episode: { season: 1, episode: 1, name: "Um", airDate: "2020-01-01" }, lastWatchedAt: null },
      },
    },
  });
  await page.goto("/em-dia");
  const escolhido = page.getByRole("button", { name: /^Por começar/ });
  await expect(escolhido).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(300);
  expect(await fundo(escolhido)).not.toBe(BRANCO);
});
