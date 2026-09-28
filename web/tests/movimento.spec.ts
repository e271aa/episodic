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
