import type { Page } from "@playwright/test";
import { test, expect } from "./apoio/base";
import { semear } from "./apoio/semear";
import { catalogoMedidas, comAreaSegura, comTexto, medirEcra, sementeMedidas } from "./apoio/medidas";

/**
 * Ronda 14, Fase 11 — a sonda do telemóvel, agora como rede de segurança.
 *
 * Cada ecrã, a 390 e 320px e com o texto a 100% e a 150%, com a área segura de
 * um iPhone com ilha: nada transborda na horizontal, nenhuma palavra fica
 * cortada, os alvos de toque respondem ao dedo em 44px e o fim da página fica
 * acima da barra de separadores. Só se mede (números, não capturas); o que
 * falhar aparece por ecrã, todos de uma vez.
 */

interface Ecra {
  id: string;
  url: string;
  espera: string;
  /** ecrã de altura fixa (sem rolar): a folga do fim da página não se aplica */
  fixo?: boolean;
  abrir?: (page: Page) => Promise<void>;
  /** só se mede o que está dentro disto (uma folga aberta) */
  raiz?: string;
}

const ECRAS: Ecra[] = [
  { id: "a-seguir", url: "/series", espera: '[data-testid="cartao-casa"]' },
  { id: "biblioteca-series", url: "/library", espera: '[data-testid="library-grid"]' },
  { id: "biblioteca-filmes", url: "/library?tipo=filmes", espera: '[data-testid="library-grid"]' },
  { id: "biblioteca-listas", url: "/library?tipo=listas", espera: "h1" },
  { id: "explorar", url: "/explorar", espera: "text=Em tendência" },
  { id: "triagem", url: "/triagem", espera: "main", fixo: true },
  { id: "perfil", url: "/profile", espera: "h1" },
  { id: "definicoes", url: "/profile/definicoes", espera: "h1" },
  { id: "estatisticas", url: "/estatisticas", espera: "h1" },
  { id: "serie", url: "/series/s-1", espera: '[data-testid="temporadas"]' },
  { id: "serie-nome-comprido", url: "/series/s-2", espera: '[data-testid="temporadas"]' },
  {
    id: "serie-folha",
    raiz: '[role="dialog"]',
    url: "/series/s-1",
    espera: '[data-testid="temporadas"]',
    abrir: async (page) => {
      await page.getByTestId("menu-serie").click();
      await page.getByRole("dialog").waitFor();
    },
  },
  { id: "filme", url: "/movies/f-1", espera: "h1" },
  { id: "filme-nome-comprido", url: "/movies/f-3", espera: "h1" },
  { id: "em-dia", url: "/em-dia", espera: "main", fixo: true },
  { id: "listas", url: "/listas", espera: "h1" },
  { id: "lista", url: "/listas/l-1", espera: "h1" },
  { id: "estrear", url: "/estrear", espera: "main" },
  { id: "rever", url: "/rever", espera: "main" },
  { id: "importar", url: "/import", espera: "main" },
  { id: "entrar", url: "/login", espera: "main", fixo: true },
];

/**
 * O que fica de fora de propósito (cada um com a razão):
 * - o mapa de calor e as colunas do Perfil: o desenho dá-lhes 24px de alvo e
 *   sempre um «Ver em tabela» (DESIGN.md, «O Perfil»); 12 meses não cabem a
 *   44px em 320px de largura.
 */
const DE_PROPOSITO = [/ · \d+ episódios?»/];

const MINIMA_FOLGA = 12;

/**
 * 430×15px é o iPhone do Ruben (medido: 430px de largura, corpo a 15px, categoria
 * «Pequeno»): um alvo em `rem` de 44px a 17px passa a 39px a 15px.
 */
