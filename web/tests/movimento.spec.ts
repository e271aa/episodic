import { test, expect } from "./apoio/base";
import { semear } from "./apoio/semear";

/**
 * Ronda 12, Fase 6 — movimento e o ritual de marcar (AUDITORIA.md).
 *
 * O movimento mede-se pelo que o browser diz que está a correr (curvas,
 * durações, `getAnimations()`), não por capturas: uma captura a meio de uma
 * animação depende da pressa da máquina.
 */

// ── movimento reduzido ───────────────────────────────────────

test("com movimento reduzido, o que se desloca passa a só desvanecer — não desaparece tudo", async ({
  page,
}) => {
  // Zerava tudo a 0,01ms: as páginas e os cartazes apareciam de golpe, e as
  // mudanças de cor e opacidade também. Movimento reduzido é menos
  // movimento, não nenhum — tiram-se as deslocações, fica o resto.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await semear(page, {
    series: [{ uuid: "s-1", name: "Serie Um" }],
    listas: [{ id: "l-1", name: "Uma lista" }],
  });
  await page.goto("/library");
  const entrada = await page
    .locator(".page-enter")
    .first()
    .evaluate((el) => {
      const css = getComputedStyle(el);
      return { nome: css.animationName, segundos: parseFloat(css.animationDuration) };
    });
  expect(entrada.nome).toBe("esvanecer");
  expect(entrada.segundos).toBeGreaterThan(0.1);

  // um cartão com transição de contorno, sombra e posição: fica a de cor,
  // sai a de posição
  await page.goto("/library?tipo=listas");
  const cartao = await page
    .locator(".ep-card")
    .first()
    .evaluate((el) => {
      const css = getComputedStyle(el);
      return { propriedades: css.transitionProperty, segundos: parseFloat(css.transitionDuration) };
    });
  expect(cartao.propriedades).not.toContain("transform");
  expect(cartao.propriedades).toContain("border-color");
  expect(cartao.segundos).toBeGreaterThan(0.1);
});

test("sem movimento reduzido, as páginas continuam a entrar a subir", async ({ page }) => {
  await semear(page, { series: [{ uuid: "s-1", name: "Serie Um" }] });
  await page.goto("/library");
  const entrada = await page
    .locator(".page-enter")
    .first()
    .evaluate((el) => {
      const css = getComputedStyle(el);
      return { nome: css.animationName, curva: css.animationTimingFunction };
    });
  expect(entrada.nome).toBe("page-enter");
  // a curva forte, não o `ease-out` do browser (que demora a arrancar)
  expect(entrada.curva).toBe("cubic-bezier(0.23, 1, 0.32, 1)");
});

// ── as folhas ────────────────────────────────────────────────

async function abrirFiltros(page: import("@playwright/test").Page) {
  await semear(page, { series: [{ uuid: "s-1", name: "Serie Um" }] });
  await page.goto("/library");
  await page.getByRole("button", { name: "Filtros e ordenação" }).click();
  const folha = page.getByRole("dialog", { name: "Filtros e ordenação" });
  await expect(folha).toBeVisible();
  return folha;
}

/** As transições de `transform` a correr no painel da folha, com o ponto de partida. */
function transicoesDoPainel(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const painel = document.querySelector('[role="dialog"] [data-folha]');
    if (!painel) return null;
    // o WebKit dá os quadros como estão escritos — "translateY(100%)" —, e
    // uma percentagem de um translate é da altura do próprio elemento
    const altura = (painel as HTMLElement).offsetHeight;
    const emY = (valor: unknown) => {
      const t = String(valor ?? "none");
      const m = t.match(/translateY\((-?[\d.]+)(px|%)\)/);
      if (m) return m[2] === "%" ? (Number(m[1]) / 100) * altura : Number(m[1]);
      return new DOMMatrix(t === "none" ? undefined : t).m42;
    };
    return painel.getAnimations().map((a) => {
      const quadros = (a.effect as KeyframeEffect).getKeyframes();
      const tempo = (a.effect as KeyframeEffect).getTiming();
      return {
        deY: emY(quadros[0]?.transform),
        paraY: emY(quadros[quadros.length - 1]?.transform),
        duracao: Number(tempo.duration),
        curva: tempo.easing,
      };
    });
  });
}

test("a folha sobe do fundo com a curva da gaveta, e desce pelo mesmo caminho, mais depressa", async ({
  page,
}) => {
  // Entrava como uma página (6px a subir) e desaparecia de golpe ao fechar.
  // Vem de onde veio o toque — a barra de baixo — e volta para lá.
  await semear(page, { series: [{ uuid: "s-1", name: "Serie Um" }] });
  await page.goto("/library");
  await page.getByRole("button", { name: "Filtros e ordenação" }).click();
  const entrada = await transicoesDoPainel(page);
  expect(entrada?.length).toBeGreaterThan(0);
  expect(entrada![0].deY).toBeGreaterThan(100); // parte de baixo do ecrã
  expect(entrada![0].paraY).toBe(0);
  expect(entrada![0].curva).toBe("cubic-bezier(0.32, 0.72, 0, 1)");

  await page.waitForTimeout(400);
  await page.getByRole("dialog").getByRole("button", { name: "Fechar" }).last().click();
  // a meio da saída continua lá, a descer — não desaparece de golpe
  const saida = await transicoesDoPainel(page);
  expect(saida?.length).toBeGreaterThan(0);
  expect(saida![0].paraY).toBeGreaterThan(100);
  expect(saida![0].duracao).toBeLessThan(entrada![0].duracao);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("arrastar a folha para baixo fecha-a — um piparote rápido chega", async ({ page }) => {
  const folha = await abrirFiltros(page);
  await page.waitForTimeout(400);
  const cabeca = (await folha.locator("[data-folha-pega]").boundingBox())!;
  const x = cabeca.x + cabeca.width / 3;
  const y = cabeca.y + cabeca.height / 2;
  // 70px em dois passos, sem pausa: curto, mas rápido
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 35);
  await page.mouse.move(x, y + 70);
  await page.mouse.up();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("um arrasto curto e lento não fecha: a folha volta ao sítio", async ({ page }) => {
  const folha = await abrirFiltros(page);
  await page.waitForTimeout(400);
  const cabeca = (await folha.locator("[data-folha-pega]").boundingBox())!;
  const x = cabeca.x + cabeca.width / 3;
  const y = cabeca.y + cabeca.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let d = 10; d <= 60; d += 10) {
    await page.mouse.move(x, y + d);
    await page.waitForTimeout(120);
  }
  await page.mouse.up();
  await page.waitForTimeout(500);
  await expect(folha).toBeVisible();
  const deslocada = await folha
    .locator("[data-folha]")
    .evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m42);
  expect(deslocada).toBe(0);
});

test("com movimento reduzido, a folha aparece a desvanecer, sem subir", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await semear(page, { series: [{ uuid: "s-1", name: "Serie Um" }] });
  await page.goto("/library");
  await page.getByRole("button", { name: "Filtros e ordenação" }).click();
  const propriedades = await page.evaluate(() =>
    document
      .querySelector('[role="dialog"] [data-folha]')!
      .getAnimations()
      .map((a) => (a as CSSTransition).transitionProperty),
  );
  expect(propriedades).toContain("opacity");
  expect(propriedades).not.toContain("transform");
});
