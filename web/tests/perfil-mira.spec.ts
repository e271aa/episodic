import { test, expect } from "./apoio/base";
import { semear, type EpisodioVisto } from "./apoio/semear";

/**
 * Ronda 14, Fase 7 — o Perfil da Mira (B·5): «quanto já vi?» em widgets de
 * tamanhos diferentes. Aqui vê-se o que o ecrã diz e faz, não como se pinta.
 */

/** n episódios de uma série num dia certo (12h UTC: o mesmo dia em qualquer fuso) */
function eps(uuid: string, dia: string, n: number, desde = 1): EpisodioVisto[] {
  return Array.from({ length: n }, (_, i) => ({
    showUuid: uuid,
    season: 1,
    episode: desde + i,
    watchedAt: `${dia}T12:00:00.000Z`,
  }));
}

test("o Perfil abre com o título, a linha de identidade que leva às Definições e o Tempo de antena", async ({
  page,
}) => {
  await semear(page, {
    series: [{ uuid: "s-a", name: "Alfa", runtime: 60 }],
    vistos: eps("s-a", "2021-03-07", 3),
  });
  await page.goto("/profile");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Perfil");
  const antena = page.locator("section", { hasText: "Tempo de antena" });
  // 3 × 60 min: o número grande, em horas, e por baixo dito por extenso
  await expect(antena).toContainText("3 h");
  await expect(antena).toContainText("0 dias e 3 horas");

  await page.getByRole("link", { name: /Definições|importado|Desde/ }).click();
  await expect(page).toHaveURL(/\/profile\/definicoes$/);
});

test("a Aparência vive nas Definições, não no Perfil", async ({ page }) => {
  await semear(page, {});
  await page.goto("/profile");
  await expect(page.getByRole("radiogroup", { name: "Aparência" })).toHaveCount(0);
  await page.goto("/profile/definicoes");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Definições");
  await expect(page.getByRole("radiogroup", { name: "Aparência" })).toBeVisible();
  // e recuar volta ao Perfil
  await page.getByRole("button", { name: "Voltar ao perfil" }).click();
  await expect(page).toHaveURL(/\/profile$/);
});

test("os três contadores: séries, episódios com milhares separados, e filmes; cada um leva à biblioteca", async ({
  page,
}) => {
  await semear(page, {
    series: [
      { uuid: "s-a", name: "Alfa", followed: true },
      { uuid: "s-b", name: "Beta", followed: true },
    ],
    filmes: [{ key: "f-1", name: "Filme", watchedAt: "2024-05-04T21:00:00.000Z" }],
    vistos: eps("s-a", "2021-03-07", 1200),
  });
  await page.goto("/profile");
  const series = page.getByRole("link", { name: /séries/ });
  await expect(series).toContainText("2");
  await expect(series).toContainText("2 seguidas");
  await expect(series).toHaveAttribute("href", "/library");
  // 1200 lê-se «1 200», como no desenho, e não «1200»
  await expect(page.getByText("1 200", { exact: true })).toBeVisible();
  const filmes = page.getByRole("link", { name: /filme/ });
  await expect(filmes).toContainText("1");
  await expect(filmes).toHaveAttribute("href", "/library?tipo=filmes");
});

test("as barras por ano do Tempo de antena dizem que são estimadas", async ({
  page,
}) => {
  await semear(page, {
    series: [{ uuid: "s-a", name: "Alfa", runtime: 60 }],
    vistos: [...eps("s-a", "2021-03-07", 3), ...eps("s-a", "2022-03-07", 2, 10)],
  });
  await page.goto("/profile");
  const barras = page.getByRole("img", { name: /Horas por ano/ });
  await expect(barras).toBeVisible();
  await expect(barras).toHaveAccessibleName(/estimad/);
  await expect(barras).toHaveAccessibleName(/2021/);
  await expect(page.getByText("por ano · estimado")).toBeVisible();
});

test("com um só ano de histórico, o Tempo de antena não desenha barras", async ({ page }) => {
  await semear(page, {
    series: [{ uuid: "s-a", name: "Alfa", runtime: 60 }],
    vistos: eps("s-a", "2021-03-07", 3),
  });
  await page.goto("/profile");
  await expect(page.locator("section", { hasText: "Tempo de antena" })).toContainText("3 h");
  await expect(page.getByRole("img", { name: /Horas por ano/ })).toHaveCount(0);
});

