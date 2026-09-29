import { test, expect } from "./apoio/base";
import { semear, type EpisodioVisto } from "./apoio/semear";
import { serieCompleta } from "./apoio/tmdb";

/**
 * Ronda 12, Fecho — o que a crítica final (27/40, 14/20) encontrou e se
 * corrigiu. Cada teste foi visto a falhar antes da correção.
 */

// ── P1 #1: o A estrear colapsava ──
// A data por extenso vinha à direita com `shrink-0` e comia a linha: o nome
// ficava com 57px a 390px ("Grey's / Anato / my") e 0px a 320px.
for (const largura of [390, 320]) {
  test(`A estrear: o nome e o episódio leem-se inteiros a ${largura}px`, async ({ page, tmdb }) => {
    await page.setViewportSize({ width: largura, height: 664 });
    const daqui20 = new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10);
    const s = serieCompleta(700, "Grey's Anatomy", [8]);
    s.episodios["700:1"][7].air_date = daqui20;
    Object.assign(tmdb.series, s.series);
    Object.assign(tmdb.episodios, s.episodios);
    await semear(page, {
      series: [{ uuid: "s-1", name: "Grey's Anatomy", tmdbId: 700, numeracao: "tmdb", status: "Returning Series" }],
      vistos: [{ showUuid: "s-1", season: 1, episode: 1 }],
    });
    await page.goto("/estrear");
    const nome = page.getByText("Grey's Anatomy", { exact: true });
    await expect(nome).toBeVisible();
    // numa linha só: a altura de uma linha de texto, não três
    const caixa = (await nome.boundingBox())!;
    expect(caixa.height).toBeLessThan(30);
    // o código do episódio não fica cortado em "S01·E…"
    const codigo = page.getByText(/S01\s*·\s*E08/);
    await expect(codigo).toBeVisible();
    const cortado = await codigo.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(cortado).toBe(false);
  });
}

// ── P1 #2: o mapa de calor ──
function eps(uuid: string, ano: number, mes: number, quantos: number): EpisodioVisto[] {
  return Array.from({ length: quantos }, (_, i) => ({
    showUuid: uuid,
    season: ano - 2000,
    episode: mes * 100 + i + 1,
    watchedAt: `${ano}-${String(mes).padStart(2, "0")}-${String((i % 27) + 1).padStart(2, "0")}T20:00:00.000Z`,
  }));
}

test("mapa de calor: cada mês é um alvo de pelo menos 24px (WCAG 2.5.8)", async ({ page }) => {
  await semear(page, {
    series: [{ uuid: "s-a", name: "Alfa" }],
    vistos: [...eps("s-a", 2021, 3, 4), ...eps("s-a", 2022, 5, 2)],
  });
  await page.goto("/estatisticas");
  const celula = page.getByRole("button", { name: "março de 2021 · 4 episódios" });
  const caixa = (await celula.boundingBox())!;
  expect(caixa.width).toBeGreaterThanOrEqual(24);
  expect(caixa.height).toBeGreaterThanOrEqual(24);
});

test("mapa de calor: com meses parecidos, não fica tudo no degrau de cima", async ({ page }) => {
  // 12 meses entre 15 e 18 episódios — a biblioteca da crítica: com a escala
  // linear até ao máximo, eram todos degrau 3 ou 4, uma parede creme
  const vistos = [15, 16, 17, 18, 15, 16, 17, 18, 15, 16, 17, 18].flatMap((n, i) => eps("s-a", 2021, i + 1, n));
  await semear(page, { series: [{ uuid: "s-a", name: "Alfa" }], vistos });
  await page.goto("/estatisticas");
  const celulas = page.locator("section", { hasText: "Quando viste" }).locator("button[data-degrau]");
  // esperar pelo cartão: o evaluateAll não espera, e lia 0 células
  await expect(celulas).toHaveCount(12);
  const degraus = await celulas
    .evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-degrau"))));
  expect(degraus.filter((d) => d === 4).length).toBeLessThanOrEqual(4);
  expect(new Set(degraus).size).toBeGreaterThanOrEqual(3);
});

test("horas por ano: o destaque é o ano com mais horas, não o último", async ({ page }) => {
  await semear(page, {
    series: [{ uuid: "s-a", name: "Alfa", runtime: 60 }],
    vistos: [...eps("s-a", 2021, 3, 3), ...eps("s-a", 2022, 3, 1)],
  });
  await page.goto("/estatisticas");
  const cartao = page.locator("section", { hasText: "Horas por ano" });
  await expect(cartao.getByTestId("leitura")).toContainText("2021");
});
