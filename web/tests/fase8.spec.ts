import { test, expect } from "./apoio/base";
import { semear } from "./apoio/semear";

/**
 * Ronda 14, Fase 8 — os restantes ecrãs herdam as primitivas da Mira. Estes
 * testes afirmam o que o ecrã FAZ (não cores nem tamanhos): as primitivas
 * novas não podem perder comportamento que os ecrãs antigos tinham.
 */

test("numa lista, tocar no ✗ do cartaz remove o item e não abre a série; anular repõe", async ({
  page,
  tmdb,
}) => {
  tmdb.tvmaze[495] = [1];
  await semear(page, {
    series: [{ uuid: "s-1", name: "Severance", tvmazeId: 495, numeracao: "tvmaze" }],
    listas: [{ id: "l-1", name: "Maratona", items: [{ kind: "show", refId: "s-1" }] }],
  });
  await page.goto("/listas/l-1");
  await expect(page.locator(`a[href="/series/s-1"]`)).toBeVisible();
  await page.getByRole("button", { name: "Remover Severance da lista" }).click();
  // ficou na lista (o botão está dentro da ligação do cartaz)
  await expect(page).toHaveURL(/\/listas\/l-1$/);
  await expect(page.getByText(/Sem itens ainda/)).toBeVisible();
  await page.getByTestId("undo-button").click();
  await expect(page.locator(`a[href="/series/s-1"]`)).toBeVisible();
});

test("«Juntar a uma lista» diz a cada linha se o filme já está lá (aria-checked)", async ({
  page,
}) => {
  await semear(page, {
    filmes: [{ key: "f-1", name: "Past Lives", watchedAt: null }],
    listas: [
      { id: "l-1", name: "Com ele", items: [{ kind: "movie", refId: "f-1" }] },
      { id: "l-2", name: "Sem ele", items: [] },
    ],
  });
  await page.goto("/movies/f-1");
  await page.getByRole("button", { name: "+ Lista" }).click();
  await expect(page.getByRole("menuitemcheckbox", { name: "Com ele" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  const sem = page.getByRole("menuitemcheckbox", { name: "Sem ele" });
  await expect(sem).toHaveAttribute("aria-checked", "false");
  await sem.click();
  await expect(sem).toHaveAttribute("aria-checked", "true");
});
