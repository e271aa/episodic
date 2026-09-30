import { test, expect } from "./apoio/base";
import { semear } from "./apoio/semear";

/**
 * Ronda 14, Fase 1 — as fundações da Mira: tema noite/claro, Dynamic Type,
 * espaço em px, a barra de separadores e as primitivas — nos ecrãs onde
 * vivem (a vitrine `/mira` saiu na Fase 12).
 */

const fundoDoCorpo = (page: import("@playwright/test").Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test("Aparência: «Claro» fica escolhido depois de recarregar, sem piscar, e a barra de estado acompanha", async ({
  page,
}) => {
  await semear(page, {});
  await page.goto("/profile/definicoes");
  expect(await fundoDoCorpo(page)).toBe("rgb(0, 0, 0)");
  await page.getByRole("radio", { name: "Claro" }).click();
  await expect.poll(() => fundoDoCorpo(page)).toBe("rgb(242, 242, 247)");
  // a barra de estado muda logo, não só depois de recarregar
  const metasJa = await page.evaluate(() =>
    [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.getAttribute("content")),
  );
  expect(metasJa).toEqual(["#f2f2f7", "#f2f2f7"]);

  await page.reload();
  // o script do <head> põe o tema antes da app: já está no HTML ao chegar
  expect(await page.evaluate(() => document.documentElement.getAttribute("data-theme"))).toBe("claro");
  expect(await fundoDoCorpo(page)).toBe("rgb(242, 242, 247)");
  await expect(page.getByRole("radio", { name: "Claro" })).toHaveAttribute("aria-checked", "true");
  const metas = await page.evaluate(() =>
    [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.getAttribute("content")),
  );
  // exatamente duas, e só nossas: o React voltava a inserir uma terceira (#000)
  expect(metas).toHaveLength(2);
  for (const m of metas) expect(m).toBe("#f2f2f7");

  // «Automático» volta a seguir o sistema (noite, nos testes)
  await page.getByRole("radio", { name: "Automático" }).click();
  await expect.poll(() => fundoDoCorpo(page)).toBe("rgb(0, 0, 0)");
  expect(await page.evaluate(() => document.documentElement.hasAttribute("data-theme"))).toBe(false);
});

test.describe("com o sistema em modo claro", () => {
  test.use({ colorScheme: "light" });
  test("«Automático» segue o sistema, e a ação principal passa a preta", async ({ page }) => {
    await semear(page, {});
    await page.goto("/library");
    expect(await fundoDoCorpo(page)).toBe("rgb(242, 242, 247)");
    const acao = page.getByRole("button", { name: "Procurar uma série" });
    expect(await acao.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(0, 0, 0)");
  });
});

test("Dynamic Type só no iOS: fora dele a base é 17px, não os 13 do macOS", async ({ page }) => {
  // O WebKit do Mac (o dos testes) dá 13px a `-apple-system-body`; sem a
  // guarda `@supports (-webkit-touch-callout)` a app encolhia toda.
  await semear(page, {});
  await page.goto("/series");
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe("17px");
});

test("os alvos de toque ficam em 44px mesmo com o texto do sistema pequeno", async ({ page, tmdb }) => {
  // O Ruben tem o corpo a 15px. Com o espaço em rem, `min-h-11` dava 41px.
  const texto15 = () =>
    page.evaluate(() => {
      document.documentElement.style.fontSize = "15px";
    });
  tmdb.tendencias = [{ id: 701, name: "Tendencia", poster_path: "/cartaz.jpg", backdrop_path: null, overview: "", first_air_date: "2022-01-01", vote_average: 7 }];
  await semear(page, {});
  await page.goto("/explorar");
  await texto15();
  // o cartaz entra a 0,98 de escala (`poster-in`): mede-se em repouso
  const pequena = page.getByRole("button", { name: "Por começar" }).first();
  await expect.poll(async () => (await pequena.boundingBox())!.height).toBeGreaterThanOrEqual(44);

  await page.goto("/profile/definicoes");
  await texto15();
  const segmento = page.getByRole("radio", { name: "Noite" });
  expect((await segmento.boundingBox())!.height).toBeGreaterThanOrEqual(38);
  const grupo = page.getByRole("radiogroup", { name: "Aparência" });
  expect((await grupo.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});

test("a barra de separadores mostra os quatro nomes; a 320px com texto a 150% fica só o ícone, maior", async ({
  page,
}) => {
  await semear(page, {});
  await page.goto("/series");
  const nav = page.getByRole("navigation", { name: "Separadores" });
  for (const nome of ["A seguir", "Explorar", "Biblioteca", "Perfil"])
    await expect(nav.getByText(nome, { exact: true })).toBeVisible();

  await page.setViewportSize({ width: 320, height: 664 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "150%";
  });
  await expect(nav.getByText("Biblioteca", { exact: true })).toBeHidden();
  // o nome continua a ser o do link, para o VoiceOver
  await expect(nav.getByRole("link", { name: "Biblioteca", exact: true })).toBeVisible();
  const icone = (await nav.locator('a[href="/library"] svg').boundingBox())!;
  expect(icone.width).toBeGreaterThanOrEqual(27);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test("o segmentado é uma escolha (rádio), e a escolha não é a cápsula branca da ação", async ({ page }) => {
  await semear(page, {});
  await page.goto("/library");
  const filmes = page.getByRole("radio", { name: /^Filmes/ });
  await filmes.click();
  await expect(filmes).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("radio", { name: /^Séries/ })).toHaveAttribute("aria-checked", "false");
  await page.waitForTimeout(250);
  const fundo = await filmes.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(fundo).not.toBe("rgb(255, 255, 255)");
});

test("o filtro abre como um menu, com o foco na escolha, e fecha com Esc", async ({ page }) => {
  await semear(page, {
    series: [
      { uuid: "s-1", name: "Alfa" },
      { uuid: "s-2", name: "Beta" },
    ],
    vistos: [{ showUuid: "s-1", season: 1, episode: 1 }],
  });
  await page.goto("/library");
  const botao = page.getByRole("button", { name: /^Filtrar séries/ });
  await expect(botao).toContainText("Todas");
  await botao.click();
  const menu = page.getByRole("menu", { name: "Filtrar séries" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitemradio", { name: /Todas/ })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();

  await botao.click();
  await page.getByRole("menuitemradio", { name: /Por começar/ }).click();
  await expect(botao).toContainText("Por começar");
  await expect(page.getByRole("menu")).toBeHidden();
});
