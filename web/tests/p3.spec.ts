import { test, expect } from "./apoio/base";
import { semear } from "./apoio/semear";
import { serieCompleta } from "./apoio/tmdb";
import { curta } from "../src/lib/datas";

/**
 * Ronda 12, Fase 5e — os P3 e as pontas soltas da crítica 5b.4 (AUDITORIA.md,
 * achado #14) e do que se viu pelo caminho. Mecânico, sem decisões de gosto.
 */

test("no detalhe, a atividade não mostra datas em ISO cruas", async ({ page, tmdb }) => {
  // "2024-06-26 → 2024-07-01" escapou à Fase 5b.1, que já tinha corrigido as
  // outras duas. Usa o mesmo `curta()` que o resto da app.
  Object.assign(tmdb.series, serieCompleta(500, "Severance", [3]).series);
  Object.assign(tmdb.episodios, serieCompleta(500, "Severance", [3]).episodios);
  await semear(page, {
    series: [{ uuid: "s-1", name: "Severance", tmdbId: 500, numeracao: "tmdb" }],
    vistos: [
      { showUuid: "s-1", season: 1, episode: 1, watchedAt: "2024-06-26T20:00:00.000Z" },
      { showUuid: "s-1", season: 1, episode: 2, watchedAt: "2024-07-01T21:00:00.000Z" },
    ],
  });
  await page.goto("/series/s-1");
  await page.getByTestId("tab-estatisticas").click();
  const painel = page.locator("#painel-estatisticas");
  await expect(painel).not.toContainText("2024-06-26");
  const esperado = `${curta("2024-06-26T20:00:00.000Z")} → ${curta("2024-07-01T21:00:00.000Z")}`;
  await expect(painel).toContainText(esperado);
});

test("o Entrar tem uma saída — um recuar, não um beco sem saída", async ({ page }) => {
  // Sem cloud configurada (o caso desta suite), não há sessão a proteger, e
  // ficar preso no /login sem forma de sair era desnecessário.
  await semear(page, {});
  await page.goto("/login");
  const voltar = page.getByRole("link", { name: /Voltar/ }).or(page.getByRole("button", { name: /Voltar/ }));
  await expect(voltar).toBeVisible();
  await voltar.click();
  await expect(page).not.toHaveURL(/\/login$/);
});

test("o Explorar diz 'do que gostas', com a preposição", async ({ page }) => {
  // "Ainda não sei o que gostas" falta o "de" — gostar é sempre "gostar de".
  await semear(page, {});
  await page.goto("/explorar");
  await expect(page.getByText(/Ainda não sei do que gostas/)).toBeVisible();
});

test("o aviso de privacidade do Importar não promete o que a cloud desfaz", async ({
  page,
}) => {
  // "Nada é enviado para servidores" era falso com a cloud ligada — a
  // próxima sincronização envia tudo (db.ts:379, comentário do importExport).
  const { avisoDePrivacidade } = await import("../src/lib/textoImportar");
  expect(avisoDePrivacidade(false)).toContain("nada é enviado para servidores");
  expect(avisoDePrivacidade(true)).not.toContain("nada é enviado para servidores");

  // Sem cloud (o caso desta suite), a página mostra a frase sem promessa falsa.
  await semear(page, {});
  await page.goto("/import");
  await expect(page.getByText(avisoDePrivacidade(false))).toBeVisible();
});

test("'Melhor maratona' não aparece por um único episódio — não é maratona nenhuma", async ({
  page,
}) => {
  // Sem limiar, o dia com mais episódios era sempre "o melhor", mesmo com 1
  // — um recorde que humilha (achado da 5b.4). Passa a exigir 2.
  await semear(page, {
    series: [{ uuid: "s-1", name: "Serie Um" }],
    vistos: [{ showUuid: "s-1", season: 1, episode: 1, watchedAt: "2024-03-05T20:00:00.000Z" }],
  });
  await page.goto("/estatisticas");
  await expect(page.getByText("Sequência mais longa")).toHaveCount(0); // 1 dia só, sem sequência
  await expect(page.getByText("Melhor maratona")).toHaveCount(0);
});

test("'Melhor maratona' aparece a partir de 2 episódios no mesmo dia", async ({ page }) => {
  await semear(page, {
    series: [{ uuid: "s-1", name: "Serie Um" }],
    vistos: [
      { showUuid: "s-1", season: 1, episode: 1, watchedAt: "2024-03-05T20:00:00.000Z" },
      { showUuid: "s-1", season: 1, episode: 2, watchedAt: "2024-03-05T21:00:00.000Z" },
    ],
  });
  await page.goto("/estatisticas");
  await expect(page.getByText("Melhor maratona")).toBeVisible();
  await expect(page.getByText("2", { exact: true })).toBeVisible();
});

