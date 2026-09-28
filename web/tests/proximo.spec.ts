import { test, expect } from "./apoio/base";
import { semear, type EpisodioVisto } from "./apoio/semear";

/**
 * Ronda 12, Fase 5c — P1 #1 da crítica 5b.4 (AUDITORIA.md): o "próximo
 * episódio" era o primeiro buraco.
 *
 * A procura começava no S01·E01 e devolvia o primeiro por marcar que
 * encontrasse. Com buracos para trás, propunha um deles: o detalhe dizia
 * "Marcar próximo · S02·E20" ao lado de "22 por marcar mais atrás" — e o
 * E20 era um dos 22. O mesmo número chegava à casa, ao "Ou então" e ao Pôr
 * em dia. É a distinção "por ver / por marcar" do glossário, ignorada pela
 * própria app: o próximo é o que vem DEPOIS do último visto.
 */

const TVMAZE = 495;
const HOJE = new Date().toISOString();

/** O caso do Naruto, à escala: T2 sem os 20–41, T3 vista até ao `ateT3`. */
async function naruto(
  page: import("@playwright/test").Page,
  tmdb: { tvmaze: Record<number, number[]> },
  ateT3: number,
) {
  const temporadas = [13, 51, 51];
  tmdb.tvmaze[TVMAZE] = temporadas;
  const vistos: EpisodioVisto[] = [];
  temporadas.forEach((n, i) => {
    for (let e = 1; e <= n; e++) {
      if (i === 1 && e >= 20 && e <= 41) continue;
      if (i === 2 && e > ateT3) continue;
      vistos.push({ showUuid: "s-1", season: i + 1, episode: e, watchedAt: HOJE });
    }
  });
  await semear(page, {
    series: [
      {
        uuid: "s-1",
        name: "Naruto",
        tvmazeId: TVMAZE,
        numeracao: "tvmaze",
        totalEpisodes: 115,
        status: "Ended",
      },
    ],
    vistos,
  });
}

test("no detalhe, o próximo é o que vem depois do último visto — não o primeiro buraco", async ({
  page,
  tmdb,
}) => {
  await naruto(page, tmdb, 10);
  await page.goto("/series/s-1");
  await expect(page.getByTestId("aviso-buracos")).toContainText("T2: 22");
  await expect(page.getByTestId("mark-next")).toContainText("S03·E11");
});

test("na casa, o herói propõe o mesmo episódio", async ({ page, tmdb }) => {
  await naruto(page, tmdb, 10);
  await page.goto("/series");
  await page.getByRole("heading", { level: 1, name: "Naruto" }).waitFor();
  const heroi = page.locator("main");
  await expect(heroi).toContainText("S03·E11");
  await expect(heroi).not.toContainText("S02·E20");
});

test("sem nada por ver à frente, não há 'próximo' — os buracos ficam com o cartão deles", async ({
  page,
  tmdb,
}) => {
  await naruto(page, tmdb, 51);
  await page.goto("/series/s-1");
  await expect(page.getByTestId("aviso-buracos")).toContainText("T2: 22");
  await expect(page.getByTestId("marcar-buracos")).toBeVisible();
  await expect(page.getByTestId("mark-next")).toHaveCount(0);
});
