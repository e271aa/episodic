import { test, expect } from "./apoio/base";
import { semear } from "./apoio/semear";

/**
 * Ronda 14, Fase 10 — os buracos que a rede de mutações achou depois de a Mira
 * redesenhar os ecrãs: mutações que continuavam a aplicar-se mas que nenhum
 * teste apanhava (sobreviveram na corrida completa de 30-09). Cada teste aqui
 * foi visto a falhar com a mutação correspondente reposta (`node
 * tests/mutacoes.mjs <nome>`, numa cópia à parte).
 */

/** «Preenchido» é um fundo opaco; um `fill` (cinza translúcido) ou o contorno não o são. */
const preenchido = (loc: import("@playwright/test").Locator) =>
  loc.evaluate((el) => {
    const [, , , a = "1"] = getComputedStyle(el).backgroundColor.match(/[\d.]+/g) ?? [];
    return Number(a) === 1;
  });

function sugestoes(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: 900 + i,
    name: `Sugestao ${i + 1}`,
    poster_path: "/cartaz.jpg",
    backdrop_path: null,
    overview: "",
    first_air_date: "2021-01-01",
    vote_average: 7,
  }));
}

test("Explorar: o «Para ver» de cada cartaz não é a cápsula da ação (Regra da ação)", async ({ page, tmdb }) => {
  // `r12-fase5b3/para-ver-volta-a-branco`: quatro pílulas brancas iguais a pedir o
  // toque com o mesmo peso — a única cápsula preenchida do ecrã é uma, e aqui não há.
  tmdb.tendencias = sugestoes(4);
  await semear(page, {});
  await page.goto("/explorar");
  const botoes = page.getByRole("button", { name: "Para ver" });
  await expect(botoes).toHaveCount(4);
  for (const botao of await botoes.all()) expect(await preenchido(botao)).toBe(false);
});

test("Explorar: a primeira capa de cada faixa não carrega em lazy (decide o LCP)", async ({ page, tmdb }) => {
  // `r12-fase5b/explorar-lcp-lazy`: o teste da Fase 4 olhava para a primeira
  // `img` da página, que na Mira já não é a capa de um cartaz da faixa.
  tmdb.tendencias = sugestoes(8);
  await semear(page, {});
  await page.goto("/explorar");
  const primeira = page.locator('main img[alt="Sugestao 1"]').first();
  await primeira.waitFor();
  expect(await primeira.getAttribute("loading")).not.toBe("lazy");
});

test("Pôr em dia: o filtro escolhido é um cinza translúcido, não uma pílula branca", async ({ page }) => {
  // `r12-fase5b3/escolha-volta-a-branco`
  const haSessentaDias = new Date(Date.now() - 60 * 864e5).toISOString();
  await semear(page, {
    series: [{ uuid: "s-parada", name: "Serie Parada" }],
    vistos: [{ showUuid: "s-parada", season: 1, episode: 1, watchedAt: haSessentaDias }],
    kv: {
      "nextup-cache": {
        "s-parada": {
          episode: { season: 1, episode: 2, name: "Episódio 2", airDate: "2020-01-01" },
          lastWatchedAt: haSessentaDias,
        },
      },
    },
  });
  await page.goto("/em-dia?filtro=retomar");
  const escolhido = page.locator('button[aria-pressed="true"]').first();
  await expect(escolhido).toBeVisible();
  expect(await preenchido(escolhido)).toBe(false);
});

test("Perfil: a capa das «Mais vistas» pede o tamanho que mostra (40px), não o do ecrã", async ({ page }) => {
  // `r12-fase5e/sizes-perfil`
  await semear(page, {
    series: [{ uuid: "s-1", name: "Serie Vista", posterPath: "/cartaz.jpg", totalEpisodes: 3 }],
    vistos: [1, 2].map((episode) => ({ showUuid: "s-1", season: 1, episode })),
  });
  await page.goto("/profile");
  const capa = page.locator("ol img").first();
  await capa.waitFor();
  await expect(capa).toHaveAttribute("sizes", "40px");
});

test("Filme: um título de uma palavra só comprida quebra em vez de ser cortado, a 150%", async ({ page }) => {
  // `r12-f2/titulo-do-filme-alarga`: o `line-clamp` esconde o que sobra, por isso
  // sem `break-words` a palavra não alargava a página — ficava cortada.
  await semear(page, {
    series: [],
    filmes: [
      {
        key: "tvtime-1",
        name: "Pneumoultramicroscopicossilicovulcanoconiotico",
        releaseDate: "1994-09-23",
        watchedAt: "2024-05-04T21:00:00.000Z",
      },
    ],
  });
  await page.goto("/movies/tvtime-1");
  const titulo = page.getByRole("heading", { level: 1 });
  await titulo.waitFor();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "150%";
  });
  const { visivel, todo } = await titulo.evaluate((el) => ({ visivel: el.clientWidth, todo: el.scrollWidth }));
  expect(todo).toBeLessThanOrEqual(visivel);
});

test("Biblioteca: o cabeçalho de uma secção tem a cor do título, não uma cor de estado", async ({ page }) => {
  // `r14-f10/seccao-com-cor`: o teste da Fase 3 só media fundos, e uma cor de
  // estado no texto passava.
  await semear(page, {
    series: [{ uuid: "s-2", name: "Nunca Vista" }, { uuid: "s-3", name: "A Meio", totalEpisodes: 4 }],
    vistos: [{ showUuid: "s-3", season: 1, episode: 1 }],
  });
  await page.goto("/library");
  const secao = page.getByRole("heading", { level: 2, name: /Por começar/ }).first();
  await secao.waitFor();
  const cor = (loc: import("@playwright/test").Locator) => loc.evaluate((el) => getComputedStyle(el).color);
  expect(await cor(secao)).toBe(await cor(page.getByRole("heading", { level: 1, name: "Biblioteca" })));
});
