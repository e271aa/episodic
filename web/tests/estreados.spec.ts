import { test, expect } from "./apoio/base";
import { semear } from "./apoio/semear";
import { estreadosTmdb, estreadosTvmaze, somaEstreados } from "../src/lib/estreados";

/**
 * Ronda 12, Fase 1 — o total contava episódios anunciados.
 *
 * `episodes.length` (TVmaze) e `number_of_episodes` (TMDB) contam o que ainda
 * não estreou. Uma série em dia passava a "10 por ver" no dia em que a
 * temporada seguinte era anunciada. Na Fase 0 afetava zero séries — é um
 * defeito à espera da próxima temporada anunciada.
 */

const HOJE = "2026-09-25";

test("regra: estreado é tudo até ao último episódio com data passada", () => {
  const c = estreadosTvmaze(
    [
      { season: 1, airdate: "2020-01-01" },
      // um episódio antigo sem data, no meio: estreou, claro — contá-lo como
      // por estrear abria um buraco onde não há
      { season: 1, airdate: "" },
      { season: 1, airdate: "2020-01-15" },
      { season: 2, airdate: "2026-09-01" },
      { season: 2, airdate: "2026-10-12" },
      { season: 3, airdate: null },
    ],
    HOJE,
  );
  expect(c.get(1)).toEqual({ listados: 3, estreados: 3 });
  expect(c.get(2)).toEqual({ listados: 2, estreados: 1 });
  expect(c.get(3)).toEqual({ listados: 1, estreados: 0 });
  expect(somaEstreados(c)).toBe(4);
});

test("regra TMDB: o último episódio emitido corta a contagem", () => {
  const temporadas = [
    { season_number: 0, episode_count: 5 },
    { season_number: 1, episode_count: 10 },
    { season_number: 2, episode_count: 8 },
    { season_number: 3, episode_count: 10 },
  ];
  const c = estreadosTmdb(temporadas, { season_number: 2, episode_number: 3 });
  expect([1, 2, 3].map((n) => c.get(n)?.estreados)).toEqual([10, 3, 0]);
  // as especiais não entram no total
  expect(somaEstreados(c)).toBe(13);
  // a TMDB não disse: não saber não pode apagar temporadas inteiras
  expect(somaEstreados(estreadosTmdb(temporadas, undefined))).toBe(28);
  // a TMDB disse que ainda não estreou nada
  expect(somaEstreados(estreadosTmdb(temporadas, null))).toBe(0);
});

test("uma série em dia não diz 'por ver' por causa de uma temporada anunciada", async ({
  page,
  tmdb,
}) => {
  const TVMAZE = 777;
  // T1 de 3, vista toda; T2 de 3, anunciada para 2099
  tmdb.tvmaze[TVMAZE] = [3, 3];
  tmdb.tvmazeFuturos[TVMAZE] = 3;
  await semear(page, {
    series: [
      {
        uuid: "s-1",
        name: "Serie Em Dia",
        tvmazeId: TVMAZE,
        // Com id da TMDB e campos preenchidos, o enriquecimento automático não
        // corre — e é ele que, sem isto, acertava o total por outro caminho.
        // O teste passava com a correção do total tirada (apanhado pelo guião
        // de mutações: sobreviveu).
        tmdbId: 9999,
        numeracao: "tvmaze",
        // o total antigo, com os anunciados lá dentro
        totalEpisodes: 6,
        status: "Running",
      },
    ],
    vistos: [1, 2, 3].map((episode) => ({ showUuid: "s-1", season: 1, episode })),
  });
  await page.goto("/series/s-1");

  // Âncora: a pastilha da T2 só existe depois de o fornecedor responder
  const t2 = page.getByTestId("season-2");
  await expect(t2).toHaveAttribute("aria-label", "Temporada 2, ainda não estreou");
  await expect(page.getByText("Em dia", { exact: true })).toBeVisible();
  await expect(page.getByText(/por ver/)).toHaveCount(0);

  // os anunciados vêem-se, com a data, mas não se marcam
  await t2.click();
  await expect(page.getByTestId("anunciado-2-1")).toContainText("estreia a");
  await expect(page.getByTestId("ep-2-1")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Marcar temporada como vista" })).toHaveCount(0);

  // e o total guardado — o que a Biblioteca lê — foi corrigido
  const total = await page.evaluate(
    () =>
      new Promise<number | null>((resolve) => {
        const pedido = indexedDB.open("tvlog", 4);
        pedido.onsuccess = () => {
          const g = pedido.result.transaction("shows").objectStore("shows").get("s-1");
          g.onsuccess = () => resolve(g.result.totalEpisodes);
        };
      }),
  );
  expect(total).toBe(3);
});
