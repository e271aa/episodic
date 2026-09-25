import { test, expect } from "./apoio/base";
import { semear, type EpisodioVisto } from "./apoio/semear";

/**
 * Ronda 12, Fase 1 — as estatísticas por data só contam datas certas.
 *
 * 310 dos 3.416 episódios importados têm a data da MARCAÇÃO em massa no TV
 * Time, não a do visto. Medido: o 14-06-2015 tinha 98 episódios e o
 * 28-06-2024 tinha 87 — "a tua maior maratona" era um dia em que arrumaste o
 * histórico. E o "vi tudo" novo marca centenas de episódios hoje. Continuam
 * nos totais; nos gráficos por data não entram.
 */
test("um dia de marcação em massa não aparece como a maior maratona", async ({ page }) => {
  const emMassa: EpisodioVisto[] = Array.from({ length: 98 }, (_, i) => ({
    showUuid: "s-massa",
    season: 1,
    episode: i + 1,
    watchedAt: "2015-06-14T20:00:00.000Z",
    dateIsExact: false,
  }));
  const maratona: EpisodioVisto[] = [1, 2, 3].map((episode) => ({
    showUuid: "s-real",
    season: 1,
    episode,
    watchedAt: "2021-03-10T21:00:00.000Z",
  }));
  await semear(page, {
    series: [
      { uuid: "s-massa", name: "Marcada Em Massa" },
      { uuid: "s-real", name: "Maratona Real" },
    ],
    vistos: [...emMassa, ...maratona],
  });
  await page.goto("/estatisticas");

  const binge = page.getByText("A maior parte foi de");
  await expect(binge).toContainText("Maratona Real");
  await expect(page.getByText("98", { exact: true })).toHaveCount(0);
});