test("a Biblioteca vazia usa 'seguir' para séries, não 'adicionar' — o glossário do PRODUCT.md", async ({
  page,
}) => {
  await semear(page, {});
  await page.goto("/library");
  await expect(page.getByText("Ainda não há séries")).toBeVisible();
  await expect(page.getByText(/seguires a primeira/)).toBeVisible();
  await expect(page.getByText(/adicionares o primeiro/)).toHaveCount(0);

  await page.goto("/library?tipo=filmes");
  await expect(page.getByText("Ainda não há filmes")).toBeVisible();
  await expect(page.getByText(/adicionares o primeiro/)).toBeVisible();
});

test("o botão de renomear uma lista tem 44px de alvo, não só os ~32px do texto", async ({
  page,
}) => {
  await semear(page, {
    listas: [{ id: "l-1", name: "A minha lista" }],
  });
  await page.goto("/listas/l-1");
  const botao = page.getByRole("button", { name: "Renomear a lista A minha lista" });
  const alvo = await botao.evaluate((el) => {
    const antes = getComputedStyle(el, "::before");
    return { largura: parseFloat(antes.width), altura: parseFloat(antes.height) };
  });
  expect(alvo.largura).toBeGreaterThanOrEqual(44);
  expect(alvo.altura).toBeGreaterThanOrEqual(44);
});

// ── `fill` sem `sizes`: pedia sempre a imagem maior para uma capa pequena ──

test("o A estrear pede o tamanho da capa que mostra, não o ecrã inteiro", async ({
  page,
  tmdb,
}) => {
  Object.assign(tmdb.series, serieCompleta(600, "Andor", [8]).series);
  Object.assign(tmdb.episodios, serieCompleta(600, "Andor", [8]).episodios);
  const daqui3dias = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
  const s = serieCompleta(600, "Andor", [8]);
  s.episodios["600:1"][7].air_date = daqui3dias;
  Object.assign(tmdb.series, s.series);
  Object.assign(tmdb.episodios, s.episodios);
  await semear(page, {
    series: [
      {
        uuid: "s-1",
        name: "Andor",
        tmdbId: 600,
        numeracao: "tmdb",
        status: "Returning Series",
        posterPath: "/cartaz.jpg",
      },
    ],
    vistos: [{ showUuid: "s-1", season: 1, episode: 1 }],
  });
  await page.goto("/estrear");
  const img = page.locator('img[alt=""]').first();
  await expect(img).toHaveAttribute("sizes", "44px");
});

test("no Rever, a capa da série pede 56px, não a página inteira", async ({ page, tmdb }) => {
  tmdb.tvmaze[801] = [2, 2];
  await semear(page, {
    series: [
      {
        uuid: "s-1",
        name: "Tem Buracos",
        tvmazeId: 801,
        numeracao: "tvmaze",
        posterPath: "/cartaz.jpg",
      },
    ],
    vistos: [{ showUuid: "s-1", season: 2, episode: 1 }],
  });
  await page.goto("/rever");
  await expect(page.getByTestId("rever-cartao")).toBeVisible();
  const img = page.locator('img[alt=""]').first();
  await expect(img).toHaveAttribute("sizes", "56px");
});

test("no Perfil, a série-farol pede 44px, não a página inteira", async ({ page }) => {
  const hoje = new Date().toISOString();
  await semear(page, {
    series: [{ uuid: "s-1", name: "Serie Farol", posterPath: "/cartaz.jpg" }],
    vistos: Array.from({ length: 5 }, (_, i) => ({
      showUuid: "s-1",
      season: 1,
      episode: i + 1,
      watchedAt: hoje,
    })),
  });
  await page.goto("/profile");
  const img = page.locator('img[alt=""]').first();
  await expect(img).toHaveAttribute("sizes", "44px");
});

test("no WatchNextCard (a fila secundária), a capa pede 56px", async ({ page, tmdb }) => {
  const hoje = new Date().toISOString();
  const ha60Dias = new Date(Date.now() - 60 * 864e5).toISOString();
  for (const [id, nome] of [
    [500, "Ativa"],
    [501, "Parada"],
  ] as const) {
    Object.assign(tmdb.series, serieCompleta(id, nome, [9]).series);
    Object.assign(tmdb.episodios, serieCompleta(id, nome, [9]).episodios);
  }
  await semear(page, {
    series: [
      { uuid: "s-ativa", name: "Ativa", tmdbId: 500, numeracao: "tmdb" },
      { uuid: "s-parada", name: "Parada", tmdbId: 501, numeracao: "tmdb" },
    ],
    vistos: [
      { showUuid: "s-ativa", season: 1, episode: 1, watchedAt: hoje },
      { showUuid: "s-parada", season: 1, episode: 1, watchedAt: ha60Dias },
    ],
    kv: {
      "nextup-cache": {
        "s-ativa": {
          episode: { season: 1, episode: 2, name: "Dois", airDate: "2020-01-01" },
          lastWatchedAt: hoje,
        },
        "s-parada": {
          episode: { season: 1, episode: 2, name: "Dois", airDate: "2020-01-01" },
          lastWatchedAt: ha60Dias,
        },
      },
    },
  });
  await page.goto("/series");
  await page.getByRole("heading", { level: 1, name: "Ativa" }).waitFor();
  const toggle = page.getByRole("button", { name: /^Retomar/ });
  await toggle.waitFor();
  await toggle.click();
  // dentro da secção "Retomar" — não a capa de 32px do "Ou então", que já
  // tem `sizes` certo e também aponta para a mesma série parada
  const secaoRetomar = page.locator("section", {
    has: page.getByRole("heading", { name: "Retomar" }),
  });
  const img = secaoRetomar.locator('img[alt=""]').first();
  await expect(img).toHaveAttribute("sizes", "56px");
});

