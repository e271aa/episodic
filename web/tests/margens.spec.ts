import { test, expect } from "./apoio/base";
import { SEM_LETRA_DO_IPHONE, RAZAO_SEM_LETRA } from "./apoio/letra";
import { semear } from "./apoio/semear";

/**
 * Ronda 14, Fase 11 — o que o iPhone mostrou e a sonda não viu: margens das
 * faixas e frases cortadas em estados raros. Só comportamento medido.
 */

function sugestoes(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: 900 + i,
    name: `Sugestao ${i + 1}`,
    poster_path: "/cartaz.jpg",
    backdrop_path: null,
    overview: "",
    first_air_date: "2021-01-01",
    vote_average: 7,
  }));
}

test("as faixas do Explorar abrem com a margem de 16px à esquerda, também depois de assentarem", async ({
  page,
  tmdb,
}) => {
  tmdb.tendencias = sugestoes(8);
  await semear(page, {});
  await page.goto("/explorar");
  await page.getByText("Em tendência").waitFor();
  // o `scroll-snap` obrigatório alinha o primeiro cartaz ao bordo da faixa e
  // come o padding: no iPhone o primeiro cartaz ficava colado ao ecrã
  await page.waitForTimeout(600);
  const esquerda = await page.evaluate(() =>
    Array.from(document.querySelectorAll("section .snap-x")).map((faixa) => ({
      scroll: faixa.scrollLeft,
      primeiro: faixa.firstElementChild!.getBoundingClientRect().left,
    })),
  );
  expect(esquerda.length).toBeGreaterThan(0);
  for (const f of esquerda) {
    expect(f.scroll).toBe(0);
    expect(f.primeiro).toBeGreaterThanOrEqual(15);
  }
});

test("«A seguir» sem nenhuma série seguida explica-se por inteiro, sem reticências", async ({ page }) => {
  test.skip(SEM_LETRA_DO_IPHONE, RAZAO_SEM_LETRA);
  // só uma que deixaste de seguir: a fila está vazia porque nada é seguido
  await semear(page, {
    series: [{ uuid: "s-1", name: "Lanterns", followed: false, inWatchlist: false }],
  });
  await page.goto("/series");
  const linha = page.getByRole("link", { name: /Ainda não segues nenhuma série/ });
  await expect(linha).toBeVisible();
  const cortado = await linha.evaluate((el) =>
    Array.from(el.querySelectorAll("span")).some(
      (s) => getComputedStyle(s).textOverflow === "ellipsis" && s.scrollWidth > s.clientWidth + 1,
    ),
  );
  expect(cortado).toBe(false);
  await expect(linha).toContainText("Segue uma e ela entra aqui");
});

test("o título de cada separador começa à mesma altura (a área segura da PWA vale 0)", async ({ page }) => {
  // Medido no iPhone: A seguir, Explorar e Biblioteca a 20px do topo da janela, o
  // Perfil a 40. Perto do topo as letras ficavam «no limite»; o Perfil, demasiado
  // abaixo. Uma altura só, a meio.
  await semear(page, { series: [{ uuid: "s-1", name: "Severance", followed: true }] });
  const topos: Record<string, number> = {};
  for (const [nome, url] of [
    ["a-seguir", "/series"],
    ["explorar", "/explorar"],
    ["biblioteca", "/library"],
    ["perfil", "/profile"],
  ] as const) {
    await page.goto(url);
    await page.locator("h1").waitFor();
    topos[nome] = await page.evaluate(() => {
      const cabecalho = document.querySelector("header")!;
      return Math.round((cabecalho.firstElementChild as HTMLElement).getBoundingClientRect().top);
    });
  }
  const valores = Object.values(topos);
  expect(Math.max(...valores) - Math.min(...valores), JSON.stringify(topos)).toBeLessThanOrEqual(1);
  expect(Math.min(...valores)).toBeGreaterThanOrEqual(28);
});

test("a barra compacta do título não existe (nem desfoca) enquanto não aparece", async ({ page }) => {
  await semear(page, {
    series: Array.from({ length: 30 }, (_, i) => ({ uuid: `s-${i}`, name: `Serie ${i}` })),
  });
  await page.goto("/library");
  await page.locator('a[href="/series/s-29"]').waitFor();
  const visibilidade = await page.evaluate(
    () => getComputedStyle(document.querySelector(".vidro.fixed.top-0")!).visibility,
  );
  expect(visibilidade).toBe("hidden");
  // e aparece ao rolar
  await page.evaluate(() => window.scrollTo(0, 600));
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.querySelector(".vidro.fixed.top-0")!).visibility))
    .toBe("visible");
});
