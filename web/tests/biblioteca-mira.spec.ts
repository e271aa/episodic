import { test, expect } from "./apoio/base";
import { semear, type EpisodioVisto, type SerieSemeada } from "./apoio/semear";

/**
 * Ronda 14, Fase 5 — a Biblioteca da Mira (B·3 e B·E4). A pergunta do ecrã é
 * «onde está aquela série?», e a resposta acaba quase sempre em abrir uma e
 * recuar: filtro, separador, ordem, pesquisa e o sítio onde se ia têm de
 * estar como se deixaram. Tudo aqui é comportamento — recuar a sério, com o
 * histórico do browser — e não classes nem cores.
 */

const NOME_LONGO = "The Assassination of Gianni Versace: American Crime Story";

/** 9 a meio (3 de 10 vistos), o resto seguido sem nada visto: 138 no total. */
function biblioteca() {
  const series: SerieSemeada[] = [];
  const vistos: EpisodioVisto[] = [];
  for (let i = 0; i < 138; i++) {
    const uuid = `s-${i}`;
    const aMeio = i < 9;
    series.push({
      uuid,
      name: i === 137 ? NOME_LONGO : `Serie ${String(i).padStart(3, "0")}`,
      totalEpisodes: 10,
      followed: true,
    });
    if (aMeio)
      for (let e = 1; e <= 3; e++)
        vistos.push({
          showUuid: uuid,
          season: 1,
          episode: e,
          watchedAt: new Date(Date.now() - (i + 1) * 86_400_000).toISOString(),
        });
  }
  return { series, vistos };
}

const FILMES = [
  { key: "f-a", name: "Filme A", releaseDate: "2001-05-01", watchedAt: null },
  { key: "f-b", name: "Filme B", releaseDate: "2011-05-01", watchedAt: null },
  { key: "f-c", name: "Filme C", releaseDate: "2021-05-01", watchedAt: "2024-01-01T00:00:00.000Z" },
];

test("ao rolar, a barra compacta fica presa ao topo e os cabeçalhos das secções ficam por baixo dela", async ({
  page,
}) => {
  await semear(page, biblioteca());
  await page.goto("/library");
  await page.getByRole("heading", { level: 1, name: "Biblioteca" }).waitFor();

  await page.evaluate(() => window.scrollTo(0, 1500));
  // o resumo diz o filtro e quantas séries mostra
  const resumo = page.getByText("Todas · 138", { exact: true });
  await expect.poll(async () => (await resumo.boundingBox())?.y ?? -9999).toBeGreaterThanOrEqual(0);
  const barra = (await resumo.boundingBox())!;
  expect(barra.y).toBeLessThan(80);

  // «Por começar» é a secção que está a rolar: o cabeçalho cola-se logo por
  // baixo da barra, não escondido atrás dela
  const secao = page.locator('[data-testid="library-grid"] section div.sticky', {
    hasText: "Por começar",
  });
  const topoSecao = (await secao.boundingBox())!.y;
  expect(topoSecao).toBeGreaterThanOrEqual(barra.y + barra.height - 2);
  expect(topoSecao).toBeLessThan(barra.y + barra.height + 40);
});

