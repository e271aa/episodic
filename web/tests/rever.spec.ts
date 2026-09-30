import { test, expect } from "./apoio/base";
import { semear, type EpisodioVisto, type SerieSemeada } from "./apoio/semear";

/**
 * Ronda 12, Fase 1 — "séries que tenho os episódios todos vistos e na app
 * diz que não; quero rever contigo passo a passo".
 *
 * Na Fase 0, 17 das 74 séries estavam atrás do que já estreou, e a app não
 * tem forma de saber quais foram vistas. O ecrã pergunta, uma de cada vez;
 * cada resposta faz uma coisa só e anula-se.
 */

type Pagina = import("@playwright/test").Page;

function serie(uuid: string, name: string, tvmazeId: number, extra: Partial<SerieSemeada> = {}) {
  return { uuid, name, tvmazeId, numeracao: "tvmaze" as const, ...extra };
}
function vistos(uuid: string, pares: [number, number][]): EpisodioVisto[] {
  return pares.map(([season, episode]) => ({ showUuid: uuid, season, episode }));
}

async function lerVistos(page: Pagina, uuid: string) {
  return page.evaluate(
    (id) =>
      new Promise<{ season: number; episode: number; dateIsExact: boolean }[]>((resolve) => {
        const pedido = indexedDB.open("flicki", 4);
        pedido.onsuccess = () => {
          const q = pedido.result
            .transaction("watched")
            .objectStore("watched")
            .index("by-show")
            .getAll(id);
          q.onsuccess = () => resolve(q.result);
        };
      }),
    uuid,
  );
}

async function semearBiblioteca(page: Pagina, tmdb: { tvmaze: Record<number, number[]> }) {
  tmdb.tvmaze[801] = [2, 2];
  tmdb.tvmaze[802] = [2, 2];
  tmdb.tvmaze[803] = [3];
  tmdb.tvmaze[804] = [2];
  tmdb.tvmaze[805] = [2];
  tmdb.tvmaze[806] = [2, 2, 2];
  await semear(page, {
    series: [
      serie("s-buracos", "Tem Buracos", 801),
      serie("s-fronteira", "Parou Na Fronteira", 802),
      serie("s-meio", "A Meio", 803),
      serie("s-arquivada", "Arquivada", 804, { archived: true }),
      serie("s-completa", "Completa", 805),
      serie("s-mista", "Buracos E Frente", 806),
    ],
    vistos: [
      ...vistos("s-buracos", [[2, 1], [2, 2]]),
      ...vistos("s-fronteira", [[1, 1], [1, 2]]),
      ...vistos("s-meio", [[1, 1]]),
      ...vistos("s-arquivada", [[1, 1]]),
      ...vistos("s-completa", [[1, 1], [1, 2]]),
      ...vistos("s-mista", [[2, 1], [2, 2]]),
    ],
  });
}

test("pergunta só pelo que está atrás do que estreou, pela ordem mais fácil", async ({
  page,
  tmdb,
}) => {
  await semearBiblioteca(page, tmdb);
  await page.goto("/profile/definicoes");
  await page.getByRole("link", { name: /Rever a biblioteca/ }).click();
  await expect(page).toHaveURL(/\/rever$/);

  // 4 séries: nem a arquivada nem a completa entram
  const cartao = page.getByTestId("rever-cartao");
  await expect(cartao).toContainText("1 de 4");
  // primeiro as com buracos para trás
  await expect(cartao).toContainText("Buracos E Frente");
  await expect(page.getByTestId("rever-porque")).toContainText(
    "Tens 2 episódios por marcar antes do último que viste",
  );
});

test("com buracos para trás e episódios à frente, 'só os de trás' não diz mais do que sabes", async ({
  page,
  tmdb,
}) => {
  await semearBiblioteca(page, tmdb);
  await page.goto("/rever");
  await expect(page.getByTestId("rever-cartao")).toContainText("Buracos E Frente");

  await page.getByRole("button", { name: "Marcar os 2 de trás" }).click();
  await expect(page.getByTestId("rever-cartao")).toContainText("2 de 4");

  const marcados = await lerVistos(page, "s-mista");
  const chaves = marcados.map((m) => `${m.season}:${m.episode}`).sort();
  // a T1 (para trás) entrou; a T3 (à frente) não
  expect(chaves).toEqual(["1:1", "1:2", "2:1", "2:2"]);
  // e sem data certa — sabes que os viste, não quando
  expect(marcados.filter((m) => m.season === 1).every((m) => m.dateIsExact === false)).toBe(true);
});

test("as três respostas fazem o que dizem, e tudo se anula", async ({ page, tmdb }) => {
  await semearBiblioteca(page, tmdb);
  await page.goto("/rever");
  const cartao = page.getByTestId("rever-cartao");

  await expect(cartao).toContainText("Buracos E Frente");
  await page.getByRole("button", { name: "Decidir depois" }).click();

  // Vi tudo
  await expect(cartao).toContainText("Tem Buracos");
  await page.getByRole("button", { name: "Marcar os 2" }).click();
  await expect(cartao).toContainText("Parou Na Fronteira");
  expect(await lerVistos(page, "s-buracos")).toHaveLength(4);

  // anular volta a esse cartão e desfaz a marcação
  await page.getByRole("button", { name: "Anular" }).click();
  await expect(cartao).toContainText("Tem Buracos");
  expect(await lerVistos(page, "s-buracos")).toHaveLength(2);
  await page.getByRole("button", { name: "Marcar os 2" }).click();

  // Deixei de ver
  await expect(cartao).toContainText("Parou Na Fronteira");
  await expect(page.getByTestId("rever-porque")).toHaveText(
    "Paraste no fim da T1. Viste o que veio a seguir?",
  );
  await page.getByRole("button", { name: "Deixei de ver — arquivar" }).click();

  // Ainda estou a ver
  await expect(cartao).toContainText("A Meio");
  await page.getByRole("button", { name: "Ainda estou a ver" }).click();

  await expect(page.getByTestId("rever-fim")).toContainText("3 séries arrumadas · 1 ficaram para depois");

  // Voltar mais tarde: só aparece a que ficou para depois. A arquivada e a
  // "ainda estou a ver" não voltam a ser perguntadas; a do "vi tudo" já não
  // está atrás de nada.
  await page.goto("/rever");
  await expect(page.getByTestId("rever-cartao")).toContainText("1 de 1");
  await expect(page.getByTestId("rever-cartao")).toContainText("Buracos E Frente");
});

