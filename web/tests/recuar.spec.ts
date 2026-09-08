import { test, expect } from "./apoio/base";
import { semear } from "./apoio/semear";

/**
 * Fase AB — "abro um filme, ando para trás e vai para a página inicial e não
 * para onde estava".
 *
 * Cada botão de voltar era um `<Link href>` fixo: o que parecia recuar era
 * sempre "ir para aqui", e cada toque empurrava uma entrada NOVA no histórico
 * em vez de desfazer a última. Estes testes olham para o histórico, não só
 * para o URL — dois botões podem acabar no mesmo sítio e só um deles ter
 * recuado a sério.
 */

const SERIE = { uuid: "s-1", name: "Serie de Teste" };
const FILME = { key: "f-1", name: "Filme de Teste", watchedAt: "2024-05-01T00:00:00.000Z" };

const historico = (page: import("@playwright/test").Page) =>
  page.evaluate(() => window.history.length);

test("recuar de um filme devolve à biblioteca, não à página inicial", async ({ page }) => {
  await semear(page, { filmes: [FILME] });
  await page.goto("/library?tipo=filmes");

  await page.locator('a[href="/movies/f-1"]').click();
  await expect(page).toHaveURL(/\/movies\/f-1$/);

  await page.getByRole("button", { name: "Voltar aos filmes" }).click();
  await expect(page).toHaveURL(/\/library\?tipo=filmes$/);
});

test("recuar desfaz mesmo a navegação, não empilha outra por cima", async ({ page }) => {
  await semear(page, { filmes: [FILME] });
  await page.goto("/library?tipo=filmes");
  const antes = await historico(page);

  await page.locator('a[href="/movies/f-1"]').click();
  await expect(page).toHaveURL(/\/movies\/f-1$/);
  expect(await historico(page)).toBe(antes + 1);

  await page.getByRole("button", { name: "Voltar aos filmes" }).click();
  await expect(page).toHaveURL(/\/library\?tipo=filmes$/);

  // Duas provas de que foi um recuo e não uma ida para a frente disfarçada:
  // o histórico não cresceu (com o `<Link href>` antigo dava `antes + 2`)…
  expect(await historico(page)).toBe(antes + 1);
  // …e o filme continua **à frente**, alcançável. Um `push` teria apagado o
  // ramo da frente, e era isso que fazia o gesto do telemóvel reabrir a
  // página que se tinha acabado de fechar.
  await page.goForward();
  await expect(page).toHaveURL(/\/movies\/f-1$/);
});

test("recuar de uma série guarda a ordenação de onde se veio", async ({ page }) => {
  await semear(page, { series: [SERIE] });
  await page.goto("/library?ordem=az");

  await page.locator('a[href="/series/s-1"]').click();
  await expect(page).toHaveURL(/\/series\/s-1$/);

  await page.getByRole("button", { name: "Voltar às séries" }).click();
  await expect(page).toHaveURL(/\/library\?ordem=az$/);
});

test("página aberta por link direto não atira para fora da app", async ({ page }) => {
  await semear(page, { series: [SERIE] });
  // Sem navegação nenhuma dentro da app: é o caso de abrir a PWA já nesta
  // página, ou de tocar num link. `window.history.length > 1` — a conta que
  // isto usava antes — daria verdadeiro à mesma, e o recuo saía da app.
  await page.goto("/series/s-1");

  await page.getByRole("button", { name: "Voltar às séries" }).click();
  await expect(page).toHaveURL(/\/series$/);
});
