import type { Page } from "@playwright/test";
import type { EpisodioVisto, Semente } from "./semear";
import { serieCompleta, type Catalogo } from "./tmdb";

/**
 * Medidas de um ecrã no telemóvel (Ronda 14, Fase 11): o que nenhuma captura
 * afirma. Corre no browser e devolve números, não opiniões — o teste decide.
 */

/** A área segura do iPhone com a PWA instalada: 59 em cima (ilha), 34 em baixo. */
const SEGURA = { top: 59, bottom: 34 };

/**
 * `env(safe-area-inset-*)` vale 0 no browser emulado, por isso um teste ao
 * respiro de cima e de baixo media sempre zero. Troca-se o `env()` pelos valores
 * de um iPhone com ilha no CSS que a app serve — o resto corre tal e qual.
 */
export async function comAreaSegura(page: Page) {
  await page.route(/\/_next\/static\/.*\.css/, async (rota) => {
    const resposta = await rota.fetch();
    const css = (await resposta.text())
      .replace(/env\(safe-area-inset-top[^)]*\)/g, `${SEGURA.top}px`)
      .replace(/env\(safe-area-inset-bottom[^)]*\)/g, `${SEGURA.bottom}px`);
    await rota.fulfill({ response: resposta, body: css });
  });
}

/**
 * O texto a N× o tamanho de base. No iOS o Dynamic Type mexe no `font-size` da
 * raiz (`-apple-system-body`); o WebKit dos testes não é iOS, por isso põe-se
 * o mesmo efeito à mão: a raiz a 17px × escala (a app mede o texto em `rem`).
 */
export async function comTexto(page: Page, escala: number) {
  if (escala === 1) return;
  await page.addInitScript((px: number) => {
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = `html{font-size:${px}px !important}`;
      document.head.appendChild(s);
    });
  }, 17 * escala);
}

/** Uma biblioteca de verdade: nomes compridos, séries a meio, buracos, filmes, uma lista. */
export function catalogoMedidas(tmdb: Catalogo) {
  const series: [number, string, number[]][] = [
    [101, "Severance", [9, 10]],
    [102, "Uma Série com um Nome Extremamente Comprido que Não Cabe Numa Linha Só", [8, 8, 8, 8, 8, 8, 8]],
    [103, "Breaking Bad", [7, 13, 13, 13, 16]],
    [104, "Ted Lasso", [10, 12, 12]],
  ];
  for (const [id, nome, temporadas] of series) {
    const c = serieCompleta(id, nome, temporadas);
    Object.assign(tmdb.series, c.series);
    Object.assign(tmdb.episodios, c.episodios);
  }
  for (const n of [2001, 2003])
    tmdb.filmes[n] = {
      id: n,
      title: n === 2003 ? "Um Filme com um Título Muito Comprido que Precisa de Quebrar em Linhas" : "Filme 2",
      poster_path: "/cartaz.jpg",
      backdrop_path: "/fundo.jpg",
      overview: "Uma sinopse de teste, com duas ou três linhas de texto para ocupar espaço no ecrã do filme.",
      release_date: "2020-01-01",
      runtime: 118,
      genres: [{ id: 1, name: "Drama" }],
    };
  tmdb.tendencias = Array.from({ length: 8 }, (_, i) => ({
    id: 900 + i,
    name: i === 1 ? "Um Nome de Tendência Bastante Longo para Testar o Cartaz" : `Tendência ${i + 1}`,
    poster_path: "/cartaz.jpg",
    backdrop_path: null,
    overview: "Sinopse de teste.",
    first_air_date: "2021-01-01",
    vote_average: 7,
  }));
}

