import { test, expect } from "./apoio/base";
import { semear } from "./apoio/semear";

/**
 * Ronda 9 — o que a auditoria `/qualidade-movel` mediu e ficou corrigido.
 * Um teste por achado, cada um visto a falhar com o bug de volta.
 */

const MUITAS = Array.from({ length: 30 }, (_, i) => ({
  uuid: `s-${String(i + 1).padStart(2, "0")}`,
  name: `Serie ${String(i + 1).padStart(2, "0")}`,
  totalEpisodes: 20,
}));

test("o detalhe da série não rola de lado", async ({ page }) => {
  await semear(page, { series: [{ uuid: "s-1", name: "Serie Um", totalEpisodes: 10 }] });
  await page.goto("/series/s-1");
  // Esperar pelo herói antes de medir: sem isto mede-se o esqueleto, que não
  // tem a margem negativa — o teste passava com o bug lá dentro.
  await expect(page.getByRole("button", { name: "Voltar às séries" })).toBeVisible();
  // Medido antes: documento a 406px num ecrã de 390 — o herói tinha `-mx-4`
  // sem um padding do pai para cancelar.
  const largura = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    ecra: document.documentElement.clientWidth,
  }));
  expect(largura.doc).toBeLessThanOrEqual(largura.ecra + 1);
});

test("remover um item de uma lista dá para anular", async ({ page }) => {
  await semear(page, {
    series: [{ uuid: "s-1", name: "Serie Um" }],
    listas: [{ id: "l-1", name: "A minha lista", items: [{ kind: "show", refId: "s-1" }] }],
  });
  await page.goto("/listas/l-1");
  await expect(page.getByText("Serie Um").first()).toBeVisible();

  await page.getByRole("button", { name: /Remover/ }).first().click();
  await expect(page.getByText("Removido da lista")).toBeVisible();

  await page.getByRole("button", { name: "Anular" }).click();
  await expect(page.getByText("Serie Um").first()).toBeVisible();
});

test("apagar uma lista dá para anular, com o mesmo conteúdo", async ({ page }) => {
  await semear(page, {
    series: [{ uuid: "s-1", name: "Serie Um" }],
    listas: [{ id: "l-1", name: "A minha lista", items: [{ kind: "show", refId: "s-1" }] }],
  });
  await page.goto("/listas/l-1");

  // dois toques, de propósito — a confirmação fica
  await page.getByRole("button", { name: /Apagar lista/ }).click();
  await page.getByRole("button", { name: /Toca outra vez/ }).click();
  await expect(page).toHaveURL(/\/listas$/);
  // pelo link da lista, não por texto solto: o próprio aviso de anular mostra
  // o nome dela, e um `getByText` apanhava-o
  const linkDaLista = page.locator('a[href="/listas/l-1"]');
  await expect(linkDaLista).toHaveCount(0);

  await page.getByRole("button", { name: "Anular" }).click();
  await expect(linkDaLista).toBeVisible();
  // e volta com o item lá dentro, não só o nome
  await linkDaLista.click();
  await expect(page.getByText("Serie Um").first()).toBeVisible();
});

test("as Estatísticas sem histórico oferecem um passo seguinte", async ({ page }) => {
  await semear(page, { series: MUITAS.slice(0, 3) });
  await page.goto("/estatisticas");
  // Antes: só um gráfico de barras todas a zero, que se lê como avaria.
  await expect(page.getByText("Ainda não há nada para contar")).toBeVisible();
  await expect(page.getByRole("link", { name: "Marcar o primeiro" })).toBeVisible();
  await expect(page.getByText("DIA DA SEMANA PREFERIDO")).toHaveCount(0);
});

test("o 'Pôr em dia' vazio não manda procurar noutro filtro que também está vazio", async ({
  page,
}) => {
  await semear(page, { series: MUITAS.slice(0, 3) });
  await page.goto("/em-dia");
  await expect(page.getByText("Estás em dia com tudo")).toBeVisible();
  await expect(page.getByText("experimenta outro acima")).toHaveCount(0);
});

test("o 'A seguir' volta ao sítio depois de abrir uma série", async ({ page, tmdb }) => {
  // A página compõe o primeiro instante de três fontes assíncronas: as séries,
  // a fila e o calendário. Sem a fila, o herói não desenha — e a página fica
  // MAIS CURTA que o próprio esqueleto. Medido antes: sair a 683px e voltar
  // dava 230px, que é exatamente `894 (esqueleto) − 664 (ecrã)`.
  const HOJE = new Date().toISOString();
  const series = Array.from({ length: 12 }, (_, i) => ({
    uuid: `s-${i}`,
    name: `Serie ${i}`,
    totalEpisodes: 20,
    tvmazeId: 800 + i,
  }));
  for (const s of series) tmdb.tvmaze[s.tvmazeId!] = [20];

  await semear(page, {
    series,
    vistos: series.map((s) => ({ showUuid: s.uuid, season: 1, episode: 1, watchedAt: HOJE })),
    kv: {
      "nextup-cache": Object.fromEntries(
        series.map((s) => [
          s.uuid,
          { episode: { season: 1, episode: 2, name: "Segundo", airDate: "2020-01-01" }, lastWatchedAt: HOJE },
        ]),
      ),
    },
  });

  await page.goto("/series");
  await expect(page.locator('a[href^="/series/s-"]').first()).toBeVisible();
  // Esperar que a página ASSENTE antes de sair dela. Os cartões aparecem
  // quando a leitura própria chega, que é uma corrida com a da cache — sair
  // no meio disso deixava a cache fria e o teste falhava conforme a carga da
  // máquina. A altura parar de mudar é o sinal, e é justamente a grandeza de
  // que este teste trata.
  await expect
    .poll(
      async () => {
        const a = await page.evaluate(() => document.documentElement.scrollHeight);
        await page.waitForTimeout(150);
        const b = await page.evaluate(() => document.documentElement.scrollHeight);
        return a === b ? b : -1;
      },
      { timeout: 10_000 },
    )
    .toBeGreaterThan(1200);
  await page.evaluate(() => window.scrollTo(0, 600));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(400);
  const antes = await page.evaluate(() => window.scrollY);

  // clica num cartão que já esteja à vista — senão o Playwright rola primeiro
  // e o que se mede passa a ser o teste, não a app
  const indice = await page.evaluate(() =>
    [...document.querySelectorAll('a[href^="/series/s-"]')].findIndex((e) => {
      const r = e.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= innerHeight;
    }),
  );
  expect(indice).toBeGreaterThanOrEqual(0);
  await page.locator('a[href^="/series/s-"]').nth(indice).click();
  await expect(page).toHaveURL(/\/series\/s-\d+$/);

  await page.getByRole("button", { name: "Voltar às séries" }).click();
  await expect(page).toHaveURL(/\/series$/);
  await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 5000 }).toBeGreaterThan(antes - 100);
});
