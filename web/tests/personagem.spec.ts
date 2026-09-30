import { test, expect } from "./apoio/base";
import { semear } from "./apoio/semear";
import { seriesParaPersonagem } from "../src/lib/personagem";
import type { StoredShow, WatchedEpisode } from "../src/lib/db";

/**
 * Perfil › Editar › Personagem favorita: independente da série favorita, mas
 * só de séries que já se viu ou se está a ver (pelo menos um episódio marcado).
 */

const serie = (uuid: string, name: string, extra: Partial<StoredShow> = {}) =>
  ({ uuid, name, ...extra }) as StoredShow;
const visto = (showUuid: string) => ({ showUuid, season: 1, episode: 1 }) as WatchedEpisode;

test("só contam as séries com pelo menos um episódio marcado, por ordem alfabética, arquivadas incluídas", () => {
  const shows = [
    serie("s-c", "Casa", { archived: true }),
    serie("s-a", "Alfa"),
    serie("s-b", "Beta", { followed: true, inWatchlist: true }), // seguida, nada marcado
    serie("s-d", "Ébano"),
  ];
  const r = seriesParaPersonagem(shows, [visto("s-c"), visto("s-a"), visto("s-a"), visto("s-d")]);
  expect(r.map((s) => s.name)).toEqual(["Alfa", "Casa", "Ébano"]);
});

test("sem nada visto não há séries de onde escolher", () => {
  expect(seriesParaPersonagem([serie("s-a", "Alfa")], [])).toEqual([]);
});

test("a personagem escolhe-se de qualquer série já vista, e as por ver não aparecem", async ({ page, tmdb }) => {
  tmdb.elenco[100] = [{ ator: "Ator Alfa", personagem: "Heroína" }];
  tmdb.elenco[200] = [
    { ator: "Ator Beta", personagem: "Vilão" },
    { ator: "Outra Beta", personagem: "Mentor" },
  ];
  tmdb.elenco[300] = [{ ator: "Ator Gama", personagem: "Fantasma" }];
  await semear(page, {
    series: [
      { uuid: "s-a", name: "Alfa", tmdbId: 100 },
      { uuid: "s-b", name: "Beta", tmdbId: 200 },
      { uuid: "s-g", name: "Gama", tmdbId: 300, followed: false, inWatchlist: true }, // só «Para ver»
    ],
    vistos: [
      { showUuid: "s-a", season: 1, episode: 1 },
      { showUuid: "s-b", season: 1, episode: 1 },
    ],
  });
  await page.goto("/mira");
  const escolha = page.getByLabel("Elenco de");
  await expect(escolha.locator("option")).toHaveText([
    "Escolhe uma série que já viste",
    "Alfa",
    "Beta",
  ]);

  // a série 1, depois a 2: a personagem não tem de ser da mesma
  await escolha.selectOption({ label: "Alfa" });
  await page.getByRole("button", { name: /Heroína/ }).click();
  await expect(page.getByTestId("personagem-atual")).toContainText("Heroína");

  await escolha.selectOption({ label: "Beta" });
  // trocar de série não apaga a escolha
  await expect(page.getByTestId("personagem-atual")).toContainText("Heroína");
  await page.getByRole("button", { name: /Mentor/ }).click();
  const atual = page.getByTestId("personagem-atual");
  await expect(atual).toContainText("Mentor");
  await expect(atual).toContainText("Outra Beta");

  await atual.getByRole("button", { name: "Remover" }).click();
  await expect(page.getByTestId("personagem-atual")).toHaveCount(0);
});

test("sem nenhuma série vista, diz de onde sai a personagem em vez de um menu vazio", async ({ page }) => {
  await semear(page, { series: [{ uuid: "s-g", name: "Gama", followed: false, inWatchlist: true }] });
  await page.goto("/mira");
  await expect(page.getByText(/já tenhas visto/)).toBeVisible();
  await expect(page.getByLabel("Elenco de")).toHaveCount(0);
});
