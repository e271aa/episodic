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

test("sem capa, o ícone no lugar da arte não toca no título da série", async ({ page }) => {
  // Visto no Safari do iOS (Fase 8): o ícone estava centrado no cartão
  // inteiro — e o texto também vive no cartão, no terço de baixo —, por
  // isso caía em cima de "Succession". O teste da 5c só olhava para o nome
  // não aparecer duas vezes.
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
  const titulo = page.getByRole("heading", { name: "Severance" });
  await expect(titulo).toBeVisible();
  const icone = page.locator("[data-swipe-stack] svg").first();
  const t = (await titulo.boundingBox())!;
  const i = (await icone.boundingBox())!;
  expect(i.y + i.height).toBeLessThanOrEqual(t.y);
});

test("o aviso de anular não tapa os botões do cartão seguinte", async ({ page }) => {
  // Visto no Safari do iOS (Fase 8): decidir pelo ✕ punha o aviso por cima
  // do ✕ e do ✓ do cartão seguinte durante os 7 segundos da janela.
  await semear(page, {
    series: [
      { uuid: "s-1", name: "Severance" },
      { uuid: "s-2", name: "Andor" },
    ],
    vistos: [
      { showUuid: "s-1", season: 1, episode: 1, watchedAt: HOJE },
      { showUuid: "s-2", season: 1, episode: 1, watchedAt: HOJE },
    ],
    kv: {
      "nextup-cache": {
        "s-1": {
          episode: { season: 1, episode: 2, name: "Meio-dia", airDate: "2022-02-18" },
          lastWatchedAt: HOJE,
        },
        "s-2": {
          episode: { season: 1, episode: 2, name: "Dois", airDate: "2022-09-21" },
          lastWatchedAt: HOJE,
        },
      },
    },
  });
  await page.goto("/em-dia");
  const saltar = page.getByRole("button", { name: "Saltar — ainda não vi" });
  await saltar.waitFor();
  await saltar.dispatchEvent("click");
  const aviso = page.getByTestId("undo-toast");
  await expect(aviso).toBeVisible();
  await page.waitForTimeout(300);
  const a = (await aviso.boundingBox())!;
  for (const nome of ["Saltar — ainda não vi", "Marcar como visto"]) {
    const b = (await page.getByRole("button", { name: nome }).boundingBox())!;
    expect(b.y + b.height).toBeLessThanOrEqual(a.y);
  }
});
