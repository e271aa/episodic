import { test, expect } from "./apoio/base";
import { semear } from "./apoio/semear";
import { serieCompleta } from "./apoio/tmdb";

/**
 * Nas séries só existe «Por começar»: «Para ver» saiu (pedido do Ruben,
 * 30-09). Seguida e sem nenhum episódio marcado é tudo o que uma série por
 * começar é — e entra na fila da casa. Os filmes mantêm o «Para ver».
 *
 * As séries que já estavam em «Para ver» (`inWatchlist` sem `followed`) não
 * são migradas nem reescritas: lêem-se como seguidas, e a base fica como está.
 */

const sugestoes = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: 900 + i,
    name: `Sugestao ${i + 1}`,
    poster_path: "/cartaz.jpg",
    backdrop_path: null,
    overview: "",
    first_air_date: "2022-01-01",
    vote_average: 7,
  }));

const LEGADA = {
  uuid: "s-l",
  name: "Legada",
  tvmazeId: 495,
  numeracao: "tvmaze" as const,
  totalEpisodes: 3,
  followed: false,
  inWatchlist: true,
};

test("Explorar: o cartaz de uma série diz «Por começar» e segue-a, sem «Para ver»", async ({ page, tmdb }) => {
  tmdb.tendencias = sugestoes(3);
  const c = serieCompleta(900, "Sugestao 1", [3]);
  Object.assign(tmdb.series, c.series);
  Object.assign(tmdb.episodios, c.episodios);
  await semear(page, {});
  await page.goto("/explorar");
  await expect(page.getByRole("button", { name: "Por começar" })).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Para ver" })).toHaveCount(0);

  await page.getByRole("button", { name: "Por começar" }).first().click();
  await expect(page.getByText("Na lista", { exact: true })).toBeVisible();

  // ficou seguida: aparece em «Por começar» na Biblioteca e na casa
  await page.goto("/library?filtro=por-comecar");
  await expect(page.getByText("Sugestao 1").first()).toBeVisible();
  await page.goto("/series");
  await expect(page.getByRole("heading", { level: 2, name: "Sugestao 1" })).toBeVisible();
  await expect(page.getByText("Estás em dia")).toHaveCount(0);
});

test("Biblioteca: o filtro das séries não tem «Para ver»; uma série que lá estava lê-se como «Por começar»", async ({
  page,
}) => {
  await semear(page, { series: [LEGADA, { uuid: "s-p", name: "Parada", followed: false, inWatchlist: false }] });
  await page.goto("/library");
  await page.getByRole("button", { name: /^Filtrar séries/ }).click();
  await expect(page.getByRole("menuitemradio", { name: /^Para ver/ })).toHaveCount(0);
  await page.getByRole("menuitemradio", { name: /^Por começar/ }).click();
  await expect(page.getByText("Legada").first()).toBeVisible();
  await expect(page.getByText("Parada")).toHaveCount(0);
});

test("casa: a série que estava em «Para ver» entra na fila, em «Por começar»", async ({ page, tmdb }) => {
  tmdb.tvmaze[495] = [3];
  await semear(page, { series: [LEGADA] });
  await page.goto("/series");
  // a única da fila é o herói da casa: «Estás em dia» seria falso
  await expect(page.getByRole("heading", { level: 2, name: "Legada" })).toBeVisible();
  await expect(page.getByText("Estás em dia")).toHaveCount(0);
});

test("detalhe: uma série que não segues não tem «Para ver»; «Deixar de seguir» leva a «Já não sigo» de vez", async ({
  page,
}) => {
  await semear(page, { series: [LEGADA] });
  await page.goto("/series/s-l");
  await expect(page.getByRole("button", { name: /Para ver/ })).toHaveCount(0);
  await page.getByTestId("menu-serie").click();
  await page.getByRole("button", { name: /Deixar de seguir/ }).click();

  await page.goto("/library?filtro=parei");
  await expect(page.getByText("Legada").first()).toBeVisible();
  await page.goto("/library?filtro=por-comecar");
  await page.getByRole("heading", { level: 1, name: "Biblioteca" }).waitFor();
  await expect(page.getByText("Legada")).toHaveCount(0);
});