test("filtro, separador e ordenação sobrevivem a recuar", async ({ page }) => {
  await semear(page, { ...biblioteca(), filmes: FILMES });
  await page.goto("/library");

  await page.getByRole("radio", { name: /^Filmes/ }).click();
  await page.getByRole("button", { name: /^Filtrar filmes/ }).click();
  await page.getByRole("menuitemradio", { name: /^Para ver/ }).click();
  await expect(page).toHaveURL(/filtro=para-ver/);
  await page.getByRole("button", { name: /^Ordenar filmes/ }).click();
  await page.getByRole("menuitemradio", { name: "A–Z" }).click();
  await expect(page).toHaveURL(/ordem=az/);

  await page.locator('a[href="/movies/f-a"]').click();
  await expect(page).toHaveURL(/\/movies\/f-a$/);
  await page.goBack();

  await expect(page.getByRole("radio", { name: /^Filmes/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("button", { name: "Filtrar filmes: Para ver" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ordenar filmes: A–Z" })).toBeVisible();
  // e só os «para ver» estão à vista
  await expect(page.locator('a[href="/movies/f-a"]')).toBeVisible();
  await expect(page.locator('a[href="/movies/f-c"]')).toHaveCount(0);
});

test("o sítio onde se ia na lista sobrevive a recuar", async ({ page }) => {
  await semear(page, biblioteca());
  await page.goto("/library");
  await page.getByRole("heading", { level: 1, name: "Biblioteca" }).waitFor();

  await page.evaluate(() => window.scrollTo(0, 3000));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(2900);
  // um cartaz à vista, ao meio do ecrã
  const cartaz = page.locator('a[href^="/series/"]').filter({
    has: page.locator("p"),
  });
  const escolhido = await cartaz.evaluateAll((els) => {
    const meio = innerHeight / 2;
    const el = els.find((e) => {
      const r = e.getBoundingClientRect();
      return r.top < meio && r.bottom > meio;
    });
    return el?.getAttribute("href") ?? null;
  });
  expect(escolhido).not.toBeNull();
  await page.locator(`a[href="${escolhido}"]`).click();
  await expect(page).toHaveURL(new RegExp(`${escolhido}$`));

  await page.goBack();
  await expect(page).toHaveURL(/\/library$/);
  await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 5000 }).toBeGreaterThan(2700);
});

test("o que se procurou sobrevive a recuar", async ({ page }) => {
  await semear(page, biblioteca());
  await page.goto("/library");

  await page.getByTestId("search-input").fill("Serie 04");
  await expect(page.locator('a[href^="/series/"]').first()).toBeVisible();
  const primeiro = await page.locator('a[href^="/series/"]').first().getAttribute("href");
  await page.locator(`a[href="${primeiro}"]`).click();
  await expect(page).toHaveURL(new RegExp(`${primeiro}$`));
  await page.goBack();

  await expect(page.getByTestId("search-input")).toHaveValue("Serie 04");
  await expect(page.locator(`a[href="${primeiro}"]`)).toBeVisible();
});

test("o filtro é um menu com as contagens, e a barra compacta acompanha-o", async ({ page }) => {
  await semear(page, biblioteca());
  await page.goto("/library");

  await page.getByRole("button", { name: /^Filtrar séries/ }).click();
  await expect(page.getByRole("menuitemradio", { name: /^Todas/ })).toContainText("138");
  await expect(page.getByRole("menuitemradio", { name: /^Em curso/ })).toContainText("9");
  await page.getByRole("menuitemradio", { name: /^Em curso/ }).click();

  await expect(page).toHaveURL(/filtro=a-ver/);
  await expect(page.locator('a[href^="/series/"]')).toHaveCount(9);
  await expect(page.getByText("Em curso · 9", { exact: true })).toBeAttached();
});

test("uma capa em falta diz o nome, e um título de 55 caracteres fica em duas linhas", async ({
  page,
}) => {
  await semear(page, biblioteca());
  await page.goto("/library");
  await page.getByTestId("search-input").fill("Versace");

  const cartaz = page.locator('a[href="/series/s-137"]');
  await expect(cartaz).toBeVisible();
  // sem capa: o próprio cartaz lê-se (o nome dentro da caixa da capa)…
  await expect(cartaz.locator("div", { hasText: NOME_LONGO }).first().locator("span")).toBeVisible();
  // …e por baixo, o título não passa de duas linhas
  const titulo = cartaz.locator("p", { hasText: NOME_LONGO }).first();
  const { altura, linha } = await titulo.evaluate((el) => ({
    altura: el.getBoundingClientRect().height,
    linha: parseFloat(getComputedStyle(el).lineHeight),
  }));
  expect(altura).toBeLessThanOrEqual(linha * 2 + 1);
  expect(altura).toBeGreaterThan(linha * 1.5);
});

test("as séries sem marcar há mais de 30 dias saem de «Em curso» para «Retomar», e voltam ao marcar", async ({
  page,
}) => {
  const haDias = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
  const nomes: [string, number[]][] = [
    ["Hoje", [1]], //                 a ver agora
    ["Faz 29 dias", [29]], //          ainda dentro dos 30
    ["Faz 31 dias", [31]], //          parada
    ["Faz 90 dias", [90]], //          parada
    ["Voltou", [90, 89, 2]], //        parada até ao dia em que voltou a marcar
  ];
  const series: SerieSemeada[] = [];
  const vistos: EpisodioVisto[] = [];
  nomes.forEach(([name, dias], i) => {
    series.push({ uuid: `s-${i}`, name, totalEpisodes: 10, followed: true });
    dias.forEach((d, e) =>
      vistos.push({ showUuid: `s-${i}`, season: 1, episode: e + 1, watchedAt: haDias(d) }),
    );
  });
  await semear(page, { series, vistos });
  await page.goto("/library");

  // «Em curso» é o que se está a ver; as paradas têm a secção delas, logo a seguir
  const seccoes = page.locator('[data-testid="library-grid"] section div.sticky');
  await expect(seccoes).toHaveText([/Em curso3/, /Retomar2/]);

  await page.getByRole("button", { name: /^Filtrar séries/ }).click();
  await expect(page.getByRole("menuitemradio", { name: /^Em curso\s*3$/ })).toBeVisible();
  await page.getByRole("menuitemradio", { name: /^Retomar\s*2$/ }).click();

  await expect(page).toHaveURL(/filtro=retomar/);
  await expect(page.locator('a[href^="/series/"]')).toHaveCount(2);
  await expect(page.locator('a[href="/series/s-2"]')).toBeVisible();
  await expect(page.locator('a[href="/series/s-3"]')).toBeVisible();
  await expect(page.getByText("Retomar · 2", { exact: true })).toBeAttached();
});
