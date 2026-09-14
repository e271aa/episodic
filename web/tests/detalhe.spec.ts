import { test, expect } from "./apoio/base";
import { semear, type EpisodioVisto } from "./apoio/semear";

/**
 * Fase 4 da Ronda 11 — o detalhe da série.
 *
 * O herói ocupava 420px fixos: 63% de um ecrã de 664px era arte antes de
 * uma única informação, e a ação principal ficava debaixo da dock — só 20%
 * da caixa de "Marcar os 22" estava livre ao chegar à página. Ser visível e
 * não se poder tocar é a avaria que não aparece em captura nenhuma, e a
 * sonda do protocolo deixou-a passar porque lhe basta um ponto livre na
 * borda para dar o alvo por destapado.
 */

const TVMAZE = 495;
const TEMPORADAS = [13, 51, 51, 50, 50, 5];

/** Fração da caixa do alvo que está mesmo livre — grelha de 5×5 pontos. */
function cobertura(page: import("@playwright/test").Page, sel: string) {
  return page.evaluate((seletor: string) => {
    const el = document.querySelector(seletor);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    let livres = 0;
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        const x = r.left + (r.width * (i + 0.5)) / 5;
        const y = r.top + (r.height * (j + 0.5)) / 5;
        const alvo = document.elementFromPoint(x, y);
        if (alvo === el || el.contains(alvo)) livres++;
      }
    }
    return Math.round((livres / 25) * 100);
  }, sel);
}

async function abrirSerie(
  page: import("@playwright/test").Page,
  tmdb: { tvmaze: Record<number, number[]> },
  comBuracos: boolean,
) {
  tmdb.tvmaze[TVMAZE] = TEMPORADAS;
  const vistos: EpisodioVisto[] = [];
  TEMPORADAS.forEach((n, i) => {
    for (let e = 1; e <= n; e++) {
      if (comBuracos && i === 1 && e >= 20 && e <= 41) continue;
      // deixa sempre um "próximo episódio" por ver no fim
      if (i === TEMPORADAS.length - 1 && e >= 3) continue;
      vistos.push({ showUuid: "s-1", season: i + 1, episode: e });
    }
  });
  await semear(page, {
    series: [
      {
        uuid: "s-1",
        name: "Naruto",
        tvmazeId: TVMAZE,
        numeracao: "tvmaze",
        totalEpisodes: 220,
        status: "Ended",
      },
    ],
    vistos,
  });
  await page.goto("/series/s-1");
  await page.getByTestId("tab-episodios").waitFor();
  await page.evaluate(() => window.scrollTo(0, 0));
}

test("a ação principal está toda tocável mal se chega à página", async ({ page, tmdb }) => {
  await abrirSerie(page, tmdb, true);
  // Com buracos, a decisão nº 1 é arrumá-los (a ordem da Fase 1).
  await expect(page.getByTestId("marcar-buracos")).toBeVisible();
  expect(await cobertura(page, '[data-testid="marcar-buracos"]')).toBe(100);
});

test("sem buracos, a principal é marcar o próximo — e também está toda livre", async ({
  page,
  tmdb,
}) => {
  await abrirSerie(page, tmdb, false);
  await expect(page.getByTestId("mark-next")).toBeVisible();
  expect(await cobertura(page, '[data-testid="mark-next"]')).toBe(100);
});

test("só há uma ação preenchida de cada vez", async ({ page, tmdb }) => {
  await abrirSerie(page, tmdb, true);
  // Eram dois blocos brancos iguais empilhados, os dois a pedir o toque com
  // o mesmo peso. Com buracos, o "próximo episódio" passa a contornado.
  await expect(page.getByTestId("marcar-buracos")).toHaveClass(/bg-ink/);
  await expect(page.getByTestId("mark-next")).not.toHaveClass(/bg-ink/);

  // …e sem buracos volta a ser ele o preenchido.
  await abrirSerie(page, tmdb, false);
  await expect(page.getByTestId("mark-next")).toHaveClass(/bg-ink/);
});

test("o herói mostra o progresso da série, não só o número", async ({ page, tmdb }) => {
  await abrirSerie(page, tmdb, false);
  // 217 de 220 vistos ≈ 98,6%. Antes só existia em texto mono de 13px.
  const largura = await page
    .getByTestId("heroi-progresso")
    .evaluate((el) => (el as HTMLElement).style.width);
  expect(Number.parseFloat(largura)).toBeGreaterThan(95);
  expect(Number.parseFloat(largura)).toBeLessThanOrEqual(100);
});

test("abrir uma temporada do fim da faixa traz a pastilha para o ecrã", async ({
  page,
  tmdb,
}) => {
  await abrirSerie(page, tmdb, false);
  // Seis temporadas: a faixa rola de lado e a última está fora do ecrã.
  const ultima = page.getByTestId("season-6");
  expect(
    await ultima.evaluate((el) => el.getBoundingClientRect().right <= window.innerWidth),
  ).toBe(false);

  // `click()` traria a pastilha para o ecrã SOZINHO — o Playwright rola até
  // ao elemento antes de tocar, e o teste passava a medir o Playwright em
  // vez da app. `dispatchEvent` toca sem rolar nada.
  await ultima.dispatchEvent("click");
  await expect(page.getByTestId("ep-6-1")).toBeVisible();
  await expect
    .poll(() =>
      ultima.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return r.left >= 0 && r.right <= window.innerWidth;
      }),
    )
    .toBe(true);
});

test("os separadores andam com as setas e dizem que painel comandam", async ({
  page,
  tmdb,
}) => {
  await abrirSerie(page, tmdb, false);
  const episodios = page.getByTestId("tab-episodios");
  await expect(episodios).toHaveAttribute("aria-controls", "painel-episodios");
  await expect(page.locator("#painel-episodios")).toHaveAttribute("role", "tabpanel");

  await episodios.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("tab-sobre")).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowLeft");
  await expect(episodios).toHaveAttribute("aria-selected", "true");
});
