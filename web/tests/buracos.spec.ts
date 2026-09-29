import { test, expect } from "./apoio/base";
import { semear } from "./apoio/semear";

/**
 * Fase 1 da Ronda 11 — a app deixa de chamar "por ver" ao que já foi visto.
 *
 * Medido na biblioteca do Ruben: 37 episódios por marcar têm outros vistos
 * DEPOIS deles, 22 só no Naruto (T2 sem os episódios 20–41, com as T3/T4/T5
 * inteiras). Ninguém vê a 5ª temporada antes de acabar a 2ª.
 *
 * O teste que mais importa aqui é o **negativo**: quem está a meio de uma
 * série não pode ser acusado de se ter esquecido de marcar.
 */

const TVMAZE = 495;

/** Séries com `[13, 51]` temporadas, vendo tudo menos `saltar`. */
async function serieCom(
  page: import("@playwright/test").Page,
  tmdb: { tvmaze: Record<number, number[]> },
  temporadas: number[],
  saltar: { temporada: number; de: number; ate: number }[],
) {
  tmdb.tvmaze[TVMAZE] = temporadas;
  const vistos: { showUuid: string; season: number; episode: number }[] = [];
  temporadas.forEach((n, i) => {
    for (let e = 1; e <= n; e++) {
      const fora = saltar.some((s) => s.temporada === i + 1 && e >= s.de && e <= s.ate);
      if (!fora) vistos.push({ showUuid: "s-1", season: i + 1, episode: e });
    }
  });
  await semear(page, {
    series: [
      {
        uuid: "s-1",
        name: "Serie Longa",
        tvmazeId: TVMAZE,
        numeracao: "tvmaze",
        totalEpisodes: temporadas.reduce((a, b) => a + b, 0),
      },
    ],
    vistos,
  });
  await page.goto("/series/s-1");
}

test("um buraco no meio é apontado, e diz onde está", async ({ page, tmdb }) => {
  // o caso do Naruto, à escala: T2 sem os 20–41, T3 inteira
  await serieCom(page, tmdb, [13, 51, 51], [{ temporada: 2, de: 20, ate: 41 }]);

  const aviso = page.getByTestId("aviso-buracos");
  await expect(aviso).toBeVisible();
  await expect(aviso).toContainText("Viste os 22 que ficaram para trás?");
  await expect(aviso).toContainText("T2: 22");
  // e o herói deixa de lhes chamar "por ver"
  await expect(page.getByText("22 por marcar")).toBeVisible();
  await expect(page.getByText("22 por ver")).toHaveCount(0);
});

test("quem está a meio de uma série NÃO é acusado de se ter esquecido", async ({
  page,
  tmdb,
}) => {
  // viu a T1 inteira e metade da T2 — não há nada por marcar atrás dele.
  // Confundir isto com esquecimento seria pior do que o problema original.
  await serieCom(page, tmdb, [13, 51], [{ temporada: 2, de: 26, ate: 51 }]);

  // Âncora primeiro: só depois de as temporadas do fornecedor chegarem é que
  // a ausência do aviso quer dizer alguma coisa. Sem isto, o `toHaveCount(0)`
  // passava de imediato — e passava na mesma com a inferência partida, que é
  // exatamente o que este teste existe para apanhar. Apanhado ao vê-lo
  // "passar" com o bug reposto.
  await expect(page.getByTestId("season-2")).toHaveAttribute(
    "aria-label",
    /Temporada 2, 25 de 51 vistos/,
  );

  await expect(page.getByTestId("aviso-buracos")).toHaveCount(0);
  await expect(page.locator("h1 + p")).toContainText("vistos");
  await expect(page.getByText(/por marcar/)).toHaveCount(0);
});

test("um toque marca exatamente os buracos, e dá para anular", async ({ page, tmdb }) => {
  await serieCom(page, tmdb, [13, 51, 51], [{ temporada: 2, de: 20, ate: 41 }]);

  await page.getByTestId("marcar-buracos").click();
  await expect(page.getByTestId("aviso-buracos")).toHaveCount(0);
  await expect(page.getByTestId("season-2")).toHaveAttribute(
    "aria-label",
    /51 de 51 vistos/,
  );

  await page.getByRole("button", { name: "Anular" }).click();
  await expect(page.getByTestId("aviso-buracos")).toBeVisible();
  await expect(page.getByTestId("season-2")).toHaveAttribute(
    "aria-label",
    /29 de 51 vistos/,
  );
});

test("a pastilha da temporada distingue buraco de 'falta no fim'", async ({ page, tmdb }) => {
  // T2 com buraco no meio; T3 por ver de todo, a seguir ao ponto onde ficou
  await serieCom(page, tmdb, [13, 51, 51], [
    { temporada: 2, de: 20, ate: 41 },
    { temporada: 3, de: 30, ate: 51 },
  ]);

  // `29/51` servia para os dois casos; o nome acessível passa a separá-los,
  // porque a cor do ponto sozinha não é informação
  await expect(page.getByTestId("season-2")).toHaveAttribute(
    "aria-label",
    /com episódios por marcar mais atrás/,
  );
  await expect(page.getByTestId("season-3")).toHaveAttribute(
    "aria-label",
    /^Temporada 3, 29 de 51 vistos$/,
  );
});
