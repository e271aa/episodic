import { test, expect } from "./apoio/base";
import { semear, type EpisodioVisto } from "./apoio/semear";

/**
 * Ronda 12, Fase 7 — os gráficos novos das Estatísticas, vistos no ecrã.
 * O que se desenha sai de `graficos.ts` (testado à parte); aqui vê-se que o
 * ecrã o mostra, que se lê ao toque e que a tabela diz o mesmo.
 */
function eps(uuid: string, ano: number, mes: number, quantos: number): EpisodioVisto[] {
  return Array.from({ length: quantos }, (_, i) => ({
    showUuid: uuid,
    season: ano - 2000,
    episode: mes * 100 + i + 1,
    watchedAt: `${ano}-${String(mes).padStart(2, "0")}-${String((i % 27) + 1).padStart(2, "0")}T20:00:00.000Z`,
  }));
}

async function semearVarios(page: import("@playwright/test").Page) {
  await semear(page, {
    series: [
      { uuid: "s-a", name: "Alfa" },
      { uuid: "s-b", name: "Beta" },
      { uuid: "s-c", name: "Gama" },
    ],
    vistos: [
      ...eps("s-a", 2021, 3, 8),
      ...eps("s-a", 2021, 4, 2),
      ...eps("s-b", 2022, 3, 4),
      ...eps("s-c", 2022, 9, 1),
    ],
  });
}

test("mapa de calor: um mês por célula, o mais forte à cabeça, e a tabela diz o mesmo", async ({ page }) => {
  await semearVarios(page);
  await page.goto("/estatisticas");
  const mapa = page.locator("section", { hasText: "Quando viste" });
  const forte = mapa.getByRole("button", { name: "março de 2021 · 8 episódios" });
  await expect(forte).toHaveAttribute("data-degrau", "4");
  await expect(mapa.getByRole("button", { name: "abril de 2021 · 2 episódios" })).toHaveAttribute("data-degrau", "1");
  // ao abrir, a leitura já mostra o mês mais forte
  await expect(mapa.getByTestId("leitura")).toContainText("março de 2021");
  // tocar noutro mês passa a leitura para ele
  await mapa.getByRole("button", { name: "março de 2022 · 4 episódios" }).click();
  await expect(mapa.getByTestId("leitura")).toContainText("março de 2022");
  await mapa.locator("summary", { hasText: "Ver em tabela" }).click();
  await expect(mapa.locator("table")).toContainText("2021");
});

test("as séries mais vistas: por ordem, e cada uma leva à sua página", async ({ page }) => {
  await semearVarios(page);
  await page.goto("/estatisticas");
  const cartao = page.locator("section", { hasText: "As séries que mais viste" });
  const ligacoes = cartao.getByRole("link");
  await expect(ligacoes).toHaveCount(3);
  await expect(ligacoes.nth(0)).toContainText("Alfa");
  await expect(ligacoes.nth(0)).toContainText("10");
  await expect(ligacoes.nth(1)).toContainText("Beta");
  await expect(ligacoes.nth(2)).toContainText("Gama");
  await expect(ligacoes.nth(0)).toHaveAttribute("href", /s-a/);
});

test("horas por ano: aparecem com mais de um ano e dizem que são estimadas", async ({ page }) => {
  await semear(page, {
    series: [
      { uuid: "s-a", name: "Alfa", runtime: 60 },
    ],
    vistos: [...eps("s-a", 2021, 3, 3), ...eps("s-a", 2022, 3, 2)],
  });
  await page.goto("/estatisticas");
  const cartao = page.locator("section", { hasText: "Horas por ano" });
  await expect(cartao).toContainText("Estimadas");
  await cartao.getByRole("button", { name: /2021/ }).click();
  await expect(cartao.getByTestId("leitura")).toContainText("3");
});

test("horas por ano: com um só ano não há gráfico", async ({ page }) => {
  await semear(page, {
    series: [{ uuid: "s-a", name: "Alfa", runtime: 60 }],
    vistos: eps("s-a", 2021, 3, 3),
  });
  await page.goto("/estatisticas");
  await expect(page.getByText("Horas por ano")).toHaveCount(0);
});

test("dia da semana: o preferido fica em destaque e a leitura diz qual é", async ({ page }) => {
  await semearVarios(page);
  await page.goto("/estatisticas");
  const cartao = page.locator("section", { hasText: "Dia da semana" });
  await expect(cartao.getByTestId("leitura")).toBeVisible();
  await expect(cartao.getByRole("button")).toHaveCount(7);
});
