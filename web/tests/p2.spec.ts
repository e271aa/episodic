import { test, expect } from "./apoio/base";
import { semear } from "./apoio/semear";
import { serieCompleta, type Catalogo } from "./apoio/tmdb";

/**
 * Ronda 12, Fase 5d — os P2 da crítica 5b.4 (AUDITORIA.md). Os que a regra
 * já decidia (a Bars Rule, a Inverted Action Rule, o que o rótulo promete)
 * e os que o Ruben escolheu a 28-09.
 */

// o «por marcar» da Mira, modo noite (#64d2ff)
const CIANO = "rgb(100, 210, 255)";
/** as 4 neutras da mira — cinza, amarelo, vermelho, azul */
// as quatro neutras da mira (Mira, Ronda 14): cinza, amarelo, vermelho, azul
const TINTA = "rgb(245, 243, 238)";

const diaDaqui = (dias: number) => new Date(Date.now() + dias * 864e5).toISOString().slice(0, 10);

/** Uma série da TMDB com o último episódio a estrear daqui a `dias`. */
function aEstrear(tmdb: Catalogo, id: number, nome: string, dias: number) {
  const s = serieCompleta(id, nome, [8]);
  s.episodios[`${id}:1`][7].air_date = diaDaqui(dias);
  // ainda no ar: o `serieCompleta` diz "Ended", o enriquecimento copia o
  // estado para a série, e uma série terminada não tem estreias — a secção
  // aparecia e desaparecia a meio do teste
  s.series[id].status = "Returning Series";
  Object.assign(tmdb.series, s.series);
  Object.assign(tmdb.episodios, s.episodios);
}

// ── cores ────────────────────────────────────────────────────

test("'Esta semana' e 'Por começar' usam as cores neutras, não as dos estados", async ({
  page,
  tmdb,
}) => {
  // "Esta semana" tinha o ciano fixo (o dos buracos) e "Por começar" o
  // amarelo. A Bars Rule: um cabeçalho só usa as 4 neutras, e na
  // Biblioteca o que não é "Em curso" nem "Completas" é cinza.
  aEstrear(tmdb, 600, "Andor", 3);
  await semear(page, {
    series: [
      { uuid: "s-1", name: "Andor", tmdbId: 600, numeracao: "tmdb", status: "Returning Series" },
    ],
    vistos: [{ showUuid: "s-1", season: 1, episode: 1 }],
  });
  await page.goto("/series");
  // o calendário chega depois do herói. Na casa da Mira o cabeçalho não
  // leva cor nenhuma — a mira é só do ritual e do «sem sinal» (Regra da
  // mira, Fase 3): a v2 punha-lhe uma barrinha, e a crítica apanhou-a vermelha
  const semana = page.getByRole("heading", { level: 2, name: "Esta semana" });
  await semana.waitFor({ timeout: 15000 });
  const cores = await semana.evaluate((h) =>
    [...(h.parentElement?.querySelectorAll("*") ?? [])]
      .map((el) => getComputedStyle(el).backgroundColor)
      .filter((c) => c !== "rgba(0, 0, 0, 0)"),
  );
  expect(cores).toEqual([]);

  // e na Biblioteca é igual: nenhum cabeçalho de secção leva cor
  await semear(page, {
    series: [{ uuid: "s-2", name: "Nunca Vista" }, { uuid: "s-3", name: "A Meio", totalEpisodes: 4 }],
    vistos: [{ showUuid: "s-3", season: 1, episode: 1 }],
  });
  await page.goto("/library");
  const secao = page.getByRole("heading", { level: 2, name: /Por começar/ }).first();
  await secao.waitFor();
  const coresBiblioteca = await secao.evaluate((h) =>
    [...(h.parentElement?.querySelectorAll("*") ?? [])]
      .map((el) => getComputedStyle(el).backgroundColor)
      .filter((c) => c !== "rgba(0, 0, 0, 0)"),
  );
  expect(coresBiblioteca).toEqual([]);
});