test("«Por mês» está no Perfil: a leitura fixa abre no mês mais forte, tocar troca-a, e a tabela diz o mesmo", async ({
  page,
}) => {
  await semear(page, {
    series: [{ uuid: "s-a", name: "Alfa" }],
    vistos: [...eps("s-a", "2021-03-07", 8), ...eps("s-a", "2021-04-07", 2, 20), ...eps("s-a", "2022-03-07", 4, 40)],
  });
  await page.goto("/profile");
  const mapa = page.locator("section", { hasText: "Por mês" });
  await expect(mapa.getByTestId("leitura")).toContainText("março de 2021 · 8 episódios");
  await mapa.getByRole("button", { name: "março de 2022 · 4 episódios" }).click();
  await expect(mapa.getByTestId("leitura")).toContainText("março de 2022");
  await mapa.locator("summary", { hasText: "Ver em tabela" }).click();
  await expect(mapa.locator("table")).toContainText("2021");
  // as Estatísticas já não o repetem
  await page.goto("/estatisticas");
  await expect(page.getByText("Por mês")).toHaveCount(0);
});

test("no «Por mês», os meses que ainda não chegaram não são botões", async ({ page }) => {
  const agora = new Date();
  const ano = agora.getFullYear();
  await semear(page, {
    series: [{ uuid: "s-a", name: "Alfa" }],
    vistos: eps("s-a", `${ano}-01-05`, 3),
  });
  await page.goto("/profile");
  const mapa = page.locator("section", { hasText: "Por mês" });
  await expect(mapa.getByTestId("leitura")).toBeVisible();
  // só os meses até ao actual: uma célula futura não se escolhe
  await expect(mapa.locator("button[data-degrau]")).toHaveCount(agora.getMonth() + 1);
});

test("«Dia preferido» e «Mais vista» são widgets; a série leva à sua página", async ({ page }) => {
  await semear(page, {
    series: [
      { uuid: "s-a", name: "Alfa" },
      { uuid: "s-b", name: "Beta" },
    ],
    // 2021-03-07 foi um domingo
    vistos: [...eps("s-a", "2021-03-07", 5), ...eps("s-b", "2021-03-08", 1, 30)],
  });
  await page.goto("/profile");
  await expect(page.getByText("Dia preferido").locator("..")).toContainText("Domingo");
  const mais = page.getByRole("link", { name: /Mais vista/ });
  await expect(mais).toContainText("Alfa");
  await expect(mais).toHaveAttribute("href", "/series/s-a");
});

test("«Mais vistas» e o dia da semana estão no Perfil, e as Estatísticas ficam com o resto", async ({
  page,
}) => {
  await semear(page, {
    series: [
      { uuid: "s-a", name: "Alfa" },
      { uuid: "s-b", name: "Beta" },
    ],
    vistos: [...eps("s-a", "2021-03-07", 5), ...eps("s-b", "2021-03-08", 3, 30)],
  });
  await page.goto("/profile");
  const ranking = page.locator("section", { hasText: "Mais vistas" });
  await expect(ranking.getByRole("link")).toHaveCount(2);
  await expect(ranking.getByRole("link").first()).toContainText("Alfa");
  await expect(page.locator("section", { hasText: "Dia da semana" }).getByRole("button")).toHaveCount(7);

  await page.getByRole("link", { name: /Mais estatísticas/ }).click();
  await expect(page).toHaveURL(/\/estatisticas$/);
  await expect(page.getByText("Melhor maratona")).toBeVisible();
  await expect(page.locator("section", { hasText: "Mais vistas" })).toHaveCount(0);
});

test("sem nada marcado, o Perfil diz quando começa a contar e não desenha gráficos vazios", async ({
  page,
}) => {
  await semear(page, { series: [{ uuid: "s-a", name: "Alfa", runtime: 45 }] });
  await page.goto("/profile");
  await expect(page.locator("section", { hasText: "Tempo de antena" })).toContainText("primeiro episódio");
  await expect(page.getByText("Por mês")).toHaveCount(0);
  await expect(page.getByText("Dia preferido")).toHaveCount(0);
});

for (const rota of ["/profile", "/profile/definicoes", "/estatisticas"]) {
  test(`${rota}: a 320px com o texto a 150% nada transborda`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 664 });
    await semear(page, {
      series: [
        { uuid: "s-a", name: "Uma série com um nome muito, muito comprido para caber numa linha só", runtime: 60, followed: true },
        { uuid: "s-b", name: "Beta", runtime: 60 },
      ],
      filmes: [{ key: "f-1", name: "Filme", watchedAt: "2024-05-04T21:00:00.000Z" }],
      vistos: [...eps("s-a", "2021-03-07", 40), ...eps("s-b", "2022-03-08", 12, 50), ...eps("s-b", "2023-03-08", 3, 90)],
    });
    await page.goto(rota);
    await page.locator("main h1, main h2").first().waitFor();
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "150%";
    });
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  });
}
