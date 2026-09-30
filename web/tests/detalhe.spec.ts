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
  /** rolar para o topo ao chegar (esconde um salto da página — ver o teste da faixa) */
  topo = true,
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
  await page.getByTestId("temporadas").waitFor();
  if (topo) await page.evaluate(() => window.scrollTo(0, 0));
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
  // Mede-se o que se vê (o fundo que o browser resolve), não o nome da classe:
  // «preenchida» é um fundo opaco; o contorno não tem fundo nenhum.
  const opaco = (id: string) =>
    page.getByTestId(id).evaluate((el) => {
      const [, , , a = "1"] = getComputedStyle(el).backgroundColor.match(/[\d.]+/g) ?? [];
      return Number(a) === 1;
    });
  expect(await opaco("marcar-buracos")).toBe(true);
  expect(await opaco("mark-next")).toBe(false);

  // …e sem buracos volta a ser ele o preenchido.
  await abrirSerie(page, tmdb, false);
  expect(await opaco("mark-next")).toBe(true);
});

test("o título diz quanto se viu, em números", async ({ page, tmdb }) => {
  await abrirSerie(page, tmdb, false);
  // A barra de 3px do herói saiu com a Mira (B·2a): a contagem vive na
  // linha por baixo do título, e cada temporada tem a sua barra na faixa.
  await expect(page.locator("h1 + p")).toContainText("217/220 vistos");
});

test("a faixa abre centrada na temporada em curso, e a escolhida vem para o ecrã", async ({
  page,
  tmdb,
}) => {
  await abrirSerie(page, tmdb, false);
  const dentro = (el: Element) => {
    const r = el.getBoundingClientRect();
    return r.left >= 0 && r.right <= window.innerWidth;
  };
  // Seis temporadas, e a em curso é a última: abre já à vista (B·E5)…
  const ultima = page.getByTestId("season-6");
  await expect(page.getByTestId("ep-6-3")).toBeVisible();
  await expect.poll(() => ultima.evaluate(dentro)).toBe(true);
  // …e a primeira fica fora, à esquerda.
  const primeira = page.getByTestId("season-1");
  expect(await primeira.evaluate(dentro)).toBe(false);

  // `click()` traria a pastilha para o ecrã SOZINHO — o Playwright rola até
  // ao elemento antes de tocar, e o teste passava a medir o Playwright em
  // vez da app. `dispatchEvent` toca sem rolar nada.
  await primeira.dispatchEvent("click");
  await expect(page.getByTestId("corrida-1-1-13")).toBeAttached();
  await expect.poll(() => primeira.evaluate(dentro)).toBe(true);
});

test("centrar a faixa não puxa a página para baixo", async ({ page, tmdb }) => {
  // A temporada em curso abre sozinha e a faixa centra-se nela — rolando a
  // faixa, nunca a página: num ecrã baixo, a faixa ainda está fora de vista
  // quando se chega, e um `scrollIntoView` descia a página sem se pedir.
  await page.setViewportSize({ width: 390, height: 560 });
  // Com o cartão dos buracos por cima, a faixa fica abaixo da dobra.
  await abrirSerie(page, tmdb, true, false);
  await expect(page.getByTestId("ep-6-3")).toBeAttached();
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

// ── Ronda 12, Fase 5b.3 — o que ficou da Ronda 11 ─────────────

test("com buracos, a ação secundária também está toda tocável ao chegar", async ({
  page,
  tmdb,
}) => {
  // Medido: "Marcar próximo episódio" estava 20% livre — o resto debaixo da
  // dock. Escolhido pelo Ruben (27-09): marcar primeiro, "Lista" e "Onde
  // ver" depois.
  await abrirSerie(page, tmdb, true);
  // Esperar pelo cartão dos buracos e que a entrada dele (220ms) assente: sem
  // isto, com a máquina carregada, media-se antes de ele aparecer — e sem ele
  // a secundária fica mais acima e sempre livre. O teste passava sem provar
  // nada (a mutação que a empurra para debaixo da dock sobrevivia).
  await expect(page.getByTestId("marcar-buracos")).toBeVisible();
  await expect(page.getByTestId("mark-next")).toBeVisible();
  await page.waitForTimeout(400);
  expect(await cobertura(page, '[data-testid="mark-next"]')).toBe(100);
});

test("num ecrã baixo (o iPhone na horizontal) a arte não empurra a ação para debaixo da dock", async ({
  page,
  tmdb,
}) => {
  // A arte tem 290px num iPhone, mas nunca mais de 40% do ecrã: com 290px fixos,
  // a 375px de altura o «Marcar» ficava atrás da dock (a mutação
  // `fase4/altura-do-heroi` sobreviveu a todos os testes de ecrã alto).
  await page.setViewportSize({ width: 667, height: 375 });
  await abrirSerie(page, tmdb, false);
  await expect(page.getByTestId("mark-next")).toBeVisible();
  await expect.poll(() => cobertura(page, '[data-testid="mark-next"]')).toBe(100);
});

test("o fim da página não tem vazio a mais", async ({ page, tmdb }) => {
  // Medido: 188px de nada por baixo das temporadas fechadas — a moldura já
  // reserva o espaço da dock (82px), e a página reservava-o outra vez.
  // Desde a Mira há sempre uma temporada aberta; mede-se num ecrã onde a
  // página rola (numa página mais curta do que o ecrã, o fundo é o ecrã).
  await page.setViewportSize({ width: 390, height: 560 });
  await abrirSerie(page, tmdb, false);
  // a lista da temporada aberta tem de estar lá: sem ela, a página é mais
  // curta do que o ecrã e o «fundo» passa a ser o ecrã
  await expect(page.getByTestId("ep-6-5")).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const vazio = await page.evaluate(() => {
    const fundo = Math.max(
      ...[...document.querySelectorAll("main *")]
        .filter((el) => el.getBoundingClientRect().height > 0)
        .map((el) => el.getBoundingClientRect().bottom + scrollY),
    );
    return document.documentElement.scrollHeight - fundo;
  });
  // a moldura reserva a dock (~95px aqui) e a página dá um respiro de 24px (Fase 11:
  // sem ele o último episódio ficava colado à barra). Reservá-la duas vezes
  // seria ~190px.
  expect(vazio).toBeLessThan(130);
});