/** Preenchido = a cápsula da ação, opaca; a secundária é `fill`, translúcida. */
async function preenchido(botao: import("@playwright/test").Locator) {
  return botao.evaluate((b) => {
    const cor = getComputedStyle(b).backgroundColor;
    const alfa = cor.startsWith("rgba") ? parseFloat(cor.split(",")[3]) : cor === "transparent" ? 0 : 1;
    return alfa > 0.9;
  });
}

test("a ação recomendada só marca o que a prova cobre", async ({ page, tmdb }) => {
  // Ronda 12, Fase 4: o botão preenchido era "Vi tudo · marca os 35" quando
  // a prova (os buracos para trás) cobria 7 — os outros 28 eram uma
  // temporada inteira por começar. A app decidia em vez de propor.
  await semearBiblioteca(page, tmdb);
  await page.goto("/rever");
  const cartao = page.getByTestId("rever-cartao");

  // Buracos para trás E episódios à frente: recomenda só os de trás, e o
  // "vi tudo" diz o que junta de mais
  await expect(cartao).toContainText("Buracos E Frente");
  const deTras = cartao.getByRole("button", { name: "Marcar os 2 de trás" });
  const viTudo = cartao.getByRole("button", { name: /^Vi tudo/ });
  expect(await preenchido(deTras)).toBe(true);
  await expect(viTudo).toContainText("também os 2 da T3");
  expect(await preenchido(viTudo)).toBe(false);

  // Todos os que faltam estão para trás: a prova cobre tudo, uma ação só
  await page.getByRole("button", { name: "Decidir depois" }).click();
  await expect(cartao).toContainText("Tem Buracos");
  expect(await preenchido(cartao.getByRole("button", { name: "Marcar os 2" }))).toBe(true);
  await expect(cartao.getByRole("button", { name: /^Vi tudo/ })).toHaveCount(0);

  // Parou no fim de uma temporada: não há prova nenhuma — é uma pergunta,
  // e nenhuma resposta vem recomendada
  await page.getByRole("button", { name: "Marcar os 2" }).click();
  await expect(cartao).toContainText("Parou Na Fronteira");
  for (const b of await cartao.getByRole("button").all()) expect(await preenchido(b)).toBe(false);

  // Cinco saídas eram de mais: arquivar e adiar ficam fora da pilha de
  // botões. Desde a 5d, "Decidir depois" vive junto do contador (é passar à
  // seguinte) e "Deixei de ver" numa linha discreta por baixo — nenhum dos
  // dois é um botão da largura do cartão.
  const larguraCartao = (await cartao.boundingBox())!.width;
  for (const nome of ["Deixei de ver — arquivar", "Decidir depois"]) {
    const caixa = (await page.getByRole("button", { name: nome }).boundingBox())!;
    expect(caixa.width).toBeLessThan(larguraCartao * 0.75);
  }
  const contador = (await cartao.getByText(/^\d+ de \d+$/).boundingBox())!;
  const depois = (await page.getByRole("button", { name: "Decidir depois" }).boundingBox())!;
  expect(Math.abs(depois.y + depois.height / 2 - (contador.y + contador.height / 2))).toBeLessThan(4);
});

test("a linha do cartão usa o glossário: 'por marcar' é o de trás, 'por ver' o da frente", async ({
  page,
  tmdb,
}) => {
  // Ronda 12, 5c — P1 #4 da crítica 5b.4: dizia "por marcar: 35 · T2 e T4"
  // quando 28 desses eram a T4 inteira, à frente do último visto — por ver.
  await semearBiblioteca(page, tmdb);
  await page.goto("/rever");
  const cartao = page.getByTestId("rever-cartao");
  await expect(cartao).toContainText("Buracos E Frente");
  await expect(cartao).toContainText("2 por marcar · T1");
  await expect(cartao).toContainText("2 por ver · T3");

  // e uma série parada a meio, sem nada para trás, não tem nada "por marcar"
  for (let i = 0; i < 4; i++) {
    if ((await cartao.textContent())?.includes("A Meio")) break;
    await page.getByRole("button", { name: "Decidir depois" }).click();
  }
  await expect(cartao).toContainText("A Meio");
  await expect(cartao).toContainText("2 por ver · T1");
  await expect(cartao).not.toContainText("por marcar");
});

test("as contagens em mono, as palavras não: «2 por marcar · T1»", async ({ page, tmdb }) => {
  // Fase 12: as linhas do cartão eram frases inteiras em mono espaçado
  await semearBiblioteca(page, tmdb);
  await page.goto("/rever");
  const linha = page.getByText(/por marcar ·/).first();
  await expect(linha).toBeVisible();
  expect(await linha.evaluate((el) => /mono|menlo/i.test(getComputedStyle(el).fontFamily))).toBe(false);
});
