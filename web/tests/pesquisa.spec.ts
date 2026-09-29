import { test, expect } from "./apoio/base";
import { semear } from "./apoio/semear";
import type { LinhaTmdb } from "./apoio/tmdb";

/**
 * Ronda 5 — "tentei pesquisar O Herói de Hacksaw Ridge e não me aparece o
 * filme para adicionar".
 *
 * A pesquisa do Explorar ia a `search/tv` ou a `search/movie` conforme o
 * catálogo aberto: procurar obrigava a saber de antemão se a coisa era série
 * ou filme. Passou a `search/multi`, sempre. O primeiro remendo — só ir ao
 * outro catálogo quando o escolhido não devolvia nada — não chegava, e é por
 * isso que estes dois testes procuram o **mesmo** termo nos dois catálogos e
 * exigem o mesmo resultado.
 */

const RESULTADOS: LinhaTmdb[] = [
  {
    id: 324786,
    media_type: "movie",
    title: "O Herói de Hacksaw Ridge",
    original_title: "Hacksaw Ridge",
    release_date: "2016-11-04",
    poster_path: "/hacksaw.jpg",
    backdrop_path: null,
    overview: "",
    vote_average: 8,
  },
  {
    id: 90000,
    media_type: "tv",
    name: "Serie Com Ridge No Nome",
    original_name: "Ridge",
    first_air_date: "2019-03-01",
    poster_path: "/ridge.jpg",
    backdrop_path: null,
    overview: "",
    vote_average: 7,
  },
  // A TMDB devolve pessoas na mesma resposta — nunca são para mostrar aqui.
  { id: 1, media_type: "person", name: "Andrew Garfield", poster_path: "/ator.jpg" },
];

async function procurar(page: import("@playwright/test").Page, termo: string) {
  await page.getByRole("searchbox").fill(termo);
}

for (const [catalogo, rota] of [
  ["Séries", "/explorar"],
  ["Filmes", "/explorar?tipo=filmes"],
] as const) {
  test(`procurar com o catálogo em ${catalogo} devolve séries e filmes`, async ({
    page,
    tmdb,
  }) => {
    tmdb.multi = RESULTADOS;
    await semear(page, {});
    await page.goto(rota);

    await procurar(page, "hacksaw");

    await expect(page.getByText('Resultados para "hacksaw"')).toBeVisible();
    // o original, como na biblioteca (F4); o título pt fica só para comparar
    await expect(page.getByText("Hacksaw Ridge", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Ridge", { exact: true }).first()).toBeVisible();
    // Com a mistura no mesmo sítio, dizer qual é qual deixa de ser detalhe.
    await expect(page.getByText("Filme · 2016")).toBeVisible();
    await expect(page.getByText("Série · 2019")).toBeVisible();
    // Pessoas não se adicionam à biblioteca.
    await expect(page.getByText("Andrew Garfield")).toHaveCount(0);
  });
}

test("o campo de pesquisa tem 16px — abaixo disso o iOS amplia a página", async ({
  page,
}) => {
  await semear(page, {});
  await page.goto("/explorar");

  // O Safari do iPhone amplia sozinho qualquer campo com letra < 16px, e com
  // a página ampliada o ✕ de fechar sai do ecrã. Não é gosto: é o número.
  const tamanho = await page
    .getByRole("searchbox")
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(tamanho).toBeGreaterThanOrEqual(16);
});

test("os resultados da pesquisa quebram em mosaico, e as secções continuam em faixa", async ({
  page,
  tmdb,
}) => {
  // 12 resultados: numa faixa são ~1700px numa janela de 390.
  tmdb.multi = Array.from({ length: 12 }, (_, i) => ({
    id: 4000 + i,
    media_type: "movie" as const,
    title: `Resultado ${i + 1}`,
    release_date: "2020-01-01",
    poster_path: "/p.jpg",
    backdrop_path: null,
    overview: "",
  }));
  tmdb.tendencias = Array.from({ length: 12 }, (_, i) => ({
    id: 5000 + i,
    name: `Tendencia ${i + 1}`,
    poster_path: "/p.jpg",
    backdrop_path: null,
    overview: "",
    first_air_date: "2020-01-01",
  }));

  await semear(page, {});
  await page.goto("/explorar");

  // As secções de descoberta são para espreitar: a faixa que rola fica.
  await expect(page.getByText("Em tendência")).toBeVisible();
  const faixaRola = await page.evaluate(() => {
    const faixa = document.querySelector('[class*="overflow-x-auto"]');
    return faixa ? faixa.scrollWidth > faixa.clientWidth + 1 : false;
  });
  expect(faixaRola).toBe(true);

  await page.getByRole("searchbox").fill("resultado");
  await expect(page.getByText('Resultados para "resultado"')).toBeVisible();

  // Numa pesquisa já se sabe o que se procura: nada de arrastar para o lado.
  const mosaico = await page.evaluate(() => {
    const caixa = [...document.querySelectorAll("div")].find(
      (d) => getComputedStyle(d).display === "grid" && d.children.length === 12,
    );
    if (!caixa) return null;
    const visiveis = [...caixa.children].filter((c) => {
      const r = c.getBoundingClientRect();
      return r.top < innerHeight && r.bottom > 0;
    }).length;
    return { rolaParaOLado: caixa.scrollWidth > caixa.clientWidth + 1, visiveis };
  });
  expect(mosaico).not.toBeNull();
  expect(mosaico!.rolaParaOLado).toBe(false);
  // numa faixa viam-se 3; em mosaico tem de ver-se bastante mais de uma vez
  expect(mosaico!.visiveis).toBeGreaterThanOrEqual(6);
});
