import { test, expect } from "./apoio/base";
import { semear, type EpisodioVisto } from "./apoio/semear";
import { serieCompleta } from "./apoio/tmdb";

/**
 * Ronda 12, Fase 5c — P1 #3 da crítica 5b.4 (AUDITORIA.md): o Tempo de
 * antena estava congelado.
 *
 * Vinha só do total do export do TV Time: não crescia com nada marcado na
 * app desde a importação (julho), e um amigo sem TV Time nunca o tinha —
 * "Disponível depois de importares o TV Time", para sempre. Passa a ser o
 * total do import, mais o que se marcou depois, à duração de cada série.
 */

const IMPORTADO = "2026-07-01T00:00:00.000Z";
const ANTES = "2026-06-01T20:00:00.000Z";
const HOJE = new Date().toISOString();

function episodios(showUuid: string, n: number, watchedAt: string, desde = 1): EpisodioVisto[] {
  return Array.from({ length: n }, (_, i) => ({
    showUuid,
    season: 1,
    episode: desde + i,
    watchedAt,
  }));
}

async function tempoDeAntena(page: import("@playwright/test").Page) {
  await page.goto("/profile");
  const cartao = page.locator("section", { hasText: "Tempo de antena" });
  await cartao.waitFor();
  return cartao;
}

test("cresce com o que se marca depois do import", async ({ page }) => {
  await semear(page, {
    series: [
      // sem duração conhecida: vale a média do próprio import (10h / 10 = 1h)
      { uuid: "s-1", name: "Severance" },
      { uuid: "s-2", name: "Bluey", runtime: 30 },
    ],
    vistos: [
      ...episodios("s-1", 10, ANTES),
      ...episodios("s-1", 2, HOJE, 11),
      ...episodios("s-2", 2, HOJE),
    ],
    kv: {
      "import-meta": {
        importedAt: IMPORTADO,
        totalSeriesRuntimeSec: 10 * 3600,
        totalMoviesRuntimeSec: null,
      },
    },
  });
  const cartao = await tempoDeAntena(page);
  // 10h do import + 2 × 1h (média) + 2 × 30 min = 13h
  await expect(cartao).toContainText("13 h");
  await expect(cartao).toContainText("0 dias e 13 horas");
});

test("um amigo sem TV Time também tem tempo de antena", async ({ page }) => {
  await semear(page, {
    series: [{ uuid: "s-1", name: "The Bear", runtime: 45 }],
    vistos: episodios("s-1", 4, HOJE),
  });
  const cartao = await tempoDeAntena(page);
  // 4 × 45 min = 3h
  await expect(cartao).toContainText("3 h");
  await expect(cartao).toContainText("0 dias e 3 horas");
  await expect(cartao).not.toContainText("importares");
});

test("sem nada marcado nem importado, diz quando começa a contar", async ({ page }) => {
  await semear(page, { series: [{ uuid: "s-1", name: "The Bear", runtime: 45 }] });
  const cartao = await tempoDeAntena(page);
  await expect(cartao).toContainText("primeiro episódio");
  await expect(cartao).not.toContainText("importares");
});

test("a duração de um episódio chega do fornecedor, em segundo plano", async ({
  page,
  tmdb,
}) => {
  // uma série já com capa e total, mas de antes de a app guardar a duração
  Object.assign(tmdb.series, serieCompleta(700, "Andor", [12]).series);
  await semear(page, {
    series: [
      { uuid: "s-1", name: "Andor", tmdbId: 700, posterPath: "/cartaz.jpg", totalEpisodes: 12 },
    ],
  });
  await page.goto("/library");
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            new Promise<unknown>((resolve) => {
              const pedido = indexedDB.open("tvlog");
              pedido.onsuccess = () => {
                const leitura = pedido.result
                  .transaction("shows")
                  .objectStore("shows")
                  .get("s-1");
                leitura.onsuccess = () => resolve(leitura.result?.runtime);
              };
            }),
        ),
      { timeout: 15000 },
    )
    .toBe(42);
});