// ── o <title> de cada ecrã ───────────────────────────────────

test("o <title> muda de ecrã para ecrã, em vez de ficar sempre 'Episodic'", async ({
  page,
  tmdb,
}) => {
  await semear(page, {
    series: [{ uuid: "s-1", name: "Severance", posterPath: "/cartaz.jpg" }],
    filmes: [{ key: "f-1", name: "Past Lives", watchedAt: null }],
    listas: [{ id: "l-1", name: "A minha lista" }],
  });

  const casos: [string, RegExp][] = [
    ["/series", /^A seguir/],
    ["/explorar", /^Explorar/],
    ["/library", /^Biblioteca/],
    ["/profile", /^Perfil/],
    ["/rever", /^Rever a biblioteca/],
    ["/em-dia", /^Pôr em dia/],
    ["/estrear", /^A estrear/],
    ["/estatisticas", /^Estatísticas/],
    ["/import", /^Importar/],
    ["/login", /^Entrar/],
    ["/series/s-1", /^Série · /],
    ["/movies/f-1", /^Filme · /],
    ["/listas/l-1", /^Lista · /],
  ];
  for (const [rota, esperado] of casos) {
    await page.goto(rota);
    await expect.poll(() => page.title(), { message: rota }).toMatch(esperado);
    expect(await page.title()).not.toBe("Episodic");
  }
});

test("o detalhe de filme e o Rever não reservam a dock outra vez — a moldura já o faz", async ({
  page,
  tmdb,
}) => {
  // O mesmo padrão que se corrigiu no detalhe de série (5b.3): o layout raiz
  // já deixa `--dock-h + 0.5rem` por baixo de tudo; reservá-lo na página
  // deixava um vazio a mais no fim.
  tmdb.tvmaze[801] = [2, 2];
  await semear(page, {
    series: [{ uuid: "s-1", name: "Tem Buracos", tvmazeId: 801, numeracao: "tvmaze" }],
    vistos: [{ showUuid: "s-1", season: 2, episode: 1 }],
    filmes: [{ key: "f-1", name: "Past Lives", watchedAt: null }],
  });
  for (const rota of ["/movies/f-1", "/rever"]) {
    await page.goto(rota);
    await page.locator("main").waitFor();
    const reserva = await page.locator("main").evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
    expect(reserva, rota).toBeLessThanOrEqual(40);
  }
});

test("uma capa que falha a carregar não fica a brilhar para sempre nem partida", async ({
  page,
}) => {
  // Sem `onError`, o brilho de "a carregar" ficava para sempre e a imagem
  // partida do browser aparecia por cima do nome que fazia de plano B.
  await semear(page, { series: [{ uuid: "s-1", name: "Serie Um", posterPath: "/cartaz.jpg" }] });
  await page.route(/\/_next\/image/, (rota) => rota.fulfill({ status: 404, body: "" }));
  await page.goto("/library");
  await expect(page.getByText("Serie Um").first()).toBeVisible();
  await expect(page.locator("main img")).toHaveCount(0);
  await expect(page.locator(".poster-shimmer")).toHaveCount(0);
});

test("o nome da série no herói da casa tem 44px de alvo (medido no iPhone: 43)", async ({
  page,
  tmdb,
}) => {
  const hoje = new Date().toISOString();
  Object.assign(tmdb.series, serieCompleta(500, "Severance", [9]).series);
  Object.assign(tmdb.episodios, serieCompleta(500, "Severance", [9]).episodios);
  await semear(page, {
    series: [{ uuid: "s-1", name: "Severance", tmdbId: 500, numeracao: "tmdb" }],
    vistos: [{ showUuid: "s-1", season: 1, episode: 1, watchedAt: hoje }],
    kv: {
      "nextup-cache": {
        "s-1": {
          episode: { season: 1, episode: 2, name: "Dois", airDate: "2020-01-01" },
          lastWatchedAt: hoje,
        },
      },
    },
  });
  await page.setViewportSize({ width: 430, height: 775 });
  await page.goto("/series");
  const alvo = page.getByRole("link", { name: "Severance" }).first();
  await alvo.waitFor();
  const altura = await alvo.evaluate((el) => el.getBoundingClientRect().height);
  expect(altura).toBeGreaterThanOrEqual(44);
});
