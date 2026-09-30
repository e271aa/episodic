import { test, expect } from "./apoio/base";
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
  // só «Para ver»: a fila está vazia porque nada foi seguido
  await semear(page, {
    series: [{ uuid: "s-1", name: "Lanterns", followed: false, inWatchlist: true }],
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
  await expect(linha).toContainText("fica fora da fila");
});
