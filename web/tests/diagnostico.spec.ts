import { test, expect } from "./apoio/base";
import { semear } from "./apoio/semear";

/**
 * Ronda 14, Fase 11 — `/diagnostico`: o que só se vê com a PWA instalada, lido
 * no próprio iPhone (área segura, tamanho de texto do sistema, barra de estado)
 * mais a medição do vidro a rolar. Aqui só se prova que lê e que mede; os
 * valores que interessam são os do aparelho do Ruben.
 */

test("o diagnóstico lê o ecrã, o texto, a área segura e as cores", async ({ page }) => {
  await semear(page, {});
  await page.goto("/diagnostico");
  const leituras = page.getByTestId("leituras");
  await expect(leituras).toContainText("Área segura");
  // o browser dos testes não tem área segura nem Dynamic Type: 0 e 17px
  await expect(leituras).toContainText("cima 0 · direita 0 · baixo 0 · esquerda 0");
  await expect(leituras.locator("div", { hasText: "Texto da raiz" }).last()).toContainText("17 px");
  await expect(leituras.locator("div", { hasText: "Modo do iPhone" }).last()).toContainText("escuro");
  // a barra de estado que a app pede à PWA
  await expect(leituras).toContainText("Barra de estado (meta)black");
  // o ecrã é o do telemóvel emulado
  await expect(leituras).toContainText("janela 390×");
});

test("medir o vidro a rolar dá quatro leituras, de sem vidro a 28 camadas, e o vidro volta no fim", async ({
  page,
}) => {
  test.setTimeout(40_000);
  await semear(page, {});
  await page.goto("/diagnostico");
  const grandes = () =>
    page.evaluate(
      () =>
        Array.from(document.querySelectorAll(".diag-vidro")).filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && getComputedStyle(el).backdropFilter !== "none";
        }).length,
    );
  // em repouso: só as 4 da app (as pequenas ficam escondidas)
  expect(await grandes()).toBe(4);

  await page.getByRole("button", { name: "Medir o vidro a rolar" }).click();
  // na última fase estão à vista as 4 + as 24 pequenas
  await page.waitForFunction(() => document.querySelector(".diag-palco")?.getAttribute("data-fase") === "vinteoito");
  expect(await grandes()).toBe(28);

  const amostras = page.getByTestId("amostras");
  await expect(amostras.locator("li")).toHaveCount(4, { timeout: 15_000 });
  await expect(amostras).toContainText("Sem vidro");
  await expect(amostras).toContainText("28 camadas");
  expect(await amostras.innerText()).toMatch(/p50 \d+(\.\d+)? ms/);
  await expect(page.getByRole("button", { name: "Medir o vidro a rolar" })).toBeEnabled();
  expect(await grandes()).toBe(4);
});
