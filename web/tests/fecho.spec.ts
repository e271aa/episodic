import { test, expect } from "./apoio/base";
import { semear, type EpisodioVisto } from "./apoio/semear";
import { serieCompleta } from "./apoio/tmdb";

/**
 * Ronda 12, Fecho — o que a crítica final (27/40, 14/20) encontrou e se
 * corrigiu. Cada teste foi visto a falhar antes da correção.
 */

// ── P1 #1: o A estrear colapsava ──
// A data por extenso vinha à direita com `shrink-0` e comia a linha: o nome
// ficava com 57px a 390px ("Grey's / Anato / my") e 0px a 320px.
for (const largura of [390, 320]) {
  test(`A estrear: o nome e o episódio leem-se inteiros a ${largura}px`, async ({ page, tmdb }) => {
    await page.setViewportSize({ width: largura, height: 664 });
    const daqui20 = new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10);
    const s = serieCompleta(700, "Grey's Anatomy", [8]);
    s.episodios["700:1"][7].air_date = daqui20;
    Object.assign(tmdb.series, s.series);
    Object.assign(tmdb.episodios, s.episodios);
    await semear(page, {
      series: [{ uuid: "s-1", name: "Grey's Anatomy", tmdbId: 700, numeracao: "tmdb", status: "Returning Series" }],
      vistos: [{ showUuid: "s-1", season: 1, episode: 1 }],
    });
    await page.goto("/estrear");
    const nome = page.getByText("Grey's Anatomy", { exact: true });
    await expect(nome).toBeVisible();
    // numa linha só: a altura de uma linha de texto, não três
    const caixa = (await nome.boundingBox())!;
    expect(caixa.height).toBeLessThan(30);
    // o código do episódio não fica cortado em "S01·E…"
    const codigo = page.getByText(/S01\s*·\s*E08/);
    await expect(codigo).toBeVisible();
    const cortado = await codigo.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(cortado).toBe(false);
  });
}

// ── P1 #2: o mapa de calor ──
function eps(uuid: string, ano: number, mes: number, quantos: number): EpisodioVisto[] {
  return Array.from({ length: quantos }, (_, i) => ({
    showUuid: uuid,
    season: ano - 2000,
    episode: mes * 100 + i + 1,
    watchedAt: `${ano}-${String(mes).padStart(2, "0")}-${String((i % 27) + 1).padStart(2, "0")}T20:00:00.000Z`,
  }));
}

test("mapa de calor: cada mês é um alvo de pelo menos 24px (WCAG 2.5.8)", async ({ page }) => {
  await semear(page, {
    series: [{ uuid: "s-a", name: "Alfa" }],
    vistos: [...eps("s-a", 2021, 3, 4), ...eps("s-a", 2022, 5, 2)],
  });
  await page.goto("/estatisticas");
  const celula = page.getByRole("button", { name: "março de 2021 · 4 episódios" });
  const caixa = (await celula.boundingBox())!;
  expect(caixa.width).toBeGreaterThanOrEqual(24);
  expect(caixa.height).toBeGreaterThanOrEqual(24);
});

test("mapa de calor: com meses parecidos, não fica tudo no degrau de cima", async ({ page }) => {
  // 12 meses entre 15 e 18 episódios — a biblioteca da crítica: com a escala
  // linear até ao máximo, eram todos degrau 3 ou 4, uma parede creme
  const vistos = [15, 16, 17, 18, 15, 16, 17, 18, 15, 16, 17, 18].flatMap((n, i) => eps("s-a", 2021, i + 1, n));
  await semear(page, { series: [{ uuid: "s-a", name: "Alfa" }], vistos });
  await page.goto("/estatisticas");
  const celulas = page.locator("section", { hasText: "Quando viste" }).locator("button[data-degrau]");
  // esperar pelo cartão: o evaluateAll não espera, e lia 0 células
  await expect(celulas).toHaveCount(12);
  const degraus = await celulas
    .evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-degrau"))));
  expect(degraus.filter((d) => d === 4).length).toBeLessThanOrEqual(4);
  expect(new Set(degraus).size).toBeGreaterThanOrEqual(3);
});