export function sementeMedidas(): Semente {
  const HOJE = new Date().toISOString();
  const base: { uuid: string; name: string; tmdbId: number; temps: number[]; vistos: number[][] }[] = [
    { uuid: "s-1", name: "Severance", tmdbId: 101, temps: [9, 10], vistos: [[9], [1, 2, 3, 7, 8]] },
    {
      uuid: "s-2",
      name: "Uma Série com um Nome Extremamente Comprido que Não Cabe Numa Linha Só",
      tmdbId: 102,
      temps: [8, 8, 8, 8, 8, 8, 8],
      vistos: [[8], [8], [8], [3]],
    },
    { uuid: "s-3", name: "Breaking Bad", tmdbId: 103, temps: [7, 13, 13, 13, 16], vistos: [[7], [13], [13], [13], [16]] },
    { uuid: "s-4", name: "Ted Lasso", tmdbId: 104, temps: [10, 12, 12], vistos: [[10], [4]] },
  ];
  const series: NonNullable<Semente["series"]> = [];
  const vistos: EpisodioVisto[] = [];
  for (const b of base) {
    series.push({
      uuid: b.uuid,
      name: b.name,
      tmdbId: b.tmdbId,
      numeracao: "tmdb",
      posterPath: "/cartaz.jpg",
      backdropPath: "/fundo.jpg",
      totalEpisodes: b.temps.reduce((a, c) => a + c, 0),
      runtime: 45,
      genres: ["Drama", "Ficção científica"],
    });
    b.vistos.forEach((lista, i) => {
      const eps = lista.length === 1 ? Array.from({ length: lista[0] }, (_, k) => k + 1) : lista;
      for (const e of eps)
        vistos.push({
          showUuid: b.uuid,
          season: i + 1,
          episode: e,
          watchedAt: new Date(Date.now() - (40 - i * 3 - e) * 86400000).toISOString(),
        });
    });
  }
  for (let i = 5; i <= 40; i++) {
    series.push({
      uuid: `s-${i}`,
      name: `Série ${i}`,
      posterPath: i % 3 ? "/cartaz.jpg" : null,
      totalEpisodes: 10,
      followed: i % 5 !== 0,
      inWatchlist: i % 5 === 0,
      status: i % 7 === 0 ? "Returning Series" : "Ended",
    });
    if (i % 4 === 0)
      for (let e = 1; e <= 3 + (i % 6); e++)
        vistos.push({ showUuid: `s-${i}`, season: 1, episode: e, watchedAt: new Date(Date.now() - i * 86400000 * 4).toISOString() });
  }
  return {
    series,
    vistos,
    filmes: Array.from({ length: 12 }, (_, i) => ({
      key: `f-${i}`,
      name: i === 3 ? "Um Filme com um Título Muito Comprido que Precisa de Quebrar em Linhas" : `Filme ${i + 1}`,
      watchedAt: i % 4 === 0 ? null : HOJE,
      releaseDate: `${1990 + i}-05-01`,
      posterPath: "/cartaz.jpg",
      tmdbId: 2000 + i,
    })),
    listas: [
      {
        id: "l-1",
        name: "Para ver no fim de semana",
        items: [
          { kind: "show", refId: "s-1" },
          { kind: "movie", refId: "f-1" },
        ],
      },
    ],
    kv: {
      "nextup-cache": {
        "s-1": { episode: { season: 2, episode: 4, name: "Um Episódio com um Nome Bastante Comprido Mesmo", airDate: "2025-01-08" }, lastWatchedAt: HOJE },
        "s-4": { episode: { season: 2, episode: 5, name: "Two Aces", airDate: "2021-01-08" }, lastWatchedAt: HOJE },
      },
    },
  };
}

export interface Medidas {
  /** quanto a página é mais larga do que a janela (px) */
  transbordo: number;
  /** texto ou alvos que saem do ecrã, sem um antepassado que role por desenho */
  fora: string[];
  /** texto recortado na largura, sem reticências: uma palavra que não cabe */
  cortado: string[];
  /** alvos de toque cuja área (a que responde ao dedo) é menor do que 44px */
  alvos: string[];
  /** folga entre o último conteúdo e a barra de separadores, com a página no fim */
  folga: number | null;
}