for (const [largura, escala] of [
  [430, 15 / 17],
  [390, 1],
  [320, 1],
  [320, 1.5],
] as const) {
  test(`a ${largura}px com o texto a ${Math.round(escala * 100)}%: sem transbordos, palavras cortadas, alvos pequenos ou fim tapado`, async ({
    page,
    tmdb,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: largura, height: largura === 320 ? 568 : 844 });
    await comAreaSegura(page);
    await comTexto(page, escala);
    catalogoMedidas(tmdb);
    await semear(page, sementeMedidas());

    const problemas: string[] = [];
    for (const ecra of ECRAS) {
      await page.goto(ecra.url);
      await page.locator(ecra.espera).first().waitFor();
      await page.waitForTimeout(400);
      await ecra.abrir?.(page);
      const m = await page.evaluate(medirEcra, ecra.raiz ?? null);
      const aqui = (o: string) => problemas.push(`${ecra.id}: ${o}`);
      if (m.transbordo > 0) aqui(`a página é ${m.transbordo}px mais larga do que o ecrã`);
      for (const f of m.fora) aqui(`fora do ecrã — ${f}`);
      for (const c of m.cortado) aqui(`texto cortado — ${c}`);
      for (const a of m.alvos) if (!DE_PROPOSITO.some((re) => re.test(a))) aqui(`alvo pequeno — ${a}`);
      if (!ecra.fixo && m.folga !== null && m.folga < MINIMA_FOLGA)
        aqui(`o fim da página fica a ${m.folga}px da barra de separadores`);
    }
    expect(problemas).toEqual([]);
  });
}

/**
 * O vidro (`backdrop-filter`) custa por camada e por área. A única medida que
 * vale é a do iPhone do Ruben (Fase 3): 60 fps com 4 camadas. Num Mac não se
 * mede (uma calibração com 24 camadas extra não mexeu nos 17 ms), por isso
 * guarda-se o que se consegue garantir: nenhum ecrã passa das 4 camadas grandes
 * à vista, a rolar ou com uma folha aberta. As pequenas (selo e botão de cada
 * cartaz «Para ver» da Biblioteca › Filmes: 2 por cartaz) medem-se no iPhone
 * com `/diagnostico` (lido a 30-09; saiu na Fase 12).
 */
const MAX_CAMADAS_DE_VIDRO = 4;
/** as pequenas (o selo e o botão de cada cartaz, <2% do ecrã) contam-se à parte: no iPhone, 28 camadas não custaram (Fase 11) */
const AREA_DE_CAMADA_GRANDE = 0.02;

test("nenhum ecrã tem mais de 4 camadas de vidro à vista", async ({ page, tmdb }) => {
  test.setTimeout(120_000);
  await comAreaSegura(page);
  catalogoMedidas(tmdb);
  await semear(page, sementeMedidas());
  const excesso: string[] = [];
  for (const ecra of ECRAS) {
    await page.goto(ecra.url);
    await page.locator(ecra.espera).first().waitFor();
    await page.waitForTimeout(300);
    await ecra.abrir?.(page);
    const camadas = await page.evaluate(async (minimaArea) => {
      let max = 0;
      const alturaMax = document.documentElement.scrollHeight - innerHeight;
      for (const y of [0, alturaMax / 2, alturaMax]) {
        scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
        const n = Array.from(document.querySelectorAll("*")).filter((el) => {
          const cs = getComputedStyle(el);
          const f = cs.backdropFilter || cs.getPropertyValue("-webkit-backdrop-filter");
          if (!f || f === "none") return false;
          const r = el.getBoundingClientRect();
          if (!(r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && Number(cs.opacity) > 0)) return false;
          const w = Math.min(r.right, innerWidth) - Math.max(r.left, 0);
          const h = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
          return (w * h) / (innerWidth * innerHeight) >= minimaArea;
        }).length;
        max = Math.max(max, n);
      }
      return max;
    }, AREA_DE_CAMADA_GRANDE);
    if (camadas > MAX_CAMADAS_DE_VIDRO) excesso.push(`${ecra.id}: ${camadas} camadas`);
  }
  expect(excesso).toEqual([]);
});
