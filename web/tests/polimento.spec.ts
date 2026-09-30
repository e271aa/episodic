import { test, expect } from "./apoio/base";
import { semear } from "./apoio/semear";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Ronda 14, Fase 12 — a crítica final (A: 28/40) achou onde a assinatura
 * derrapou ao herdar as primitivas: a mira e a cápsula da ação fora das suas
 * regras, o mono a vestir palavras e três formas de recuar.
 */

type Loc = import("@playwright/test").Locator;
const mono = (l: Loc) => l.evaluate((el) => /mono|menlo/i.test(getComputedStyle(el).fontFamily));
const HOJE = new Date().toISOString();

// ── A Regra da mira ────────────────────────────────────────────────────────

function ficheiros(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? ficheiros(p) : /\.tsx?$/.test(n) ? [p] : [];
  });
}

test("a mira só vive no ritual (Segmentos) e na casa vazia: nunca decoração nem carregamento", () => {
  const MIRA = [/["'\s]bars["'\s]/, /var\(--bars\)/, /--mira-[1-7]/, /smpte-(yellow|blue|gray)/];
  const PERMITIDOS = ["src/components/mira/Segmentos.tsx", "src/app/series/SeriesPageClient.tsx"];
  const fora: string[] = [];
  for (const f of [...ficheiros("src/app"), ...ficheiros("src/components"), ...ficheiros("src/lib")]) {
    if (PERMITIDOS.includes(f)) continue;
    readFileSync(f, "utf8")
      .split("\n")
      .forEach((l, i) => {
        if (MIRA.some((p) => p.test(l))) fora.push(`${f}:${i + 1}`);
      });
  }
  expect(fora).toEqual([]);
});

test("«O teu espetro» é neutro: os géneros em degraus de uma cor, sem as da mira", async ({ page }) => {
  const generos = ["Drama", "Comédia", "Crime", "Mistério", "Animação", "Documentário"];
  await semear(page, {
    series: generos.map((g, i) => ({ uuid: `s-${i}`, name: `Serie ${i}`, genres: [g] })),
    vistos: generos.flatMap((_, i) =>
      Array.from({ length: 6 - i }, (_, e) => ({ showUuid: `s-${i}`, season: 1, episode: e + 1, watchedAt: HOJE })),
    ),
  });
  await page.goto("/profile");
  const barra = page.getByTestId("espetro").locator("> div");
  await expect(barra).toHaveCount(5); // os 4 mais vistos + «Outros»
  const cores = await barra.evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor));
  for (const c of cores) {
    const [r, g, b] = c.match(/[\d.]+/g)!.map(Number);
    // neutro: sem matiz (a mira é amarelo, vermelho, azul)
    expect(Math.max(r, g, b) - Math.min(r, g, b), c).toBeLessThanOrEqual(12);
  }
});

// ── A Regra da ação ────────────────────────────────────────────────────────

const corDaAcao = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const el = document.createElement("i");
    el.style.color = "var(--m-acao)";
    document.body.appendChild(el);
    const c = getComputedStyle(el).color;
    el.remove();
    return c;
  });

test("casa vazia: «Procurar uma série» é a cápsula da ação (o cinza da mira à noite), não o branco", async ({
  page,
}) => {
  await semear(page, {});
  await page.goto("/series");
  const botao = page.getByRole("link", { name: "Procurar uma série" });
  expect(await botao.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(await corDaAcao(page));
});

test("Pôr em dia: uma só cápsula preenchida à vista — o código do episódio não é outra", async ({ page }) => {
  await semear(page, {
    series: [{ uuid: "s-1", name: "Severance" }],
    vistos: [{ showUuid: "s-1", season: 1, episode: 1, watchedAt: HOJE }],
    kv: {
      "nextup-cache": {
        "s-1": { episode: { season: 1, episode: 2, name: "Meio-dia", airDate: "2022-02-18" }, lastWatchedAt: HOJE },
      },
    },
  });
  await page.goto("/em-dia");
  await expect(page.getByRole("heading", { name: "Severance" })).toBeVisible();
  const acao = await corDaAcao(page);
  const preenchidas = await page.evaluate((acao) => {
    return [...document.querySelectorAll("main *")].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.bottom > 0 && r.top < innerHeight && getComputedStyle(el).backgroundColor === acao;
    }).length;
  }, acao);
  expect(preenchidas).toBe(1);
  // e a posição na série: o número em mono, as palavras não
  expect(await mono(page.getByText(/vistos até agora/))).toBe(false);
});