/** Corre no browser: não pode fechar sobre nada de fora. */
export async function medirEcra(raizSeletor: string | null = null): Promise<Medidas> {
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const nav = document.querySelector('nav[aria-label="Separadores"]');
  const capsula = nav?.firstElementChild as HTMLElement | null;
  // numa folha mede-se a folha por dentro (a página por trás está sob o véu)
  const raiz = raizSeletor ? (document.querySelector(raizSeletor) as HTMLElement) : document.body;
  const topoDock = raizSeletor ? vh : capsula ? capsula.getBoundingClientRect().top : vh;

  const descreve = (el: Element) => {
    const t = (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 34);
    return `${el.tagName.toLowerCase()} «${t}»`;
  };
  const visivel = (el: Element) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) return false;
    return !el.closest('[aria-hidden="true"], [inert]');
  };
  const temTexto = (el: Element) =>
    Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? "").trim());
  const seletorAlvo =
    'a[href], button, input, select, textarea, summary, [role="button"], [role="radio"], [role="tab"], [role="menuitem"], [role="switch"], [role="checkbox"]';
  const clipadoPorAncestral = (el: Element) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (getComputedStyle(p).overflowX !== "visible") {
        const r = p.getBoundingClientRect();
        if (r.left >= -1 && r.right <= vw + 1) return true;
      }
    }
    return false;
  };
  /** o centro, ou os 22px acima/abaixo dele (o alvo de 44px), estão sob uma barra fixa ou colante */
  const cobertoPorColante = (el: Element) => {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    for (const y of [cy, cy - 22, cy + 22]) {
      if (y < 0 || y > vh) continue;
      const em = document.elementFromPoint(cx, y);
      if (!em || em === el || el.contains(em) || em.contains(el)) continue;
      for (let p: Element | null = em; p && p !== document.body; p = p.parentElement) {
        const pos = getComputedStyle(p).position;
        if (pos === "sticky" || pos === "fixed") return true;
      }
    }
    return false;
  };
  /** até onde o dedo chega: os pixéis à volta do centro que ainda acertam no alvo */
  const area = (el: Element) => {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const bate = (x: number, y: number) => {
      const e = document.elementFromPoint(x, y);
      return !!e && (e === el || el.contains(e));
    };
    let esq = 0, dir = 0, cima = 0, baixo = 0;
    while (esq < 60 && bate(cx - esq - 1, cy)) esq++;
    while (dir < 60 && bate(cx + dir + 1, cy)) dir++;
    while (cima < 60 && bate(cx, cy - cima - 1)) cima++;
    while (baixo < 60 && bate(cx, cy + baixo + 1)) baixo++;
    return { l: esq + dir + 1, a: cima + baixo + 1 };
  };

  const fora: string[] = [];
  const cortado: string[] = [];
  const alvos: string[] = [];
  const vistosAlvos = new WeakSet<Element>();
  const vistosTexto = new WeakSet<Element>();
  const espera = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 50)));
  const rolante = raizSeletor
    ? (Array.from(raiz.querySelectorAll("*")).find((e) => /auto|scroll/.test(getComputedStyle(e).overflowY)) as HTMLElement | undefined) ?? raiz
    : (document.scrollingElement as HTMLElement);
  const max = rolante.scrollHeight - rolante.clientHeight;
  const passo = Math.max(120, vh - 220);

  rolante.scrollTo(0, 0);
  await espera();
  for (let y = 0; ; y += passo) {
    rolante.scrollTo(0, Math.min(y, max));
    await espera();
    for (const el of Array.from(raiz.querySelectorAll(seletorAlvo))) {
      if (vistosAlvos.has(el) || !visivel(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.top < 0 || r.bottom > topoDock) continue;
      if (cobertoPorColante(el) && y < max) continue; // mede-se quando já não estiver sob a barra
      vistosAlvos.add(el);
      if (getComputedStyle(el).display === "inline" && el.tagName === "A" && el.closest("p, li")) continue;
      if (r.width < 44 || r.height < 44) {
        const a = area(el);
        if (a.l < 44 || a.a < 44) alvos.push(`${descreve(el)} ${a.l}×${a.a}`);
      }
    }
    for (const el of Array.from(raiz.querySelectorAll("*"))) {
      if (vistosTexto.has(el) || !visivel(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) continue;
      vistosTexto.add(el);
      const cs = getComputedStyle(el);
      if ((r.right > vw + 1 || r.left < -1) && (temTexto(el) || el.matches(seletorAlvo)) && !clipadoPorAncestral(el))
        fora.push(`${descreve(el)} [${Math.round(r.left)}..${Math.round(r.right)}]`);
      const h = el as HTMLElement;
      if (temTexto(el) && cs.overflowX !== "visible" && cs.textOverflow !== "ellipsis" && h.scrollWidth > h.clientWidth + 1)
        cortado.push(`${descreve(el)} ${h.scrollWidth}>${h.clientWidth}`);
    }
    if (y >= max) break;
  }

  rolante.scrollTo(0, max);
  await espera();
  let pior: number | null = null;
  for (const el of Array.from(raiz.querySelectorAll("*"))) {
    if (!visivel(el) || el.closest("nav[aria-label='Separadores']")) continue;
    if (getComputedStyle(el).position === "fixed") continue;
    if (!temTexto(el) && !el.matches(seletorAlvo) && el.tagName !== "IMG") continue;
    const b = el.getBoundingClientRect().bottom;
    if (pior === null || b > pior) pior = b;
  }
  rolante.scrollTo(0, 0);
  return {
    transbordo: document.documentElement.scrollWidth - vw,
    fora,
    cortado,
    alvos,
    folga: pior === null || !capsula || raizSeletor ? null : Math.round(topoDock - pior),
  };
}
