import { test, expect } from "./apoio/base";
import { semear } from "./apoio/semear";
import { serieCompleta } from "./apoio/tmdb";

/**
 * Ronda 12, Fase 5 — "decisão e palavras". A crítica da Fase 4 (AUDITORIA.md)
 * encontrou ecrãs que dizem o contrário do que é verdade, ou que decidem por
 * quem os usa. Cada teste aqui é um desses achados, visto a falhar antes da
 * correção.
 */

const HA_60_DIAS = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

function proximo(episode: number, lastWatchedAt: string | null) {
  return {
    episode: { season: 1, episode, name: `Episódio ${episode}`, airDate: "2020-01-01" },
    lastWatchedAt,
  };
}

// ── #1 · a pílula "10 em dia" ────────────────────────────────

test("a pílula da casa diz 'Pôr em dia', não 'em dia', e leva a um filtro com conteúdo", async ({
  page,
  tmdb,
}) => {
  // Uma série parada há 60 dias: nada em "Continuar", uma em "Retomar". Era
  // o caso da crítica — a pílula dizia "1 em dia" (o contrário: há um
  // episódio por ver) e abria em "Continuar 0 — nada para pôr em dia ✓".
  Object.assign(tmdb.series, serieCompleta(500, "Serie Parada", [5]).series);
  Object.assign(tmdb.episodios, serieCompleta(500, "Serie Parada", [5]).episodios);
  await semear(page, {
    series: [{ uuid: "s-parada", name: "Serie Parada", tmdbId: 500, numeracao: "tmdb" }],
    vistos: [{ showUuid: "s-parada", season: 1, episode: 1, watchedAt: HA_60_DIAS }],
    kv: { "nextup-cache": { "s-parada": proximo(2, HA_60_DIAS) } },
  });

  await page.goto("/series");
  const pilula = page.getByRole("link", { name: /Pôr em dia/ });
  await expect(pilula).toBeVisible();
  await expect(pilula).toContainText("1");
  await expect(page.getByText(/\d+ em dia/)).toHaveCount(0);

  await pilula.click();
  await expect(page).toHaveURL(/\/em-dia/);
  await expect(page.getByText("Serie Parada").first()).toBeVisible();
  await expect(page.getByText("Nada para pôr em dia aqui")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Retomar/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("um filtro vazio no Pôr em dia dá a saída, em vez de mandar procurar acima", async ({
  page,
}) => {
  await semear(page, {
    series: [{ uuid: "s-parada", name: "Serie Parada" }],
    vistos: [{ showUuid: "s-parada", season: 1, episode: 1, watchedAt: HA_60_DIAS }],
    kv: { "nextup-cache": { "s-parada": proximo(2, HA_60_DIAS) } },
  });

  await page.goto("/em-dia?filtro=continuar");
  await expect(page.getByText("Nada para pôr em dia aqui")).toBeVisible();
  await expect(page.getByText(/experimenta outro acima/)).toHaveCount(0);

  await page.getByRole("button", { name: "Ver Retomar · 1" }).click();
  await expect(page).toHaveURL(/filtro=retomar$/);
  await expect(page.getByText("Serie Parada").first()).toBeVisible();
});

test("marcar em 'Por começar' não salta a série seguinte", async ({ page }) => {
  // Marcar tira a série de "Por começar" (passa a ter 1 visto) ao mesmo
  // tempo que o cursor avança. Medido: hoje não salta nenhuma, porque a
  // lista não se recalcula a meio — o teste guarda isso, agora que o filtro
  // por omissão passa a depender do conteúdo.
  await semear(page, {
    series: [
      { uuid: "s-a", name: "Serie A" },
      { uuid: "s-b", name: "Serie B" },
      { uuid: "s-c", name: "Serie C" },
    ],
    kv: {
      "nextup-cache": {
        "s-a": proximo(1, null),
        "s-b": proximo(1, null),
        "s-c": proximo(1, null),
      },
    },
  });

  // Sem filtro no URL, abre no primeiro com conteúdo — é o caso de um amigo
  // que acabou de seguir três séries e toca na pílula.
  await page.goto("/em-dia");
  await expect(page.getByRole("button", { name: /^Por começar/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByText("1 de 3")).toBeVisible();

  // Cada decisão deixa o aviso de anular com o nome da série — é por aí que
  // se vê que as três passaram, uma de cada vez, sem nenhuma saltada.
  const decididas: string[] = [];
  const aviso = page.getByTestId("undo-toast");
  await page.getByRole("button", { name: "Marcar como visto" }).click();
  await expect(page.getByText("2 de 3")).toBeVisible();
  decididas.push((await aviso.textContent()) ?? "");
  await page.getByRole("button", { name: "Saltar — ainda não vi" }).click();
  await expect(page.getByText("3 de 3")).toBeVisible();
  decididas.push((await aviso.textContent()) ?? "");
  await page.getByRole("button", { name: "Saltar — ainda não vi" }).click();
  await expect(page.getByText("Passaste tudo em revista")).toBeVisible();
  decididas.push((await aviso.textContent()) ?? "");

  for (const nome of ["Serie A", "Serie B", "Serie C"])
    expect(decididas.some((t) => t.includes(nome))).toBe(true);
});
