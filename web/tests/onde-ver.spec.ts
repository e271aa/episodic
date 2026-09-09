import { test, expect } from "./apoio/base";
import { semear } from "./apoio/semear";
import { serieCompleta } from "./apoio/tmdb";

/**
 * "Onde ver" e a numeração que não pode mudar em silêncio.
 *
 * O sintoma era o "Onde ver" a jurar que **nenhuma** série estava em lado
 * nenhum em Portugal. Medido na biblioteca real: 69 das 74 séries não tinham
 * id do TMDB (vieram todas da TVmaze), e sem esse id não há pergunta a fazer
 * — mas a app respondia "sem serviços", que é uma afirmação, não um "não
 * sei".
 *
 * A correção obriga a guardar o id do TMDB em séries numeradas pela TVmaze, e
 * é aí que mora o perigo: o `getSeasons` preferia o TMDB assim que houvesse
 * id, e a série era reparticionada por efeito secundário. Os dois primeiros
 * testes existem por causa disso.
 */

/** Duas temporadas de 3 na TVmaze; uma só de 6 no TMDB. Os mesmos 6 episódios. */
const TVMAZE_ID = 700;
const TMDB_ID = 900;

test("uma série numerada pela TVmaze não é reparticionada por ganhar id do TMDB", async ({
  page,
  tmdb,
}) => {
  tmdb.tvmaze[TVMAZE_ID] = [3, 3];
  Object.assign(tmdb.series, serieCompleta(TMDB_ID, "Serie Dupla", [6]).series);
  Object.assign(tmdb.episodios, serieCompleta(TMDB_ID, "Serie Dupla", [6]).episodios);

  await semear(page, {
    series: [
      {
        uuid: "s-tvmaze",
        name: "Serie Dupla",
        // como o backfill a deixa depois desta correção: ganhou o id do TMDB
        // (para o "Onde ver") mas continua numerada pela TVmaze
        tmdbId: TMDB_ID,
        tvmazeId: TVMAZE_ID,
        numeracao: "tvmaze",
        totalEpisodes: 6,
      },
    ],
  });
  await page.goto("/series/s-tvmaze");

  // duas temporadas, as da TVmaze — não a única do TMDB
  await expect(page.getByTestId("season-1")).toBeVisible();
  await expect(page.getByTestId("season-2")).toBeVisible();
  await expect(page.getByTestId("season-3")).toHaveCount(0);
});

test("sem `numeracao` declarada, quem manda continua a ser o TMDB", async ({ page, tmdb }) => {
  // A regra antiga, para as séries guardadas antes de o campo existir: é a
  // numeração com que os episódios delas já foram marcados, e mudá-la agora
  // seria pior do que mantê-la.
  tmdb.tvmaze[TVMAZE_ID] = [3, 3];
  const { series, episodios } = serieCompleta(TMDB_ID, "Serie Antiga", [6]);
  Object.assign(tmdb.series, series);
  Object.assign(tmdb.episodios, episodios);

  await semear(page, {
    series: [
      {
        uuid: "s-antiga",
        name: "Serie Antiga",
        tmdbId: TMDB_ID,
        tvmazeId: TVMAZE_ID,
        totalEpisodes: 6,
      },
    ],
  });
  await page.goto("/series/s-antiga");

  await expect(page.getByTestId("season-1")).toBeVisible();
  await expect(page.getByTestId("season-2")).toHaveCount(0);
});

test("com id do TMDB, o 'Onde ver' mostra os serviços portugueses", async ({ page, tmdb }) => {
  const { series, episodios } = serieCompleta(TMDB_ID, "Serie Com Id", [2]);
  Object.assign(tmdb.series, series);
  Object.assign(tmdb.episodios, episodios);
  tmdb.ondeVer[`tv:${TMDB_ID}`] = ["Disney Plus", "HBO Max"];

  await semear(page, {
    series: [{ uuid: "s-com", name: "Serie Com Id", tmdbId: TMDB_ID, totalEpisodes: 2 }],
  });
  await page.goto("/series/s-com");

  await page.getByRole("button", { name: "Onde ver" }).click();
  await expect(page.locator('a[title="Disney Plus"]')).toBeVisible();
  await expect(page.locator('a[title="HBO Max"]')).toBeVisible();
});

test("sem id do TMDB, o 'Onde ver' admite que não sabe em vez de dizer que não há", async ({
  page,
  tmdb,
}) => {
  tmdb.tvmaze[TVMAZE_ID] = [2];

  await semear(page, {
    series: [
      { uuid: "s-sem", name: "Serie Sem Id", tvmazeId: TVMAZE_ID, totalEpisodes: 2 },
    ],
  });
  await page.goto("/series/s-sem");

  await page.getByRole("button", { name: "Onde ver" }).click();
  await expect(page.getByText("Ainda não identifiquei esta série")).toBeVisible();
  // A frase antiga era uma afirmação sobre Portugal que a app não tinha como
  // fazer — e era a que 69 de 74 séries mostravam.
  await expect(page.getByText("Sem serviços de streaming em Portugal")).toHaveCount(0);
});

test("abrir a série resolve o id na hora — sem esperar por uma passagem noutro ecrã", async ({
  page,
  tmdb,
}) => {
  // Como o Formula 1 está na biblioteca do Ruben: a TVmaze deu-lhe capa,
  // sinopse, estado, estreia e géneros — tudo menos o id do TMDB. O portão
  // antigo do enriquecimento só olhava para estado/estreia/géneros, e como
  // estavam preenchidos nunca disparava. A série ficava à espera do backfill
  // da Biblioteca, num ecrã onde ele nem sequer estava.
  const TVDB = 359913;
  const TMDB = 87083;
  tmdb.tvmaze[41074] = [10, 10];
  tmdb.porTvdb[TVDB] = TMDB;
  const { series, episodios } = serieCompleta(TMDB, "Formula 1", [20]);
  Object.assign(tmdb.series, series);
  Object.assign(tmdb.episodios, episodios);
  tmdb.ondeVer[`tv:${TMDB}`] = ["Netflix"];

  await semear(page, {
    series: [
      {
        uuid: "s-f1",
        name: "Formula 1",
        tvdbId: TVDB,
        tvmazeId: 41074,
        totalEpisodes: 20,
        status: "Running",
      },
    ],
  });
  await page.goto("/series/s-f1");

  await page.getByRole("button", { name: "Onde ver" }).click();
  await expect(page.locator('a[title="Netflix"]')).toBeVisible();

  // E o id novo não pode ter mudado a numeração: continua a mandar a TVmaze,
  // que dá duas temporadas — o TMDB dá uma só de 20.
  await expect(page.getByTestId("season-2")).toBeVisible();
  await expect(page.getByTestId("season-3")).toHaveCount(0);
});
