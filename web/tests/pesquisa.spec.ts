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
  await page.getByRole("button", { name: "Procurar no catálogo" }).click();
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
    await expect(page.getByText("O Herói de Hacksaw Ridge").first()).toBeVisible();
    await expect(page.getByText("Serie Com Ridge No Nome").first()).toBeVisible();
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
  await page.getByRole("button", { name: "Procurar no catálogo" }).click();

  // O Safari do iPhone amplia sozinho qualquer campo com letra < 16px, e com
  // a página ampliada o ✕ de fechar sai do ecrã. Não é gosto: é o número.
  const tamanho = await page
    .getByRole("searchbox")
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(tamanho).toBeGreaterThanOrEqual(16);
});