test("horas por ano: o destaque é o ano com mais horas, não o último", async ({ page }) => {
  await semear(page, {
    series: [{ uuid: "s-a", name: "Alfa", runtime: 60 }],
    vistos: [...eps("s-a", 2021, 3, 3), ...eps("s-a", 2022, 3, 1)],
  });
  await page.goto("/estatisticas");
  const cartao = page.locator("section", { hasText: "Horas por ano" });
  await expect(cartao.getByTestId("leitura")).toContainText("2021");
});

// ── F2: os P2 objetivos ──

for (const largura of [390, 320]) test(`a dock cabe no ecrã com o texto a 150% (${largura}px)`, async ({ page }) => {
  await page.setViewportSize({ width: largura, height: 664 });
  await semear(page, { series: [{ uuid: "s-1", name: "Alfa" }] });
  // a biblioteca é o rótulo ativo mais comprido: é onde a dock mais se estica
  await page.goto("/library");
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "150%";
  });
  const fora = await page.evaluate(() =>
    [...document.querySelectorAll("nav a")].map((a) => a.getBoundingClientRect().right - innerWidth),
  );
  for (const excesso of fora) expect(excesso).toBeLessThanOrEqual(0);
  const esquerda = await page.evaluate(() => Math.min(...[...document.querySelectorAll("nav a")].map((a) => a.getBoundingClientRect().left)));
  expect(esquerda).toBeGreaterThanOrEqual(0);
});

test("o detalhe de filme não alarga o ecrã com o texto a 150%", async ({ page }) => {
  await semear(page, {
    series: [],
    filmes: [{ key: "tvtime-278", name: "The Shawshank Redemption", releaseDate: "1994-09-23", watchedAt: "2024-05-04T21:00:00.000Z" }],
  });
  await page.goto("/movies/tvtime-278");
  await page.getByRole("heading", { level: 1 }).waitFor();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "150%";
  });
  const l = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, janela: innerWidth }));
  expect(l.doc).toBeLessThanOrEqual(l.janela);
});

test("o detalhe da série não mostra datas em ISO (episódios nem Estreia)", async ({ page, tmdb }) => {
  const s = serieCompleta(710, "Datas", [3]);
  Object.assign(tmdb.series, s.series);
  Object.assign(tmdb.episodios, s.episodios);
  await semear(page, {
    series: [{ uuid: "s-1", name: "Datas", tmdbId: 710, numeracao: "tmdb", firstAired: "2020-01-01" }],
    vistos: [{ showUuid: "s-1", season: 1, episode: 1 }],
  });
  await page.goto("/series/s-1");
  await page.getByTestId("tab-episodios").waitFor();
  const iso = /\b\d{4}-\d{2}-\d{2}\b/;
  await page.getByTestId("season-1").click();
  await expect(page.getByText("1 de janeiro de 2020").first()).toBeVisible();
  expect(await page.locator("main").innerText()).not.toMatch(iso);
  await page.getByTestId("tab-sobre").click();
  await expect(page.getByText("Estreia")).toBeVisible();
  await expect(page.getByText("1 de janeiro de 2020")).toBeVisible();
  expect(await page.locator("main").innerText()).not.toMatch(iso);
});

test("o Importar tem saída, e o texto é verdade num iPhone", async ({ page }) => {
  await page.goto("/import");
  await expect(page.getByRole("button", { name: "Voltar ao perfil" })).toBeVisible();
  const texto = await page.locator("main").innerText();
  expect(texto).not.toContain("Arrasta");
  expect(texto).not.toContain("gdpr.tvtime.com");
});

test("no herói, o texto pequeno sobre a arte não é o cinzento apagado", async ({ page, tmdb }) => {
  const c = serieCompleta(711, "Alfa", [3]);
  Object.assign(tmdb.series, c.series);
  Object.assign(tmdb.episodios, c.episodios);
  await semear(page, {
    series: [{ uuid: "s-1", name: "Alfa", tmdbId: 711, numeracao: "tmdb", posterPath: "/cartaz.jpg", totalEpisodes: 3 }],
    vistos: [{ showUuid: "s-1", season: 1, episode: 1 }],
  });
  await page.goto("/series");
  const eyebrow = page.getByText("Esta noite", { exact: true });
  await expect(eyebrow).toBeVisible();
  // o browser devolve a cor em oklab/color-mix: pinta-se num canvas preto e lê-se o pixel
  const canal = await eyebrow.evaluate((el) => {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    const x = c.getContext("2d")!;
    x.fillStyle = "#000";
    x.fillRect(0, 0, 1, 1);
    x.fillStyle = getComputedStyle(el).color;
    x.fillRect(0, 0, 1, 1);
    return x.getImageData(0, 0, 1, 1).data[0];
  });
  // o cinzento apagado (dim) tem o vermelho a ~130; sobre a arte pede-se mais
  expect(canal).toBeGreaterThanOrEqual(200);
});

