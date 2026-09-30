import { test, expect } from "./apoio/base";
import { semear, type EpisodioVisto } from "./apoio/semear";

/**
 * Ronda 12, Fase 2 — o portão antes do nome novo, no browser.
 *
 * Duas coisas que os testes de `nuvem.spec.ts` não podem ver sem IndexedDB:
 * a numeração perdida volta sozinha, e as mudanças que não subiam para a
 * cloud (séries, listas) passam a entrar na fila.
 */

type Pagina = import("@playwright/test").Page;

function lerStore<T>(page: Pagina, store: "shows" | "outbox" | "kv", chave?: string) {
  return page.evaluate(
    ({ nome, k }) =>
      new Promise<T>((resolve) => {
        const pedido = indexedDB.open("tvlog", 4);
        pedido.onsuccess = () => {
          const os = pedido.result.transaction(nome).objectStore(nome);
          const q = k ? os.get(k) : os.getAll();
          q.onsuccess = () => resolve(q.result as T);
        };
      }),
    { nome: store, k: chave },
  );
}

function temporadasTmdb(tamanhos: number[]) {
  return tamanhos.map((n, i) => ({
    season_number: i + 1,
    episode_count: n,
    name: `Season ${i + 1}`,
    poster_path: null,
  }));
}

test("uma série que perdeu a numeração recupera-a pela divisão em que as marcações encaixam", async ({
  page,
  tmdb,
}) => {
  // As divisões reais do Naruto, medidas nas duas APIs
  const TVMAZE = [13, 51, 51, 50, 50, 5];
  tmdb.tvmaze[505] = TVMAZE;
  tmdb.series[46260] = {
    id: 46260,
    name: "Naruto",
    poster_path: null,
    backdrop_path: null,
    overview: "",
    status: "Ended",
    number_of_episodes: 220,
    number_of_seasons: 4,
    episode_run_time: [],
    seasons: temporadasTmdb([52, 52, 54, 62]),
  };
  // E uma série em que as duas divisões são iguais — aqui não há nada a decidir
  tmdb.tvmaze[606] = [3, 3];
  tmdb.series[6060] = {
    id: 6060,
    name: "Igual Nos Dois",
    poster_path: null,
    backdrop_path: null,
    overview: "",
    status: "Ended",
    number_of_episodes: 6,
    number_of_seasons: 2,
    episode_run_time: [],
    seasons: temporadasTmdb([3, 3]),
  };
  const naruto: EpisodioVisto[] = TVMAZE.flatMap((n, i) =>
    Array.from({ length: n }, (_, e) => ({ showUuid: "s-naruto", season: i + 1, episode: e + 1 })),
  );
  await semear(page, {
    series: [
      // exatamente como ficava depois de um "Sincronizar agora" antigo: com
      // os dois ids e SEM numeração
      { uuid: "s-naruto", name: "Naruto", tvmazeId: 505, tmdbId: 46260, totalEpisodes: 220 },
      { uuid: "s-igual", name: "Igual Nos Dois", tvmazeId: 606, tmdbId: 6060, totalEpisodes: 6 },
    ],
    vistos: [
      ...naruto,
      { showUuid: "s-igual", season: 1, episode: 1 },
    ],
  });
  await page.goto("/library");

  await expect
    .poll(async () => (await lerStore<{ numeracao?: string }>(page, "shows", "s-naruto"))?.numeracao)
    .toBe("tvmaze");
  // a outra fica como estava, e não se volta a perguntar por ela
  await expect
    .poll(async () => await lerStore<string[] | undefined>(page, "kv", "numeracao:indecisas"))
    .toContain("s-igual");
  expect((await lerStore<{ numeracao?: string }>(page, "shows", "s-igual"))?.numeracao).toBeUndefined();

  // e o ecrã lê pela divisão certa: 6 temporadas, a última completa
  await page.goto("/series/s-naruto");
  await expect(page.getByTestId("season-6")).toHaveAttribute(
    "aria-label",
    "Temporada 6, 5 de 5 vistos",
  );
});

test("arquivar uma série e mexer numa lista entram na fila da cloud", async ({ page, tmdb }) => {
  tmdb.tvmaze[801] = [2];
  await semear(page, {
    series: [{ uuid: "s-1", name: "Serie Um", tvmazeId: 801, numeracao: "tvmaze" }],
    vistos: [{ showUuid: "s-1", season: 1, episode: 1 }],
    listas: [{ id: "l-1", name: "A minha lista", items: [{ kind: "show", refId: "s-1" }] }],
  });

  // arquivar, pelo "Rever a biblioteca" — só subia com "Sincronizar agora"
  await page.goto("/rever");
  await page.getByRole("button", { name: "Deixei de ver — arquivar" }).click();
  await expect(page.getByTestId("rever-fim")).toBeVisible();

  // uma lista — não havia sequer tabela na cloud para elas
  await page.goto("/listas/l-1");
  await page.getByRole("button", { name: /Remover/ }).first().click();
  await expect(page.getByText("Removido da lista")).toBeVisible();

  const fila = await lerStore<{ key: string; kind: string }[]>(page, "outbox");
  const porChave = Object.fromEntries(fila.map((o) => [o.key, o.kind]));
  expect(porChave["show:s-1"]).toBe("show-upserted");
  expect(porChave["kv:listas"]).toBe("kv-upserted");
});

test("com a numeração em dúvida, a verificação nunca oferece apagar marcações", async ({
  page,
  tmdb,
}) => {
  // TVmaze 3·3·3, TMDB 3·3 — e tudo visto. Lida pela regra antiga (TMDB), a
  // T3 fica "a mais" e o resto "completo": a verificação chamava a isto
  // seguro e oferecia apagar 3 episódios que foram mesmo vistos.
  tmdb.tvmaze[707] = [3, 3, 3];
  tmdb.series[7070] = {
    id: 7070,
    name: "Tres Temporadas",
    poster_path: null,
    backdrop_path: null,
    overview: "",
    status: "Ended",
    number_of_episodes: 6,
    number_of_seasons: 2,
    episode_run_time: [],
    seasons: temporadasTmdb([3, 3]),
  };
  await semear(page, {
    series: [{ uuid: "s-3", name: "Tres Temporadas", tvmazeId: 707, tmdbId: 7070, totalEpisodes: 9 }],
    vistos: [1, 2, 3].flatMap((t) =>
      [1, 2, 3].map((episode) => ({ showUuid: "s-3", season: t, episode })),
    ),
  });
  await page.goto("/profile/definicoes");
  await page.getByRole("button", { name: /Verificar biblioteca/ }).click();

  // Âncora: o relatório acabou
  await expect(page.getByText(/Nada a corrigir em \d+ séries/)).toBeVisible();
  await expect(page.getByText(/marcações a mais/)).toHaveCount(0);
});
