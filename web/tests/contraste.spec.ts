import { test, expect } from "./apoio/base";
import { semear } from "./apoio/semear";

/**
 * Ronda 14, Fase 9 — contraste nos dois modos, medido nos valores que o
 * browser resolve (não nos que o DESIGN.md diz). Texto: AA (4,5:1); o que se
 * vê sem se ler — pontos e barras de estado, anéis de escolha — 3:1 (WCAG
 * 1.4.11). Medido a 30-09: em claro o erro estava a 3,2:1, o verde e o azul de
 * estado a 2:1 e os anéis a 1,7:1; à noite o texto terciário sobre `fill`
 * estava a 3,9:1.
 */

type Rgba = [number, number, number, number];

const TEXTO = ["--m-label", "--m-label-2", "--m-label-faint", "--m-por-marcar-texto", "--m-danger"];
const GRAFICO = ["--m-em-dia", "--m-por-marcar", "--m-terminada", "--m-label-3"];
const SUPERFICIES = ["--m-bg", "--m-group", "--m-elevated"];

/**
 * Os tokens do claro vivem em **dois** sítios do CSS: no `@media
 * (prefers-color-scheme: light)` («Automático») e em `[data-theme="claro"]`
 * (escolhido em Aparência). Medir só o primeiro deixou passar uma mutação que
 * mexia no segundo (`r14-f3/claro-a-60`, Fase 10) — por isso o claro escolhido,
 * com o sistema em noite, tem o seu caso.
 */
const MODOS = [
  { nome: "noite", sistema: "dark", escolha: null },
  { nome: "claro (o do sistema)", sistema: "light", escolha: null },
  { nome: "claro (escolhido, com o sistema em noite)", sistema: "dark", escolha: "claro" },
] as const;

for (const { nome, sistema, escolha } of MODOS) {
  test(`contraste em ${nome}: texto AA e gráficos 3:1 sobre as superfícies`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: sistema });
    if (escolha) await page.addInitScript((v) => localStorage.setItem("aparencia", v), escolha);
    await page.goto("/profile/definicoes");
    if (escolha) await expect(page.locator("html")).toHaveAttribute("data-theme", escolha);
    const medidas = await page.evaluate(
      ({ texto, grafico, superficies }) => {
        const ler = (v: string): Rgba => {
          const el = document.createElement("i");
          el.style.color = `var(${v})`;
          document.body.appendChild(el);
          const m = getComputedStyle(el).color.match(/[\d.]+/g)!.map(Number);
          el.remove();
          return [m[0], m[1], m[2], m[3] ?? 1];
        };
        const lum = ([r, g, b]: number[]) => {
          const f = (x: number) => ((x /= 255) <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        };
        const sobre = (fg: Rgba, bg: Rgba) =>
          [0, 1, 2].map((i) => fg[3] * fg[i] + (1 - fg[3]) * bg[i]);
        const razao = (a: number[], b: number[]) => {
          const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
          return (x + 0.05) / (y + 0.05);
        };
        const out: { par: string; razao: number; minimo: number }[] = [];
        for (const s of superficies) {
          const bg = ler(s);
          for (const t of texto) out.push({ par: `${t} em ${s}`, razao: razao(sobre(ler(t), bg), bg), minimo: 4.5 });
          for (const g of grafico) {
            if (g === "--m-label-3" && s === "--m-elevated") continue;
            out.push({ par: `${g} em ${s}`, razao: razao(sobre(ler(g), bg), bg), minimo: 3 });
          }
        }
        // o texto secundário também se lê sobre `fill` (campos, chips)
        const fill = ler("--m-fill");
        for (const s of ["--m-bg", "--m-group"]) {
          const base = sobre(fill, ler(s));
          const fundo: Rgba = [base[0], base[1], base[2], 1];
          for (const t of ["--m-label-2", "--m-label-faint"])
            out.push({ par: `${t} em fill sobre ${s}`, razao: razao(sobre(ler(t), fundo), base), minimo: 4.5 });
        }
        const acao = ler("--m-acao");
        out.push({ par: "on-label em acao", razao: razao(ler("--m-on-label").slice(0, 3), acao.slice(0, 3)), minimo: 4.5 });
        return out;
      },
      { texto: TEXTO, grafico: GRAFICO, superficies: SUPERFICIES },
    );
    const falhas = medidas
      .filter((m) => m.razao < m.minimo)
      .map((m) => `${m.par}: ${m.razao.toFixed(2)} < ${m.minimo}`);
    expect(falhas).toEqual([]);
  });
}

/**
 * Fase 12 — o degradê de cima do herói saiu. Era para a arte passar por baixo
 * da barra de estado, mas na PWA a página começa abaixo dela (área segura de
 * cima 0, lido no iPhone): só lavava o topo da arte — 72% de branco de dia. O
 * que fica por cima da arte são os círculos de vidro, e esses leem-se sozinhos.
 */
for (const [nome, abrir] of [
  ["série", async (page: import("@playwright/test").Page) => {
    await semear(page, { series: [{ uuid: "s-1", name: "Severance", backdropPath: "/fundo.jpg" }] });
    await page.goto("/series/s-1");
  }],
  ["filme", async (page: import("@playwright/test").Page) => {
    await semear(page, { filmes: [{ key: "f-1", name: "Past Lives", watchedAt: null }] });
    await page.goto("/movies/f-1");
  }],
] as const) {
  test(`${nome}: o topo da arte fica sem véu, nos dois modos`, async ({ page }) => {
    await abrir(page);
    for (const modo of ["dark", "light"] as const) {
      await page.emulateMedia({ colorScheme: modo });
      const veu = await page.getByTestId("veu-heroi").evaluate((el) => getComputedStyle(el).backgroundImage);
      // a primeira cor do degradê é a do topo: transparente
      const topo = veu.match(/rgba?\([^)]*\)|transparent/)![0];
      expect(topo === "transparent" || /,\s*0\)$/.test(topo), `${modo}: ${veu}`).toBe(true);
    }
  });
}

for (const modo of ["dark", "light"] as const) {
  test(`o ícone do círculo de vidro lê-se sobre a pior arte, sem degradê (${modo})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: modo });
    await page.goto("/profile/definicoes");
    const r = await page.evaluate((modo) => {
      const ler = (v: string) => {
        const el = document.createElement("i");
        el.style.color = `var(${v})`;
        document.body.appendChild(el);
        const m = getComputedStyle(el).color.match(/[\d.]+/g)!.map(Number);
        el.remove();
        return [m[0], m[1], m[2], m[3] ?? 1];
      };
      const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      const lum = (c: number[]) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
      const vidro = ler("--m-glass");
      // a pior arte: branca à noite (ícone branco), preta de dia (ícone preto)
      const arte = modo === "dark" ? 255 : 0;
      const fundo = vidro.slice(0, 3).map((c) => c * vidro[3] + arte * (1 - vidro[3]));
      const icone = ler("--m-label");
      const [a, b] = [lum(icone), lum(fundo)];
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    }, modo);
    expect(r).toBeGreaterThanOrEqual(4.5);
  });
}
