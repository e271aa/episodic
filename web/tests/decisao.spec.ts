import { test, expect } from "./apoio/base";
import { semear } from "./apoio/semear";
import { serieCompleta } from "./apoio/tmdb";
import { tapadoPelaDock } from "./apoio/geometria";

/**
 * Ronda 12, Fase 5 — "decisão e palavras". A crítica da Fase 4 (AUDITORIA.md)
 * encontrou ecrãs que dizem o contrário do que é verdade, ou que decidem por
 * quem os usa. Cada teste aqui é um desses achados, visto a falhar antes da
 * correção.
 */

const HA_60_DIAS = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

function proximo(episode: number, lastWatchedAt: string | null) {
  return {
    episode: { season: 1, episode, name: `Episódio ${episode}`, airDate: "2020-01-01" },
    lastWatchedAt,
  };
}

// ── #1 · a pílula "10 em dia" ────────────────────────────────

test("a pílula da casa diz 'Pôr em dia', não 'em dia', e leva a um filtro com conteúdo", async ({
  page,
  tmdb,
}) => {
  // Uma série parada há 60 dias: nada em "Continuar", uma em "Retomar". Era
  // o caso da crítica — a pílula dizia "1 em dia" (o contrário: há um
  // episódio por ver) e abria em "Continuar 0 — nada para pôr em dia ✓".
  Object.assign(tmdb.series, serieCompleta(500, "Serie Parada", [5]).series);
  Object.assign(tmdb.episodios, serieCompleta(500, "Serie Parada", [5]).episodios);
  await semear(page, {
    series: [{ uuid: "s-parada", name: "Serie Parada", tmdbId: 500, numeracao: "tmdb" }],
    vistos: [{ showUuid: "s-parada", season: 1, episode: 1, watchedAt: HA_60_DIAS }],
    kv: { "nextup-cache": { "s-parada": proximo(2, HA_60_DIAS) } },
  });

  await page.goto("/series");
  const pilula = page.getByRole("link", { name: /Pôr em dia/ });
  await expect(pilula).toBeVisible();
  await expect(pilula).toContainText("1");
  await expect(page.getByText(/\d+ em dia/)).toHaveCount(0);

  await pilula.click();
  await expect(page).toHaveURL(/\/em-dia/);
  await expect(page.getByText("Serie Parada").first()).toBeVisible();
  await expect(page.getByText("Nada para pôr em dia aqui")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Retomar/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("um filtro vazio no Pôr em dia dá a saída, em vez de mandar procurar acima", async ({
  page,
}) => {
  await semear(page, {
    series: [{ uuid: "s-parada", name: "Serie Parada" }],
    vistos: [{ showUuid: "s-parada", season: 1, episode: 1, watchedAt: HA_60_DIAS }],
    kv: { "nextup-cache": { "s-parada": proximo(2, HA_60_DIAS) } },
  });

  await page.goto("/em-dia?filtro=continuar");
  await expect(page.getByText("Nada para pôr em dia aqui")).toBeVisible();
  await expect(page.getByText(/experimenta outro acima/)).toHaveCount(0);

  await page.getByRole("button", { name: "Ver Retomar · 1" }).click();
  await expect(page).toHaveURL(/filtro=retomar$/);
  await expect(page.getByText("Serie Parada").first()).toBeVisible();
});

test("marcar em 'Por começar' não salta a série seguinte", async ({ page }) => {
  // Marcar tira a série de "Por começar" (passa a ter 1 visto) ao mesmo
  // tempo que o cursor avança. Medido: hoje não salta nenhuma, porque a
  // lista não se recalcula a meio — o teste guarda isso, agora que o filtro
  // por omissão passa a depender do conteúdo.
  await semear(page, {
    series: [
      { uuid: "s-a", name: "Serie A" },
      { uuid: "s-b", name: "Serie B" },
      { uuid: "s-c", name: "Serie C" },
    ],
    kv: {
      "nextup-cache": {
        "s-a": proximo(1, null),
        "s-b": proximo(1, null),
        "s-c": proximo(1, null),
      },
    },
  });

  // Sem filtro no URL, abre no primeiro com conteúdo — é o caso de um amigo
  // que acabou de seguir três séries e toca na pílula.
  await page.goto("/em-dia");
  await expect(page.getByRole("button", { name: /^Por começar/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByText("1 de 3")).toBeVisible();

  // Cada decisão deixa o aviso de anular com o nome da série — é por aí que
  // se vê que as três passaram, uma de cada vez, sem nenhuma saltada.
  const decididas: string[] = [];
  const aviso = page.getByTestId("undo-toast");
  await page.getByRole("button", { name: "Marcar como visto" }).click();
  await expect(page.getByText("2 de 3")).toBeVisible();
  decididas.push((await aviso.textContent()) ?? "");
  await page.getByRole("button", { name: "Saltar — ainda não vi" }).click();
  await expect(page.getByText("3 de 3")).toBeVisible();
  decididas.push((await aviso.textContent()) ?? "");
  await page.getByRole("button", { name: "Saltar — ainda não vi" }).click();
  await expect(page.getByText("Passaste tudo em revista")).toBeVisible();
  decididas.push((await aviso.textContent()) ?? "");

  for (const nome of ["Serie A", "Serie B", "Serie C"])
    expect(decididas.some((t) => t.includes(nome))).toBe(true);
});

// ── #6 · o vocabulário ───────────────────────────────────────

test("'A seguir' é só a fila: seguir uma série diz 'Seguida', e a Biblioteca diz 'Em curso'", async ({
  page,
  tmdb,
}) => {
  // Ronda 12, Fase 4: "A seguir" queria dizer a fila (a dock), o estado
  // depois de tocar "Seguir" e "15 a seguir" no Perfil; "A VER" e "PARA VER"
  // eram secções vizinhas. Palavras escolhidas pelo Ruben a 27-09.
  tmdb.multi = [
    {
      id: 700,
      media_type: "tv",
      name: "Serie Nova",
      original_name: "Serie Nova",
      first_air_date: "2021-01-01",
      poster_path: null,
      overview: "",
    },
  ];
  Object.assign(tmdb.series, serieCompleta(700, "Serie Nova", [3]).series);
  Object.assign(tmdb.episodios, serieCompleta(700, "Serie Nova", [3]).episodios);
  await semear(page, {
    // Com id próprio: sem ele, o enriquecimento da Biblioteca procura-as por
    // nome, e a TMDB falsa responde "Serie Nova" a qualquer pesquisa.
    series: [
      { uuid: "s-andar", name: "Serie A Andar", tmdbId: 901, totalEpisodes: 10 },
      { uuid: "s-espera", name: "Serie A Espera", tmdbId: 902, totalEpisodes: 10 },
    ],
    vistos: [{ showUuid: "s-andar", season: 1, episode: 1 }],
  });

  await page.goto("/library");
  await expect(page.locator('[data-testid="library-grid"] section div.sticky').first()).toHaveText(
    /^Em curso/,
  );

  await page.getByRole("button", { name: "Procurar na biblioteca" }).click();
  await page.locator('input[type="search"]').fill("serie nova");
  await page.getByRole("button", { name: "Ver resultados" }).click();
  await page.getByTestId("remote-search-button").click();
  await page.getByRole("button", { name: "Seguir" }).click();
  await expect(page.getByRole("button", { name: "Seguida" })).toBeVisible();
  // "A seguir" fica só para a fila — nunca dentro do conteúdo da pesquisa
  await expect(page.locator("main").getByText("A seguir", { exact: true })).toHaveCount(0);

  await page.goto("/profile");
  await expect(page.getByText(/séries · 3 seguidas/)).toBeVisible();
});

// ── #3 · o primeiro uso de um amigo ──────────────────────────

test("sem nada na app, a primeira ação é procurar uma série, e a dock não a tapa", async ({
  page,
}) => {
  // Ronda 12, Fase 4: a ação principal pedia um ZIP do TV Time (que os
  // amigos nunca tiveram), meio tapada pela dock; "Explorar séries" levava à
  // Biblioteca vazia.
  await semear(page, {});
  await page.goto("/series");

  const procurar = page.getByRole("link", { name: "Procurar uma série" });
  await expect(procurar).toBeVisible();
  await expect(procurar).toHaveAttribute("href", "/explorar?procurar=1");
  expect(await tapadoPelaDock(page, 'main a[href="/explorar?procurar=1"]')).toBe(false);
  // importar continua lá, mas como segunda
  await expect(page.getByRole("link", { name: /Importar/ })).toHaveAttribute("href", "/import");
  await expect(page.locator('main a[href="/library"]')).toHaveCount(0);
});

test("seguir uma série na pesquisa do Explorar põe-na na fila", async ({ page, tmdb }) => {
  // Os cartões do Explorar só tinham "Para ver" — e uma série "para ver" não
  // entra na fila, por isso a casa ficava em "Estás em dia" para sempre.
  tmdb.multi = [
    {
      id: 700,
      media_type: "tv",
      name: "Serie Nova",
      original_name: "Serie Nova",
      first_air_date: "2021-01-01",
      poster_path: "/cartaz.jpg",
      overview: "",
    },
  ];
  Object.assign(tmdb.series, serieCompleta(700, "Serie Nova", [3]).series);
  Object.assign(tmdb.episodios, serieCompleta(700, "Serie Nova", [3]).episodios);
  await semear(page, {});

  await page.goto("/explorar?procurar=1");
  await page.locator('input[type="search"]').fill("serie nova");
  await page.getByRole("button", { name: "Seguir" }).click();
  await expect(page.getByText("Seguida", { exact: true })).toBeVisible();

  await page.goto("/series");
  await expect(page.getByText("S01·E01").first()).toBeVisible();
  await expect(page.getByText("Estás em dia")).toHaveCount(0);
});

test("só com séries para ver, a casa não diz 'Estás em dia'", async ({ page }) => {
  await semear(page, {
    series: [
      { uuid: "s-guardada", name: "Guardada", tmdbId: 901, followed: false, inWatchlist: true },
    ],
  });
  await page.goto("/series");
  await expect(page.getByText("Ainda não segues nenhuma série")).toBeVisible();
  await expect(page.getByText("Estás em dia")).toHaveCount(0);
});

// ── #15 (Fase 5b.1) · géneros, plurais e vocabulário ─────────

test("os géneros da série aparecem em pt-PT, não como veio do fornecedor", async ({
  page,
}) => {
  // "Sci-Fi & Fantasy" ficava por traduzir no detalhe, mesmo com o mapa já
  // a existir em lib/stats.ts (Ronda 12, Fase 4, achado #15).
  await semear(page, {
    series: [
      {
        uuid: "s-1",
        name: "Serie Um",
        totalEpisodes: 10,
        genres: ["Sci-Fi & Fantasy", "Action & Adventure"],
      },
    ],
    vistos: [{ showUuid: "s-1", season: 1, episode: 1 }],
  });
  await page.goto("/series/s-1");
  await expect(page.getByText("Sci-Fi & Fantasy")).toHaveCount(0);
  await expect(page.getByText("Ficção & Fantasia")).toBeVisible();
  await expect(page.getByText("Ação & Aventura")).toBeVisible();
});

test("'Melhor maratona' com um episódio não diz '1 episódios'", async ({ page }) => {
  const dia = new Date().toISOString().slice(0, 10);
  await semear(page, {
    series: [{ uuid: "s-1", name: "Serie Um", totalEpisodes: 1 }],
    vistos: [{ showUuid: "s-1", season: 1, episode: 1, watchedAt: `${dia}T20:00:00.000Z` }],
  });
  await page.goto("/estatisticas");
  await expect(page.getByText("1 episódios")).toHaveCount(0);
  await expect(page.getByText("Melhor maratona")).toBeVisible();
  await expect(page.getByText("episódio", { exact: true })).toBeVisible();
});

test("o import não usa vocabulário de computador ('clica', 'browser')", async ({ page }) => {
  await semear(page, {});
  await page.goto("/import");
  await expect(page.getByText("browser")).toHaveCount(0);
  await expect(page.getByText("clica")).toHaveCount(0);
  await expect(page.getByText(/toca/i)).toBeVisible();
});

// ── #16 (Fase 5b.1) · <h1> em falta ──────────────────────────

test("Biblioteca, Explorar e Perfil têm um h1, mesmo sem título visível", async ({
  page,
}) => {
  // Nenhum dos três tinha <h1> — a Biblioteca e o Perfil iam direto ao
  // conteúdo, o Explorar só tinha um botão de trocar de catálogo como
  // "título" visual (Ronda 12, Fase 4, achado #16).
  await semear(page, { series: [{ uuid: "s-1", name: "Serie Um" }] });

  await page.goto("/library");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Biblioteca");

  await page.goto("/explorar");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Explorar séries");

  await page.goto("/profile");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Perfil");
});

// ── LCP: as primeiras capas da grelha não ficam em lazy ──────

test("as primeiras capas da Biblioteca e do Explorar não têm loading=lazy", async ({
  page,
  tmdb,
}) => {
  // Medido na Fase 4 (AUDITORIA.md, achado #16): a capa que decide o LCP da
  // página carregava em `lazy`, como todas as outras da grelha.
  const series = Array.from({ length: 8 }, (_, i) => ({
    uuid: `s-${i}`,
    name: `Serie ${i}`,
    posterPath: "/cartaz.jpg",
    totalEpisodes: 1,
  }));
  await semear(page, { series, vistos: series.map((s) => ({ showUuid: s.uuid, season: 1, episode: 1 })) });
  await page.goto("/library");
  const capas = page.locator('[data-testid="library-grid"] img');
  await capas.first().waitFor();
  expect(await capas.nth(0).getAttribute("loading")).not.toBe("lazy");
  expect(await capas.nth(6).getAttribute("loading")).toBe("lazy");

  tmdb.tendencias = Array.from({ length: 8 }, (_, i) => ({
    id: 900 + i,
    name: `Sugestao ${i}`,
    poster_path: "/cartaz.jpg",
    backdrop_path: null,
    overview: "",
    first_air_date: "2021-01-01",
    vote_average: 7,
  }));
  await page.goto("/explorar");
  const cartazes = page.locator("main img");
  await cartazes.first().waitFor();
  expect(await cartazes.nth(0).getAttribute("loading")).not.toBe("lazy");
});

// ── manifest: a cor de tema da v1 ────────────────────────────

test("o manifest usa a cor do tubo desligado da v2, não a da v1", async ({ page }) => {
  const resposta = await page.request.get("/manifest.webmanifest");
  const manifest = await resposta.json();
  expect(manifest.theme_color).toBe("#101014");
  expect(manifest.background_color).toBe("#101014");
});

// ── #17 (Fase 5b.1) · o vermelho de perigo só ao confirmar ──

function ehCorDoTexto(cor: string) {
  // #e5484d
  return cor === "rgb(229, 72, 77)";
}

test("'Apagar lista' só fica vermelho depois do primeiro toque", async ({ page }) => {
  await semear(page, { listas: [{ id: "l-1", name: "Uma lista" }] });
  await page.goto("/listas/l-1");
  const botao = page.getByRole("button", { name: "Apagar lista" });
  const corAntes = await botao.evaluate((el) => getComputedStyle(el).color);
  expect(ehCorDoTexto(corAntes)).toBe(false);

  await botao.click();
  const depois = page.getByRole("button", { name: /Tens a certeza/ });
  // a cor transita (transition-colors) — ler já a seguir apanha um valor a
  // meio caminho, a mesma avaria já vista no hover do #9
  await expect
    .poll(async () => ehCorDoTexto(await depois.evaluate((el) => getComputedStyle(el).color)))
    .toBe(true);
});

test("'Apagar dados locais' só fica vermelho depois do primeiro toque", async ({ page }) => {
  await semear(page, {});
  await page.goto("/profile");
  const linha = page.getByText("Apagar dados locais");
  await expect(linha).toBeVisible();
  const corAntes = await linha.evaluate((el) => getComputedStyle(el).color);
  expect(ehCorDoTexto(corAntes)).toBe(false);

  await linha.click();
  const corDepois = await page
    .getByText("Apagar tudo o que está neste dispositivo?")
    .evaluate((el) => getComputedStyle(el).color);
  expect(ehCorDoTexto(corDepois)).toBe(true);
});

// ── #13 (Fase 5b.1) · movimento reduzido não apaga o anular ─

test("com movimento reduzido, a contagem do anular continua visível", async ({
  page,
}) => {
  // O `@media (prefers-reduced-motion)` global zerava TODAS as animações,
  // incluindo a barra que mostra quanto tempo falta para anular — que não é
  // decoração, é a própria funcionalidade (Ronda 12, Fase 4, achado #13).
  await page.emulateMedia({ reducedMotion: "reduce" });
  await semear(page, { listas: [{ id: "l-1", name: "Uma lista" }] });
  await page.goto("/listas");
  await page.getByRole("link", { name: "Uma lista" }).click();
  await page.getByRole("button", { name: /Apagar lista/ }).click();
  await page.getByRole("button", { name: /Tens a certeza/ }).click();
  // "attached", não "visible": com a avaria, a barra encolhe (scaleX(0))
  // quase de imediato e deixa de contar como visível — o que é a própria
  // avaria, não um problema do teste.
  const barra = page.locator(".undo-drain");
  await barra.waitFor({ state: "attached" });
  // getComputedStyle devolve segundos ("7s"), não milissegundos — comparar a
  // string literal "0.01ms" passava sempre, o que escondeu esta avaria
  const segundos = await barra.evaluate((el) =>
    parseFloat(getComputedStyle(el).animationDuration),
  );
  expect(segundos).toBeGreaterThan(1);
});

// ── #13 (Fase 5b.1) · /listas transborda a 320px ────────────

test("/listas não transborda a 320px", async ({ page }) => {
  // O campo "Nome da nova lista…" era flex-1 sem min-w-0: recusava-se a
  // encolher abaixo do seu conteúdo e empurrava a página para o lado
  // (Ronda 12, Fase 4, achado #13).
  await page.setViewportSize({ width: 320, height: 700 });
  await semear(page, {});
  await page.goto("/listas");
  await page.getByPlaceholder("Nome da nova lista…").waitFor();
  const larguras = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    janela: innerWidth,
  }));
  expect(larguras.doc).toBeLessThanOrEqual(larguras.janela);
});

// ── #13 (Fase 5b.1) · foco nas folhas ────────────────────────

test("abrir uma folha move o foco para dentro; fechar devolve-o ao botão", async ({
  page,
}) => {
  // Sem gestão de foco: abrir "Filtros e ordenação" deixava o foco no botão
  // por trás do véu, e fechar não o devolvia a lado nenhum (Ronda 12, Fase
  // 4, achado #13).
  await semear(page, { series: [{ uuid: "s-1", name: "Serie Um" }] });
  await page.goto("/library");
  // Ativado pelo teclado (foco + Enter), não por clique: no WebKit um
  // clique de rato não deixa o <button> focado, e é o caso de quem usa
  // teclado que este teste prova.
  const gatilho = page.getByRole("button", { name: "Filtros e ordenação" });
  await gatilho.focus();
  await gatilho.press("Enter");

  await expect(page.getByRole("dialog")).toBeVisible();
  const dentro = await page.evaluate(() =>
    document.querySelector('[role="dialog"]')?.contains(document.activeElement),
  );
  expect(dentro).toBe(true);

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(gatilho).toBeFocused();
});

// ── #13 (Fase 5b.1) · campos só com placeholder ──────────────

/**
 * `getByRole(..., { name })` também encontra pelo `placeholder` — a
 * computação do nome acessível usa-o como último recurso. Isso escondia a
 * avaria: um campo só com placeholder já "passa" nesse tipo de busca, mas
 * não tem `aria-label` nem `<label>` a sério. Aqui verifica-se isso mesmo.
 */
async function temRotuloAsSerio(loc: import("@playwright/test").Locator) {
  return loc.evaluate((el) => {
    const input = el as HTMLInputElement;
    return !!input.getAttribute("aria-label") || input.labels!.length > 0;
  });
}

test("os campos de texto têm um rótulo a sério, não só placeholder", async ({
  page,
}) => {
  // Cinco campos tinham só `placeholder` — sem `aria-label` nem `<label>`
  // (Ronda 12, Fase 4, achado #13).
  await semear(page, { listas: [{ id: "l-1", name: "Uma lista" }] });

  await page.goto("/listas");
  expect(await temRotuloAsSerio(page.getByPlaceholder("Nome da nova lista…"))).toBe(true);

  await page.goto("/library");
  await page.getByRole("button", { name: "Procurar na biblioteca" }).click();
  expect(await temRotuloAsSerio(page.getByPlaceholder("Procurar na biblioteca…"))).toBe(true);

  await page.goto("/explorar?procurar=1");
  expect(await temRotuloAsSerio(page.getByPlaceholder("Procurar uma série…"))).toBe(true);
});

test("criar uma lista a partir do detalhe de uma série tem um rótulo a sério", async ({
  page,
}) => {
  await semear(page, { series: [{ uuid: "s-1", name: "Serie Um", totalEpisodes: 3 }] });
  await page.goto("/series/s-1");
  await page.getByRole("button", { name: "Lista" }).click();
  expect(await temRotuloAsSerio(page.getByPlaceholder("Nova lista…"))).toBe(true);
});

// ── Novo (Fase 5b.1) · a dock parte "A seguir" a 320px ──────

test("a dock não parte o rótulo do separador ativo a 320px", async ({ page }) => {
  await semear(page, {});
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/series");
  const ativo = page.locator('nav a[href="/series"]');
  await ativo.waitFor();
  const altura = (await ativo.boundingBox())!.height;
  // uma pílula de um alvo de toque só, não duas linhas de texto
  expect(altura).toBeLessThan(50);
  const doc = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(doc).toBeLessThanOrEqual(320);
});
