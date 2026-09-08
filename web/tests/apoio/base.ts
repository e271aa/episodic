import { test as base, expect } from "@playwright/test";
import { catalogoVazio, interceptarTmdb, type Catalogo } from "./tmdb";

/**
 * O `test` que todos os ficheiros usam: já vem com a TMDB falsa montada, em
 * todos os testes (`auto`), mesmo nos que não lhe mexem. Um ecrã qualquer da
 * app pode pedir metadados em segundo plano — sem isto, esses pedidos iam à
 * Internet a sério e o teste passava a depender da rede.
 */
export const test = base.extend<{ tmdb: Catalogo }>({
  tmdb: [
    async ({ page }, use) => {
      const catalogo = catalogoVazio();
      await interceptarTmdb(page, catalogo);
      await use(catalogo);
    },
    { auto: true },
  ],
});

export { expect };