test("no detalhe, com buracos para trás, o traço do estado é o ciano dos buracos", async ({
  page,
  tmdb,
}) => {
  tmdb.tvmaze[495] = [13, 51, 51];
  const vistos = [];
  for (const [t, n] of [
    [1, 13],
    [2, 51],
    [3, 51],
  ]) {
    for (let e = 1; e <= n; e++) {
      if (t === 2 && e >= 20 && e <= 41) continue;
      vistos.push({ showUuid: "s-1", season: t, episode: e });
    }
  }
  await semear(page, {
    series: [{ uuid: "s-1", name: "Naruto", tvmazeId: 495, numeracao: "tvmaze", totalEpisodes: 115 }],
    vistos,
  });
  await page.goto("/series/s-1");
  const traco = page.getByTestId("heroi-traco");
  await expect(traco).toBeAttached();
  // os buracos contam-se depois de as temporadas chegarem
  await expect.poll(() => traco.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(CIANO);
});

// ── o que o rótulo promete ───────────────────────────────────

test("'Esta semana' mostra os próximos 7 dias, não o que estreia daqui a 17", async ({
  page,
  tmdb,
}) => {
  aEstrear(tmdb, 600, "Andor", 3);
  aEstrear(tmdb, 601, "Silo", 17);
  await semear(page, {
    series: [
      { uuid: "s-1", name: "Andor", tmdbId: 600, numeracao: "tmdb", status: "Returning Series" },
      { uuid: "s-2", name: "Silo", tmdbId: 601, numeracao: "tmdb", status: "Returning Series" },
    ],
    vistos: [
      { showUuid: "s-1", season: 1, episode: 1 },
      { showUuid: "s-2", season: 1, episode: 1 },
    ],
  });
  await page.goto("/series");
  const semana = page.locator("section", {
    has: page.getByRole("heading", { level: 2, name: "Esta semana" }),
  });
  await expect(semana).toContainText("Andor", { timeout: 15000 });
  await expect(semana).not.toContainText("Silo");
  // o resto continua a um toque, no A estrear
  await expect(semana.getByRole("link", { name: /ver tudo/ })).toHaveAttribute("href", "/estrear");
});

test("sem nada esta semana, a secção diz quando é o próximo — e não perde a porta do A estrear", async ({
  page,
  tmdb,
}) => {
  aEstrear(tmdb, 601, "Silo", 17);
  await semear(page, {
    series: [
      { uuid: "s-2", name: "Silo", tmdbId: 601, numeracao: "tmdb", status: "Returning Series" },
    ],
    vistos: [{ showUuid: "s-2", season: 1, episode: 1 }],
  });
  await page.goto("/series");
  const semana = page.locator("section", {
    has: page.getByRole("heading", { level: 2, name: "Esta semana" }),
  });
  await expect(semana).toContainText("Nada esta semana", { timeout: 15000 });
  await expect(semana).not.toContainText("S01·E08");
  await expect(semana.getByRole("link", { name: /ver tudo/ })).toHaveAttribute("href", "/estrear");
});

test("o A estrear não corta o nome da série", async ({ page, tmdb }) => {
  const nome = "The Marvelous Mrs. Maisel: A Última Temporada";
  aEstrear(tmdb, 602, nome, 3);
  await semear(page, {
    series: [{ uuid: "s-1", name: nome, tmdbId: 602, numeracao: "tmdb", status: "Returning Series" }],
    vistos: [{ showUuid: "s-1", season: 1, episode: 1 }],
  });
  await page.goto("/estrear");
  const titulo = page.getByText(nome, { exact: true });
  await expect(titulo).toBeVisible();
  const cabe = await titulo.evaluate(
    (el) => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight + 1,
  );
  expect(cabe).toBe(true);
});

// ── o que faltava poder fazer, e o que ficava tapado ─────────

test("um filme visto desmarca-se — volta a 'para ver' — e o desmarcar anula-se", async ({
  page,
}) => {
  // Marcar era para sempre: nem desmarcar, nem corrigir, depois de o aviso
  // de anular passar (movies/[key], achado da 5b.4).
  await semear(page, {
    filmes: [{ key: "f-1", name: "Past Lives", watchedAt: "2025-05-01T21:00:00.000Z" }],
  });
  await page.goto("/movies/f-1");
  await expect(page.getByText(/^Visto a/)).toBeVisible();
  await page.getByRole("button", { name: "Desmarcar como visto" }).click();
  await expect(page.getByText("Na lista para ver")).toBeVisible();
  await page.getByTestId("undo-button").click();
  await expect(page.getByText(/^Visto a/)).toBeVisible();

  // e fica gravado
  await page.getByRole("button", { name: "Desmarcar como visto" }).click();
  await expect(page.getByText("Na lista para ver")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Na lista para ver")).toBeVisible();
});

test("com o texto a 150%, o detalhe da série não sai do ecrã, e o «···» continua a um toque", async ({
  page,
  tmdb,
}) => {
  // "Estatísticas" chegava aos 428px num ecrã de 390 (medido na 5b.4).
  tmdb.tvmaze[495] = [5];
  await semear(page, {
    series: [{ uuid: "s-1", name: "Severance", tvmazeId: 495, numeracao: "tvmaze" }],
  });
  await page.goto("/series/s-1");
  await page.getByTestId("temporadas").waitFor();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "150%";
  });
  const larguras = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    janela: innerWidth,
  }));
  expect(larguras.doc).toBeLessThanOrEqual(larguras.janela);
  await page.getByTestId("menu-serie").click();
  await page.getByRole("button", { name: /^Estatísticas/ }).click();
  await expect(page.locator("#painel-estatisticas")).toBeVisible();
});

