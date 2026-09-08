import { test, expect } from "./apoio/base";
import { preferir, semear } from "./apoio/semear";

/**
 * Fase AC — o estado tem de sobreviver a navegar.
 *
 * São três estados com três moradas diferentes, de propósito: partilhável e
 * reversível vai para o URL (o filtro do "Pôr em dia"), gosto pessoal vai
 * para as preferências, e efémero de sessão vive num módulo (a posição do
 * baralho do Explorar). Cada teste aqui defende uma dessas moradas.
 */

const SERIES = Array.from({ length: 30 }, (_, i) => ({
  uuid: `s-${String(i + 1).padStart(2, "0")}`,
  name: `Serie ${String(i + 1).padStart(2, "0")}`,
}));

const HA_60_DIAS = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

test("o scroll da biblioteca volta ao sítio depois de abrir uma série", async ({ page }) => {
  await semear(page, { series: SERIES });
  await page.goto("/library");

  const cartaz = page.locator('a[href="/series/s-24"]');
  await cartaz.scrollIntoViewIfNeeded();
  const antes = await page.evaluate(() => window.scrollY);
  expect(antes).toBeGreaterThan(400); // se não rolou, o teste não prova nada

  await cartaz.click();
  await expect(page).toHaveURL(/\/series\/s-24$/);

  await page.getByRole("button", { name: "Voltar às séries" }).click();
  await expect(page).toHaveURL(/\/library$/);

  // O browser repõe o scroll no instante exato do recuo. Antes da cache
  // partilhada, nesse instante a página ainda era o esqueleto (mais curto que
  // o conteúdo real) e a posição reposta era cortada pela altura de então —
  // não era o scroll que não ficava guardado, era o documento que ainda não
  // tinha tamanho para lá chegar.
  await expect
    .poll(() => page.evaluate(() => window.scrollY), { timeout: 5_000 })
    .toBeGreaterThan(antes - 100);
});

test("o filtro do Pôr em dia fica no URL e aguenta uma recarga", async ({ page }) => {
  await semear(page, {
    series: [{ uuid: "s-parada", name: "Serie Parada" }],
    vistos: [{ showUuid: "s-parada", season: 1, episode: 1, watchedAt: HA_60_DIAS }],
    kv: {
      "nextup-cache": {
        "s-parada": {
          episode: { season: 1, episode: 2, name: "Segundo", airDate: "2020-01-08" },
          lastWatchedAt: HA_60_DIAS,
        },
      },
    },
  });

  await page.goto("/em-dia");
  // Vista há 60 dias: não está em "Continuar", está em "Retomar".
  await expect(page.getByText("Nada para pôr em dia aqui")).toBeVisible();

  await page.getByRole("button", { name: /^Retomar/ }).click();
  await expect(page).toHaveURL(/\/em-dia\?filtro=retomar$/);
  await expect(page.getByText("Serie Parada").first()).toBeVisible();

  // Estar no URL é o que faz o filtro sobreviver a tudo — a recarregar, a
  // partilhar o link, e a recuar de um episódio marcado.
  await page.reload();
  await expect(page.getByText("Serie Parada").first()).toBeVisible();
});

test("a posição do baralho do Explorar não se perde ao espreitar outro separador", async ({
  page,
  tmdb,
}) => {
  tmdb.tendencias = [1, 2, 3, 4].map((n) => ({
    id: 100 + n,
    name: `Sugestao ${n}`,
    poster_path: "/cartaz.jpg",
    backdrop_path: null,
    overview: "",
    first_air_date: "2021-01-01",
    vote_average: 7,
  }));

  await semear(page, {});
  await preferir(page, { "explorar-modo": "cartoes" });
  await page.goto("/explorar");

  await expect(page.getByText("1 / 4")).toBeVisible();
  await page.getByRole("button", { name: /Não me interessa/ }).click();
  await expect(page.getByText("2 /")).toBeVisible();

  // Ir à Biblioteca e voltar não é "recuar" — é só espreitar outro separador.
  // Pela dock, como no telemóvel: a posição vive num módulo, e um `goto` (que
  // recarrega a página toda) apagá-la-ia sem isso querer dizer nada.
  await page.locator('nav a[href="/library"]').click();
  await expect(page).toHaveURL(/\/library$/);
  await page.locator('nav a[href="/explorar"]').click();
  await expect(page).toHaveURL(/\/explorar$/);

  // Repunha o baralho a 1/86 depois de já se ir em 5/84.
  await expect(page.getByText(/^2 \//)).toBeVisible();
});
