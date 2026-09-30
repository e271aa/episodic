import { test, expect } from "./apoio/base";
import { semear } from "./apoio/semear";
import { serieCompleta } from "./apoio/tmdb";

/**
 * Explorar na Mira (Ronda 14, Fase 6 · B·4 e B·E3). Só comportamento: o que
 * se pode fazer e o que o ecrã diz, não cores nem tamanhos.
 */

function sugestoes(n: number, base = 900) {
  return Array.from({ length: n }, (_, i) => ({
    id: base + i,
    name: `Sugestao ${i + 1}`,
    poster_path: "/cartaz.jpg",
    backdrop_path: null,
    overview: "",
    first_air_date: "2021-01-01",
    vote_average: 7,
  }));
}

test("cada cartaz tem uma só ação; depois de tocada diz «Na lista» e a série fica guardada", async ({
  page,
  tmdb,
}) => {
  tmdb.tendencias = sugestoes(4);
  await semear(page, {});
  await page.goto("/explorar");

  await expect(page.getByRole("heading", { level: 2, name: "Em tendência" })).toBeVisible();
  // dispensar já não vive no cartaz (é na Triagem)
  await expect(page.getByRole("button", { name: /Não me interessa/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Por começar" })).toHaveCount(4);

  await page.getByRole("button", { name: "Por começar" }).first().click();
  await expect(page.getByText("Na lista", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Por começar" })).toHaveCount(3);

  await page.goto("/library");
  await page.getByText("Sugestao 1").first().waitFor();
});

test("a linha da Triagem abre o baralho e fecha de volta ao Explorar", async ({ page, tmdb }) => {
  tmdb.tendencias = sugestoes(4);
  await semear(page, {});
  await page.goto("/explorar");

  await page.getByRole("button", { name: /Triagem/ }).click();
  await expect(page.getByText("1 / 4")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Triagem" })).toBeVisible();

  await page.getByRole("button", { name: "Fechar a Triagem" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Explorar" })).toBeVisible();
  await expect(page.getByText("1 / 4")).toHaveCount(0);
});

test("na Triagem, a pastilha de onde veio o cartaz é só texto: a mira não é decoração", async ({ page, tmdb }) => {
  // Fase 12: a barrinha de cor sorteada pelo título da secção (`sectionColor`,
  // da v2) tinha sobrevivido aqui — a Regra da mira só a deixa no ritual e na
  // casa vazia.
  tmdb.tendencias = sugestoes(2);
  await semear(page, {});
  await page.goto("/explorar");
  await page.getByRole("button", { name: /Triagem/ }).click();
  const origem = page.getByTestId("origem-triagem").first();
  await expect(origem).toContainText("Em tendência");
  const pintados = await origem.evaluate((el) =>
    [...el.querySelectorAll("*")].filter((c) => getComputedStyle(c).backgroundColor !== "rgba(0, 0, 0, 0)").length,
  );
  expect(pintados).toBe(0);
});

test("«Ver tudo» abre a secção em mosaico e «Ver menos» volta à faixa", async ({ page, tmdb }) => {
  tmdb.tendencias = sugestoes(9);
  await semear(page, {});
  await page.goto("/explorar");

  const faixa = () =>
    page.evaluate(() => {
      const f = document.querySelector('[class*="overflow-x-auto"]');
      return f ? f.scrollWidth > f.clientWidth + 1 : false;
    });
  await page.getByRole("button", { name: "Ver tudo" }).first().waitFor();
  expect(await faixa()).toBe(true);

  await page.getByRole("button", { name: "Ver tudo" }).first().click();
  expect(await faixa()).toBe(false);
  await page.getByRole("button", { name: "Ver menos" }).first().click();
  expect(await faixa()).toBe(true);
});

test("as listas aparecem no Explorar, com a contagem, e levam à lista", async ({ page, tmdb }) => {
  tmdb.tendencias = sugestoes(4);
  await semear(page, {
    series: [{ uuid: "s-1", name: "Serie Um" }],
    listas: [
      { id: "l-1", name: "Para a viagem", items: [{ kind: "show", refId: "s-1" }] },
    ],
  });
  await page.goto("/explorar");

  const linha = page.getByRole("link", { name: /Para a viagem/ });
  await expect(linha).toContainText("1");
  await linha.click();
  await expect(page).toHaveURL(/\/listas\/l-1/);
});

test("sem ligação: diz-o, desliga a pesquisa, e as listas continuam; com rede volta tudo", async ({
  page,
  context,
  tmdb,
}) => {
  tmdb.tendencias = sugestoes(4);
  await semear(page, {
    listas: [{ id: "l-1", name: "Para a viagem", items: [] }],
  });
  await page.goto("/explorar");
  await expect(page.getByText("Sugestao 1").first()).toBeVisible();

  await context.setOffline(true);
  await expect(page.getByText("Sem ligação", { exact: true })).toBeVisible();
  await expect(page.getByText(/sobe sozinho quando a rede voltar/)).toBeVisible();
  await expect(page.getByRole("searchbox")).toBeDisabled();
  await expect(page.getByPlaceholder("A pesquisa precisa de rede")).toBeVisible();
  await expect(page.getByRole("link", { name: /Para a viagem/ })).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText("Sem ligação", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("searchbox")).toBeEnabled();
  await expect(page.getByText("Sugestao 1").first()).toBeVisible();
});

test("marcar um episódio tira a série de «Por começar» e põe-na em curso", async ({ page, tmdb }) => {
  tmdb.tvmaze[495] = [3];
  await semear(page, {
    series: [
      {
        uuid: "s-1",
        name: "Guardada",
        tvmazeId: 495,
        numeracao: "tvmaze",
        totalEpisodes: 3,
        followed: false,
        inWatchlist: true,
      },
    ],
  });
  await page.goto("/library?filtro=por-comecar");
  await expect(page.getByText("Guardada").first()).toBeVisible();

  await page.goto("/series/s-1");
  await page.getByTestId("ep-1-1").click();
  await expect(page.getByTestId("ep-1-1")).toHaveAttribute("aria-pressed", "true");

  await page.goto("/library?filtro=por-comecar");
  await page.getByRole("heading", { level: 1, name: "Biblioteca" }).waitFor();
  await expect(page.getByText("Guardada")).toHaveCount(0);
  await page.goto("/library?filtro=a-ver");
  await expect(page.getByText("Guardada").first()).toBeVisible();
});

test("tocar na capa abre a ficha da sugestão, sem a guardar; dá para guardar lá de dentro", async ({
  page,
  tmdb,
}) => {
  tmdb.tendencias = [{ ...sugestoes(1)[0], overview: "Uma sinopse de teste." }];
  await semear(page, {});
  await page.goto("/explorar");

  await page.getByRole("button", { name: "Abrir Sugestao 1" }).click();
  const ficha = page.getByRole("dialog");
  await expect(ficha.getByText("Uma sinopse de teste.")).toBeVisible();
  await expect(ficha.getByText("Onde ver", { exact: false }).first()).toBeVisible();

  // só espreitar não guarda nada
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Na lista", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Abrir Sugestao 1" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Por começar" }).click();
  await expect(page.getByRole("dialog").getByText("Na lista", { exact: true })).toBeVisible();
});

test("a ficha de uma série diz quantas temporadas e episódios tem; a de um filme, a duração", async ({
  page,
  tmdb,
}) => {
  tmdb.tendencias = [sugestoes(1, 950)[0]];
  Object.assign(tmdb.series, serieCompleta(950, "Sugestao 1", [8, 10, 12]).series);
  await semear(page, {});
  await page.goto("/explorar");
  await page.getByRole("button", { name: "Abrir Sugestao 1" }).click();
  const ficha = page.getByRole("dialog");
  await expect(ficha.getByTestId("ficha-temporadas")).toHaveText("3");
  await expect(ficha.getByTestId("ficha-episodios")).toHaveText("30");
  await expect(ficha.getByText("temporadas", { exact: true })).toBeVisible();
});

test("uma série de uma só temporada diz «temporada», no singular", async ({ page, tmdb }) => {
  tmdb.tendencias = [sugestoes(1, 951)[0]];
  Object.assign(tmdb.series, serieCompleta(951, "Sugestao 1", [6]).series);
  await semear(page, {});
  await page.goto("/explorar");
  await page.getByRole("button", { name: "Abrir Sugestao 1" }).click();
  await expect(page.getByRole("dialog").getByText("temporada", { exact: true })).toBeVisible();
  await expect(page.getByTestId("ficha-episodios")).toHaveText("6");
});

test("a ficha diz o título uma só vez, e nada na app liga ao The Movie DB", async ({ page, tmdb }) => {
  tmdb.tendencias = [sugestoes(1, 960)[0]];
  await semear(page, {
    filmes: [{ key: "f-1", name: "Filme Um", tmdbId: 960, watchedAt: null }],
  });
  await page.goto("/explorar");
  await page.getByRole("button", { name: "Abrir Sugestao 1" }).click();
  await expect(page.getByRole("dialog").getByText("Sugestao 1", { exact: true })).toHaveCount(1);

  await page.goto("/movies/f-1");
  await page.getByRole("heading", { level: 1 }).waitFor();
  await expect(page.locator('a[href*="themoviedb.org"]')).toHaveCount(0);
  await expect(page.getByText("Ver na TMDB")).toHaveCount(0);
});

test("«Onde ver» não é uma ligação (levava à página da TMDB) e a nota leva ao IMDb", async ({
  page,
  tmdb,
}) => {
  tmdb.tendencias = [{ ...sugestoes(1, 970)[0], vote_average: 8.1 }];
  Object.assign(tmdb.series, serieCompleta(970, "Sugestao 1", [2]).series);
  tmdb.ondeVer["tv:970"] = ["HBO Max"];
  tmdb.imdb["tv:970"] = "tt1234567";
  await semear(page, {});
  await page.goto("/explorar");
  await page.getByRole("button", { name: "Abrir Sugestao 1" }).click();
  const ficha = page.getByRole("dialog");

  await expect(ficha.getByTestId("onde-ver")).toContainText("HBO Max");
  await expect(ficha.getByTestId("onde-ver")).not.toHaveAttribute("href", /.+/);
  await expect(ficha.locator('a[href*="themoviedb.org"], a[href*="exemplo/onde-ver"]')).toHaveCount(0);

  const imdb = ficha.getByRole("link", { name: /IMDb/ });
  await expect(imdb).toHaveAttribute("href", "https://www.imdb.com/title/tt1234567/");
});

test("sem id do IMDb não há ligação inventada", async ({ page, tmdb }) => {
  tmdb.tendencias = [sugestoes(1, 971)[0]];
  await semear(page, {});
  await page.goto("/explorar");
  await page.getByRole("button", { name: "Abrir Sugestao 1" }).click();
  await expect(page.getByRole("dialog").getByText("Sem sinopse disponível.")).toBeVisible();
  await expect(page.getByRole("link", { name: /IMDb/ })).toHaveCount(0);
});

test("com a ficha aberta a página de trás não rola (deixava um vão em baixo ao rolar)", async ({
  page,
  tmdb,
}) => {
  tmdb.tendencias = sugestoes(9);
  await semear(page, {
    listas: [1, 2, 3, 4, 5, 6].map((n) => ({ id: `l-${n}`, name: `Lista ${n}`, items: [] })),
  });
  await page.setViewportSize({ width: 390, height: 600 });
  await page.goto("/explorar");
  await page.getByRole("button", { name: "Abrir Sugestao 1" }).waitFor();
  await page.getByRole("button", { name: "Abrir Sugestao 1" }).click();
  await page.getByRole("dialog").waitFor();

  // (o WebKit móvel não deixa simular a roda: mede-se o que a impede)
  const overflow = () => page.evaluate(() => getComputedStyle(document.documentElement).overflowY);
  expect(await overflow()).toBe("hidden");
  const painel = page.locator("[data-folha]");
  expect(await painel.evaluate((el) => getComputedStyle(el).overscrollBehaviorY)).toBe("contain");

  // e fechada, a página volta a rolar
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await overflow()).not.toBe("hidden");
});