test("no Rever, as saídas do cartão estão acima da dock ao chegar — mesmo com três botões", async ({
  page,
  tmdb,
}) => {
  // Buracos para trás E episódios à frente: "Marcar os 2 de trás", "Vi
  // tudo · também…" e "Ainda estou a ver" — e "Deixei de ver" e "Decidir
  // depois" ficavam debaixo da dock (0% livres ao chegar, 5b.4).
  tmdb.tvmaze[806] = [2, 2, 2];
  await semear(page, {
    series: [{ uuid: "s-1", name: "Buracos E Frente", tvmazeId: 806, numeracao: "tvmaze" }],
    vistos: [
      { showUuid: "s-1", season: 2, episode: 1 },
      { showUuid: "s-1", season: 2, episode: 2 },
    ],
  });
  await page.goto("/rever");
  await expect(page.getByRole("button", { name: /^Vi tudo/ })).toBeVisible();
  const dock = (await page.locator("nav > div").last().boundingBox())!;
  for (const nome of [/Deixei de ver/, /Decidir depois/]) {
    const caixa = (await page.getByRole("button", { name: nome }).boundingBox())!;
    expect(caixa.y + caixa.height).toBeLessThanOrEqual(dock.y);
  }
});

test("o aviso de anular não tapa o 'Marcar visto' da casa, nem a dock", async ({ page, tmdb }) => {
  // Sem "Ou então", o botão ficava nos 486–546px e o aviso começava nos
  // 527: 19px do botão por baixo do aviso durante os 7 segundos — e o aviso
  // entrava 10px na dock (medido na Fase 6).
  const hoje = new Date().toISOString();
  Object.assign(tmdb.series, serieCompleta(500, "Severance", [9]).series);
  Object.assign(tmdb.episodios, serieCompleta(500, "Severance", [9]).episodios);
  await semear(page, {
    series: [{ uuid: "s-1", name: "Severance", tmdbId: 500, numeracao: "tmdb" }],
    vistos: [{ showUuid: "s-1", season: 1, episode: 1, watchedAt: hoje }],
    kv: {
      "nextup-cache": {
        "s-1": {
          episode: { season: 1, episode: 2, name: "Episódio 2", airDate: "2020-01-01" },
          lastWatchedAt: hoje,
        },
      },
    },
  });
  await page.goto("/series");
  const botao = page.getByRole("button", { name: "Marcar visto" });
  await botao.waitFor();
  // `dispatchEvent`, não `click()`: o Playwright rola a página até o botão
  // antes de tocar, e a casa tem 772px — o teste media-se a ele próprio e
  // deixava passar o aviso por cima do botão (a mutação sobreviveu). O dedo
  // toca onde o botão está, sem rolar nada.
  await page.evaluate(() => window.scrollTo(0, 0));
  await botao.dispatchEvent("click");
  const aviso = page.getByTestId("undo-toast");
  await expect(aviso).toBeVisible();
  await page.waitForTimeout(300); // o aviso acabou de entrar
  const b = (await botao.boundingBox())!;
  const a = (await aviso.boundingBox())!;
  const dock = (await page.locator("nav > div").last().boundingBox())!;
  expect(b.y + b.height).toBeLessThanOrEqual(a.y);
  expect(a.y + a.height).toBeLessThanOrEqual(dock.y);
});

// ── as escolhas do Ruben (28-09) ─────────────────────────────

test("o ✓ de cada cartaz 'para ver' é um círculo escuro sobre a arte, não uma pílula branca", async ({
  page,
}) => {
  await semear(page, { filmes: [{ key: "f-1", name: "Past Lives", watchedAt: null }] });
  await page.goto("/library?tipo=filmes");
  const marcar = page.getByRole("button", { name: "Marcar Past Lives como visto" });
  await expect(marcar).toBeVisible();
  // o botão é o alvo de 44px (transparente); o círculo de vidro é o de dentro
  const fundo = await marcar
    .locator("span")
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(fundo).not.toBe(TINTA);
  // o vidro escuro do recuar sobre a arte: meio transparente (o Tailwind 4
  // dá-o em `lab(… / 0.6)`, o WebKit às vezes em `rgba(…, 0.6)`)
  expect(fundo).toMatch(/(\/ 0?\.\d+\)|, 0?\.\d+\))$/);
});

test("o espetro de géneros: 4 géneros e o resto em 'Outros', sem as cores de estado", async ({
  page,
}) => {
  // Verde, ciano e magenta já querem dizer estados — num espetro de géneros
  // mentiam. Escolhido pelo Ruben: 4 géneros + Outros. Desde a Fase 12 da Mira
  // os degraus são de uma só cor neutra (`polimento.spec`), não as da mira.
  const generos = ["Drama", "Comedy", "Crime", "Animation", "Documentary", "Mystery"];
  await semear(page, {
    series: generos.map((g, i) => ({ uuid: `s-${i}`, name: `Serie ${i}`, genres: [g] })),
    vistos: generos.flatMap((_, i) =>
      Array.from({ length: 10 - i }, (_, e) => ({ showUuid: `s-${i}`, season: 1, episode: e + 1 })),
    ),
  });
  await page.goto("/profile");
  const legenda = page.locator("section", { hasText: "O teu espetro" }).locator("li");
  await expect(legenda.first()).toBeVisible();
  expect(await legenda.count()).toBe(5);
  await expect(legenda.last()).toContainText("Outros");
  const cores = await legenda.evaluateAll((lis) =>
    lis.map((li) => getComputedStyle(li.querySelector("span") as Element).backgroundColor),
  );
  for (const estado of ["rgb(55, 200, 55)", CIANO, "rgb(210, 75, 210)"]) {
    expect(cores).not.toContain(estado);
  }
});