// ── O mono é para códigos, contagens e datas curtas — nunca palavras ──────

test("lista: «3 itens» — o número em mono, a palavra não", async ({ page }) => {
  await semear(page, {
    series: [{ uuid: "s-1", name: "Alfa" }],
    listas: [{ id: "l-1", name: "Maratona", items: [{ kind: "show", refId: "s-1" }] }],
  });
  await page.goto("/listas/l-1");
  const linha = page.getByText(/^\d+ ite(m|ns)$/);
  await expect(linha).toBeVisible();
  expect(await mono(linha)).toBe(false);
});

test("Biblioteca › Filmes: o selo «Para ver» do cartaz não é mono nem maiúsculas", async ({ page }) => {
  await semear(page, { filmes: [{ key: "f-1", name: "Past Lives", watchedAt: null }] });
  await page.goto("/library?tipo=filmes");
  const selo = page.getByTestId("selo-cartaz").first();
  await expect(selo).toBeVisible();
  expect(await mono(selo)).toBe(false);
  expect(await selo.evaluate((el) => getComputedStyle(el).textTransform)).toBe("none");
});

test("série: o cabeçalho da temporada é o código «T2», não o nome cru do fornecedor em maiúsculas; a data do episódio por extenso não é mono", async ({
  page,
  tmdb,
}) => {
  tmdb.tvmaze[495] = [9, 10];
  await semear(page, {
    series: [{ uuid: "s-1", name: "Severance", tvmazeId: 495, numeracao: "tvmaze", totalEpisodes: 19 }],
    vistos: Array.from({ length: 9 }, (_, e) => ({ showUuid: "s-1", season: 1, episode: e + 1 })),
  });
  await page.goto("/series/s-1");
  const cabecalho = page.getByTestId("cabecalho-temporada");
  await expect(cabecalho).toHaveText(/^T2 · 10 episódios$/);
  expect(await cabecalho.evaluate((el) => getComputedStyle(el).textTransform)).toBe("none");
  const data = page.getByTestId("ep-2-1").getByText(/ de \d{4}$/);
  if (await data.count()) expect(await mono(data.first())).toBe(false);
});

// ── Um só recuar ───────────────────────────────────────────────────────────

test("recuar é o mesmo em todos os sub-ecrãs: o círculo com o ‹", async ({ page }) => {
  await semear(page, { listas: [{ id: "l-1", name: "Maratona", items: [] }] });
  for (const rota of ["/estrear", "/listas/l-1", "/em-dia", "/login", "/import"]) {
    await page.goto(rota);
    const botao = page.locator('[aria-label^="Voltar"]').first();
    await expect(botao, rota).toBeVisible();
    expect(await botao.locator("svg").getAttribute("class"), rota).toContain("lucide-chevron-left");
    const fundo = await botao.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(fundo, rota).not.toBe("rgba(0, 0, 0, 0)");
  }
});

test("filme: «Onde ver» fala como os outros cabeçalhos — sem maiúsculas espaçadas da v2, e a fonte não é mono", async ({
  page,
  tmdb,
}) => {
  tmdb.filmes[666277] = { id: 666277, title: "Past Lives", release_date: "2023-06-02", overview: "", poster_path: null, backdrop_path: null, runtime: 106, genres: [], tagline: "" };
  tmdb.ondeVer["movie:666277"] = ["Netflix"];
  await semear(page, { filmes: [{ key: "f-1", name: "Past Lives", tmdbId: 666277, watchedAt: null }] });
  await page.goto("/movies/f-1");
  const titulo = page.getByText(/^Onde ver em Portugal$/i);
  await expect(titulo).toBeVisible();
  expect(await titulo.evaluate((el) => getComputedStyle(el).textTransform)).toBe("none");
  const fonte = page.getByText(/Dados da JustWatch/);
  await expect(fonte).toBeVisible();
  expect(await mono(fonte)).toBe(false);
});
