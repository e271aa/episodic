import { test, expect } from "./apoio/base";
import { semear } from "./apoio/semear";
import { serieCompleta } from "./apoio/tmdb";

/**
 * Marcar é a única coisa que esta app tem mesmo de saber fazer — um episódio
 * na página da série, um filme na Biblioteca. Ambos passaram por refactor na
 * Fase AD (o cartaz do filme deixou de ser um cartão à parte e passou a ser o
 * `PosterCard` com uma ação), e um refactor que não muda nada do que se vê é
 * precisamente o que ninguém repara que partiu.
 */

test("marcar o próximo episódio conta o episódio e propõe o seguinte", async ({
  page,
  tmdb,
}) => {
  const { series, episodios } = serieCompleta(500, "Serie Alvo", [3]);
  Object.assign(tmdb.series, series);
  Object.assign(tmdb.episodios, episodios);

  await semear(page, {
    series: [{ uuid: "s-alvo", name: "Serie Alvo", tmdbId: 500, totalEpisodes: 3 }],
  });
  await page.goto("/series/s-alvo");

  const marcar = page.getByTestId("mark-next");
  await expect(marcar).toContainText("Episódio 1");

  await marcar.click();
  await expect(marcar).toContainText("Episódio 2");
  await expect(page.getByText("2 por ver")).toBeVisible();
});

test("marcar um filme 'para ver' como visto tira-o de 'para ver'", async ({ page }) => {
  await semear(page, {
    filmes: [{ key: "f-porver", name: "Filme Por Ver", releaseDate: "2021-06-01" }],
  });
  await page.goto("/library?tipo=filmes&filtro=para-ver");

  const cartaz = page.locator('a[href="/movies/f-porver"]');
  await expect(cartaz).toBeVisible();
  await expect(cartaz.getByText("Para ver")).toBeVisible();

  // O botão vive **dentro** do link do cartaz: se o `preventDefault` se
  // perder, marcar passa a navegar para o detalhe em vez de marcar.
  await page.getByRole("button", { name: "Marcar Filme Por Ver como visto" }).click();

  await expect(page).toHaveURL(/\/library\?tipo=filmes&filtro=para-ver$/);
  await expect(page.getByText("Filme marcado como visto")).toBeVisible();
  await expect(cartaz).toHaveCount(0);
});

test("a Biblioteca mostra séries e filmes cada um no seu separador", async ({ page }) => {
  await semear(page, {
    series: [{ uuid: "s-1", name: "Serie Uma" }],
    filmes: [{ key: "f-1", name: "Filme Um", watchedAt: "2024-01-01T00:00:00.000Z" }],
  });

  await page.goto("/library");
  await expect(page.locator('a[href="/series/s-1"]')).toBeVisible();
  await expect(page.locator('a[href="/movies/f-1"]')).toHaveCount(0);

  await page.goto("/library?tipo=filmes");
  await expect(page.locator('a[href="/movies/f-1"]')).toBeVisible();
  await expect(page.locator('a[href="/series/s-1"]')).toHaveCount(0);
});
