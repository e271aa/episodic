import { test, expect } from "./apoio/base";
import { semear } from "./apoio/semear";
import { serieCompleta } from "./apoio/tmdb";
import { curta } from "../src/lib/datas";

/**
 * Ronda 12, Fase 5e — os P3 e as pontas soltas da crítica 5b.4 (AUDITORIA.md,
 * achado #14) e do que se viu pelo caminho. Mecânico, sem decisões de gosto.
 */

test("no detalhe, a atividade não mostra datas em ISO cruas", async ({ page, tmdb }) => {
  // "2024-06-26 → 2024-07-01" escapou à Fase 5b.1, que já tinha corrigido as
  // outras duas. Usa o mesmo `curta()` que o resto da app.
  Object.assign(tmdb.series, serieCompleta(500, "Severance", [3]).series);
  Object.assign(tmdb.episodios, serieCompleta(500, "Severance", [3]).episodios);
  await semear(page, {
    series: [{ uuid: "s-1", name: "Severance", tmdbId: 500, numeracao: "tmdb" }],
    vistos: [
      { showUuid: "s-1", season: 1, episode: 1, watchedAt: "2024-06-26T20:00:00.000Z" },
      { showUuid: "s-1", season: 1, episode: 2, watchedAt: "2024-07-01T21:00:00.000Z" },
    ],
  });
  await page.goto("/series/s-1");
  await page.getByTestId("tab-estatisticas").click();
  const painel = page.locator("#painel-estatisticas");
  await expect(painel).not.toContainText("2024-06-26");
  const esperado = `${curta("2024-06-26T20:00:00.000Z")} → ${curta("2024-07-01T21:00:00.000Z")}`;
  await expect(painel).toContainText(esperado);
});

test("o Entrar tem uma saída — um recuar, não um beco sem saída", async ({ page }) => {
  // Sem cloud configurada (o caso desta suite), não há sessão a proteger, e
  // ficar preso no /login sem forma de sair era desnecessário.
  await semear(page, {});
  await page.goto("/login");
  const voltar = page.getByRole("link", { name: /Voltar/ }).or(page.getByRole("button", { name: /Voltar/ }));
  await expect(voltar).toBeVisible();
  await voltar.click();
  await expect(page).not.toHaveURL(/\/login$/);
});

test("o Explorar diz 'do que gostas', com a preposição", async ({ page }) => {
  // "Ainda não sei o que gostas" falta o "de" — gostar é sempre "gostar de".
  await semear(page, {});
  await page.goto("/explorar");
  await expect(page.getByText(/Ainda não sei do que gostas/)).toBeVisible();
});

test("o aviso de privacidade do Importar não promete o que a cloud desfaz", async ({
  page,
}) => {
  // "Nada é enviado para servidores" era falso com a cloud ligada — a
  // próxima sincronização envia tudo (db.ts:379, comentário do importExport).
  const { avisoDePrivacidade } = await import("../src/lib/textoImportar");
  expect(avisoDePrivacidade(false)).toContain("nada é enviado para servidores");
  expect(avisoDePrivacidade(true)).not.toContain("nada é enviado para servidores");

  // Sem cloud (o caso desta suite), a página mostra a frase sem promessa falsa.
  await semear(page, {});
  await page.goto("/import");
  await expect(page.getByText(avisoDePrivacidade(false))).toBeVisible();
});

test("'Melhor maratona' não aparece por um único episódio — não é maratona nenhuma", async ({
  page,
}) => {
  // Sem limiar, o dia com mais episódios era sempre "o melhor", mesmo com 1
  // — um recorde que humilha (achado da 5b.4). Passa a exigir 2.
  await semear(page, {
    series: [{ uuid: "s-1", name: "Serie Um" }],
    vistos: [{ showUuid: "s-1", season: 1, episode: 1, watchedAt: "2024-03-05T20:00:00.000Z" }],
  });
  await page.goto("/estatisticas");
  await expect(page.getByText("Sequência mais longa")).toHaveCount(0); // 1 dia só, sem sequência
  await expect(page.getByText("Melhor maratona")).toHaveCount(0);
});

test("'Melhor maratona' aparece a partir de 2 episódios no mesmo dia", async ({ page }) => {
  await semear(page, {
    series: [{ uuid: "s-1", name: "Serie Um" }],
    vistos: [
      { showUuid: "s-1", season: 1, episode: 1, watchedAt: "2024-03-05T20:00:00.000Z" },
      { showUuid: "s-1", season: 1, episode: 2, watchedAt: "2024-03-05T21:00:00.000Z" },
    ],
  });
  await page.goto("/estatisticas");
  await expect(page.getByText("Melhor maratona")).toBeVisible();
  await expect(page.getByText("2", { exact: true })).toBeVisible();
});