test("o foco por teclado vê-se em summary (\"Ver em tabela\")", async ({ page }) => {
  await semear(page, {
    series: [{ uuid: "s-a", name: "Alfa" }],
    vistos: [...eps("s-a", 2021, 3, 2), ...eps("s-a", 2022, 3, 2)],
  });
  await page.goto("/estatisticas");
  await page.locator("summary").first().waitFor();
  // por teclado, como quem usa um teclado: Tab até lá chegar
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    if (await page.evaluate(() => document.activeElement?.tagName === "SUMMARY")) break;
  }
  const contorno = await page.evaluate(() => {
    const el = document.activeElement!;
    const c = getComputedStyle(el);
    return { tag: el.tagName, estilo: c.outlineStyle, largura: c.outlineWidth };
  });
  expect(contorno.tag).toBe("SUMMARY");
  // o contorno do sistema (2px sólido), não o que o browser põe por omissão
  expect(contorno.estilo).toBe("solid");
  expect(contorno.largura).toBe("2px");
});

test("a primeira capa de uma lista não carrega em lazy (é a maior da dobra)", async ({ page }) => {
  await semear(page, {
    series: [{ uuid: "s-1", name: "Alfa", posterPath: "/cartaz.jpg" }],
    listas: [{ id: "l-1", name: "Lista", items: [{ kind: "show", refId: "s-1" }] }],
  });
  await page.goto("/listas/l-1");
  const img = page.locator('a[href="/series/s-1"] img').first();
  await expect(img).toHaveAttribute("loading", "eager");
});

// ── F3: os P3 rápidos ──

