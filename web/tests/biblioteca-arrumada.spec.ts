import { test, expect } from "./apoio/base";
import { semear, type EpisodioVisto, type SerieSemeada } from "./apoio/semear";

/**
 * Fase 3 da Ronda 11 — as acabadas saem da frente.
 *
 * Medido na Biblioteca com a forma da do Ruben (74 séries, 57 completas):
 * a secção "Completas" começava aos 2934px e ia até aos 12311px — 76% do
 * ecrã era arquivo, e tudo o que vinha depois ficava atrás de catorze ecrãs
 * de rolagem. E as 5 séries seguidas sem um único episódio marcado estavam
 * escondidas dentro do balde "A ver", com as que estão mesmo a andar.
 */

const dia = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

/** `completas` acabadas, `meio` a meio, `porComecar` seguidas sem nada visto. */
function biblioteca(completas: number, meio: number, porComecar: number) {
  const series: SerieSemeada[] = [];
  const vistos: EpisodioVisto[] = [];
  for (let i = 0; i < completas; i++) {
    const uuid = `c-${i}`;
    series.push({ uuid, name: `Completa ${String(i).padStart(2, "0")}`, totalEpisodes: 10 });
    for (let e = 1; e <= 10; e++)
      vistos.push({ showUuid: uuid, season: 1, episode: e, watchedAt: dia(30 + i) });
  }
  for (let i = 0; i < meio; i++) {
    const uuid = `m-${i}`;
    series.push({ uuid, name: `A meio ${String(i).padStart(2, "0")}`, totalEpisodes: 10 });
    for (let e = 1; e <= 3; e++)
      vistos.push({ showUuid: uuid, season: 1, episode: e, watchedAt: dia(i) });
  }
  for (let i = 0; i < porComecar; i++) {
    series.push({ uuid: `p-${i}`, name: `Por comecar ${i}`, totalEpisodes: 10 });
  }
  return { series, vistos };
}

/** Os rótulos das secções, pela ordem em que aparecem na página. */
const seccoes = (page: import("@playwright/test").Page) =>
  page.locator('[data-testid="library-grid"] section div.sticky');

test("o que precisa de atenção vem primeiro; as acabadas vão para o fim", async ({ page }) => {
  await semear(page, biblioteca(57, 12, 5));
  await page.goto("/library");

  await expect(seccoes(page)).toHaveText([/Em curso12/, /Por começar5/, /Completas57/]);
});

test("uma série seguida sem nada visto não conta como 'a ver'", async ({ page }) => {
  await semear(page, biblioteca(0, 3, 4));
  await page.goto("/library");

  // A secção e a pastilha do filtro têm de dizer o mesmo número — foi por
  // dizerem coisas diferentes sobre os mesmos episódios que a Fase 1 existiu.
  await expect(seccoes(page)).toHaveText([/Em curso3/, /Por começar4/]);
  await page.getByRole("button", { name: /^Filtrar séries/ }).click();
  await expect(page.getByRole("menuitemradio", { name: /^Em curso\s*3$/ })).toBeVisible();
  await expect(page.getByRole("menuitemradio", { name: /^Por começar\s*4$/ })).toBeVisible();
});

test("as completas ficam dobradas, e a escolha de as abrir aguenta uma recarga", async ({
  page,
}) => {
  await semear(page, biblioteca(57, 12, 0));
  await page.goto("/library");

  // Dobradas: a banda conta-as, mas nenhuma ocupa o ecrã.
  const dobrar = page.getByTestId("dobrar-completas");
  await expect(dobrar).toHaveText(/Ver as 57 que já acabaste/);
  await expect(page.locator('a[href="/series/c-0"]')).toHaveCount(0);
  // …e as que estão a meio continuam todas lá.
  await expect(page.locator('a[href="/series/m-0"]')).toBeVisible();

  await dobrar.click();
  await expect(page.locator('a[href="/series/c-0"]')).toBeVisible();
  await expect(dobrar).toHaveText(/Esconder as que já acabaste/);

  // A escolha é uma preferência, não um estado de página: voltar a abrir a
  // Biblioteca não pode desfazê-la.
  await page.reload();
  await expect(page.locator('a[href="/series/c-0"]')).toBeVisible();
});

test("com poucas completas não aparece botão nenhum para dobrar", async ({ page }) => {
  // Abaixo do limiar, dobrar custa um toque para poupar meia dúzia de linhas.
  await semear(page, biblioteca(4, 3, 0));
  await page.goto("/library");

  await expect(seccoes(page)).toHaveText([/Em curso3/, /Completas4/]);
  await expect(page.locator('a[href="/series/c-0"]')).toBeVisible();
  await expect(page.getByTestId("dobrar-completas")).toHaveCount(0);
});
