import { test, expect } from "./apoio/base";
import { semear } from "./apoio/semear";

/**
 * Ronda 12, Fase 5c — P1 #5 da crítica 5b.4 (AUDITORIA.md): no Pôr em dia
 * não se lia de que série era o cartão.
 *
 * O nome da série estava a 12px, cinza, em maiúsculas, sobre a arte; o nome
 * do episódio a 24px por baixo. "Episódio 5" não diz nada a ninguém — o que
 * se decide é "vi isto de Severance?". O herói da casa já tinha a ordem
 * certa (a série é o título, o episódio vem por baixo); o baralho passa a
 * ter a mesma.
 */

const HOJE = new Date().toISOString();

test("o cartão do baralho diz a série em título, legível sobre a arte", async ({ page }) => {
  await semear(page, {
    series: [{ uuid: "s-1", name: "Severance" }],
    vistos: [{ showUuid: "s-1", season: 1, episode: 1, watchedAt: HOJE }],
    kv: {
      "nextup-cache": {
        "s-1": {
          episode: { season: 1, episode: 2, name: "Meio-dia", airDate: "2022-02-18" },
          lastWatchedAt: HOJE,
        },
      },
    },
  });
  await page.goto("/em-dia");
  const serie = page.getByRole("heading", { name: "Severance" });
  await expect(serie).toBeVisible();

  const medida = await serie.evaluate((el) => {
    const css = getComputedStyle(el);
    const tinta = getComputedStyle(document.documentElement).getPropertyValue("--color-ink");
    const amostra = document.createElement("span");
    amostra.style.color = tinta;
    document.body.append(amostra);
    const corTinta = getComputedStyle(amostra).color;
    amostra.remove();
    return { tamanho: parseFloat(css.fontSize), cor: css.color, corTinta, caixa: css.textTransform };
  });
  // o degrau de 24px da rampa, a tinta clara, e como se escreve (sem maiúsculas)
  expect(medida.tamanho).toBeGreaterThanOrEqual(24);
  expect(medida.cor).toBe(medida.corTinta);
  expect(medida.caixa).toBe("none");

  // o episódio continua lá, por baixo, mais pequeno que a série
  const episodio = page.getByText("Meio-dia");
  await expect(episodio).toBeVisible();
  const tamanhoEpisodio = await episodio.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(tamanhoEpisodio).toBeLessThan(medida.tamanho);
});

test("sem capa, o nome da série não aparece duas vezes", async ({ page }) => {
  await semear(page, {
    series: [{ uuid: "s-1", name: "Severance" }],
    vistos: [{ showUuid: "s-1", season: 1, episode: 1, watchedAt: HOJE }],
    kv: {
      "nextup-cache": {
        "s-1": {
          episode: { season: 1, episode: 2, name: "Meio-dia", airDate: "2022-02-18" },
          lastWatchedAt: HOJE,
        },
      },
    },
  });
  await page.goto("/em-dia");
  await expect(page.getByRole("heading", { name: "Severance" })).toBeVisible();
  await expect(page.getByText("Severance", { exact: true })).toHaveCount(1);
});