test("o Entrar sem cloud também tem um <h1>", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("a Biblioteca vazia tem uma ação: procurar", async ({ page }) => {
  await page.goto("/library");
  const botao = page.getByRole("button", { name: "Procurar uma série" });
  await expect(botao).toBeVisible();
  await botao.click();
  await expect(page.getByTestId("search-input")).toBeVisible();
});

test("no Pôr em dia, um filtro vazio que não está ativo aparece apagado", async ({ page }) => {
  // parada há 60 dias: "Continuar" fica a 0 e a série está em "Retomar"
  await semear(page, {
    series: [{ uuid: "s-1", name: "Parada", totalEpisodes: 3 }],
    vistos: [{ showUuid: "s-1", season: 1, episode: 1, watchedAt: new Date(Date.now() - 60 * 864e5).toISOString() }],
  });
  await page.goto("/em-dia?filtro=retomar");
  const vazio = page.getByRole("button", { name: /^Continuar/ });
  await expect(vazio).toBeVisible();
  expect(await vazio.evaluate((el) => Number(getComputedStyle(el).opacity))).toBeLessThan(0.8);
  const ativo = page.getByRole("button", { name: /^Retomar/ });
  expect(await ativo.evaluate((el) => Number(getComputedStyle(el).opacity))).toBe(1);
});

// ── F4: as decisões do Ruben (29-09) ──

test("Biblioteca: os separadores ficam no topo, por baixo do título, e seguem ao rolar", async ({ page }) => {
  await semear(page, {
    series: Array.from({ length: 45 }, (_, i) => ({ uuid: `s-${i}`, name: `Serie ${i}` })),
  });
  await page.goto("/library");
  const titulo = (await page.getByRole("heading", { name: "Biblioteca" }).boundingBox())!;
  const barra = page.getByTestId("barra-biblioteca");
  const antes = (await barra.boundingBox())!;
  // por baixo do título, na metade de cima do ecrã — e não flutuar em baixo
  expect(antes.y).toBeGreaterThanOrEqual(titulo.y + titulo.height - 1);
  expect(antes.y).toBeLessThan(200);
  // colada ao topo quando se rola: os filtros ficam ao alcance a meio da página
  await page.evaluate(() => window.scrollBy(0, 1500));
  await page.waitForTimeout(300);
  const depois = (await barra.boundingBox())!;
  expect(depois.y).toBeLessThan(80);
  expect(depois.y + depois.height).toBeGreaterThan(0);
});

test("Pôr em dia: a pílula da casa não leva o disco colorido (cor numa ação)", async ({ page, tmdb }) => {
  const c = serieCompleta(720, "Alfa", [3]);
  Object.assign(tmdb.series, c.series);
  Object.assign(tmdb.episodios, c.episodios);
  await semear(page, {
    series: [{ uuid: "s-1", name: "Alfa", tmdbId: 720, numeracao: "tmdb", totalEpisodes: 3 }],
    vistos: [{ showUuid: "s-1", season: 1, episode: 1 }],
  });
  await page.goto("/series");
  const pilula = page.getByRole("link", { name: /^Pôr em dia/ });
  await expect(pilula).toBeVisible();
  await expect(pilula.locator(".bars")).toHaveCount(0);
});

test("Explorar: os títulos aparecem no original, como na biblioteca (o TV Time)", async ({ page, tmdb }) => {
  tmdb.tendencias = [
    { id: 801, name: "Separação", original_name: "Severance", poster_path: "/c.jpg", backdrop_path: null, overview: "", first_air_date: "2022-02-18" },
    // original em japonês: fica o título em português, não o ideograma
    { id: 802, name: "Ataque dos Titãs", original_name: "進撃の巨人", poster_path: "/c.jpg", backdrop_path: null, overview: "", first_air_date: "2013-04-07" },
  ];
  await semear(page, {});
  await page.goto("/explorar");
  await expect(page.getByText("Severance").first()).toBeVisible();
  await expect(page.getByText("Separação")).toHaveCount(0);
  await expect(page.getByText("Ataque dos Titãs").first()).toBeVisible();
});

// ── F5: o que a medição a 320px e a 150% achou ──
for (const largura of [390, 320]) {
  test(`Biblioteca: a barra do topo cabe com o texto a 150% (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 664 });
    await semear(page, {
      series: Array.from({ length: 138 }, (_, i) => ({ uuid: `s-${i}`, name: `Serie ${i}` })),
      filmes: Array.from({ length: 266 }, (_, i) => ({ key: `f-${i}`, name: `Filme ${i}` })),
    });
    await page.goto("/library");
    await page.getByTestId("barra-biblioteca").waitFor();
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "150%";
    });
    await page.waitForTimeout(200);
    const filtros = (await page.getByRole("button", { name: "Filtros e ordenação" }).boundingBox())!;
    expect(filtros.x + filtros.width).toBeLessThanOrEqual(largura);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largura);
  });
}

test("Perfil: a linha dos números cabe a 320px com o texto a 150%", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 664 });
  await semear(page, {
    series: [{ uuid: "s-1", name: "Alfa" }],
    filmes: [{ key: "f-1", name: "Filme", watchedAt: "2024-05-04T21:00:00.000Z" }],
    vistos: [{ showUuid: "s-1", season: 1, episode: 1 }],
  });
  await page.goto("/profile");
  await page.getByText("ver tudo →").waitFor();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "150%";
  });
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

// O rótulo do separador ativo não parte em duas linhas — a 320px E a 150%, que é
// onde a dock aperta depois do teto de espaço da F5 (a 320px normais já cabia).
test("a dock não parte o rótulo ativo a 320px com o texto a 150%", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 664 });
  await semear(page, { series: [{ uuid: "s-1", name: "Alfa" }] });
  await page.goto("/series");
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "150%";
  });
  await page.waitForTimeout(200);
  const ativo = page.locator('nav a[aria-current="page"]');
  const altura = (await ativo.boundingBox())!.height;
  // uma linha: a altura mínima de um alvo (44px a 150% = 66), não duas linhas de texto
  expect(altura).toBeLessThan(75);
});
