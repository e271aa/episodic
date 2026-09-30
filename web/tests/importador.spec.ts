import { test, expect } from "./apoio/base";
import { ficheirosDoExport, UUID_A, UUID_B, UUID_C } from "./apoio/tvtime";

/**
 * O importador do TV Time — o caminho que corre **uma vez só**, com o
 * histórico todo de uma pessoa, e que até aqui não tinha um único teste.
 *
 * É testado de ponta a ponta (ficheiros → resumo → confirmar → biblioteca) e
 * não pelo parser isolado: o que interessa não é o parser devolver um objeto
 * certo, é a biblioteca ficar certa.
 */

async function importar(page: import("@playwright/test").Page) {
  await page.goto("/import");
  await page.getByTestId("file-input").setInputFiles(ficheirosDoExport());
  await expect(page.getByTestId("summary-shows")).toBeVisible();
}

/**
 * O painel do resumo entra com uma animação de 220ms (`page-enter`, que
 * desliza 6px). O botão de confirmar nasce abaixo da dobra, e o auto-scroll
 * do Playwright calha a meio dessa animação — recusa-se a clicar num elemento
 * "não estável" e espera até ao fim do teste. Não é defeito da app: num
 * telemóvel o toque funciona na mesma. Rolar primeiro resolve-o no teste, que
 * é onde o problema está.
 */
async function confirmar(page: import("@playwright/test").Page) {
  const botao = page.getByTestId("confirm-import");
  await botao.scrollIntoViewIfNeeded();
  await botao.click();
  await expect(page).toHaveURL(/\/series$/);
}

test("o resumo conta o que está no export, antes de gravar nada", async ({ page }) => {
  await importar(page);
  await expect(page.getByTestId("summary-shows")).toHaveText("3");
  // 6 linhas de episódio: 3 normais + 2 revisões + 1 órfã. O resumo conta
  // linhas; é o import que as colapsa.
  await expect(page.getByTestId("summary-episodes")).toHaveText("6");
  await expect(page.getByTestId("summary-movies")).toHaveText("2");
  await expect(page.getByTestId("summary-movies-towatch")).toHaveText("1");
  // e avisa do tipo de linha que ainda não sabe ler, em vez de o engolir
  await expect(page.getByText(/tipos de registo que ainda não interpretamos/)).toBeVisible();
});

test("importar deixa as séries com o estado certo e sem duplicados", async ({ page }) => {
  await importar(page);
  await confirmar(page);

  const guardado = await page.evaluate(
    () =>
      new Promise<{ shows: Record<string, unknown>[]; watched: Record<string, unknown>[] }>(
        (res) => {
          const p = indexedDB.open("flicki", 4);
          p.onsuccess = () => {
            const d = p.result;
            const tx = d.transaction(["shows", "watched"]);
            const s = tx.objectStore("shows").getAll();
            const w = tx.objectStore("watched").getAll();
            tx.oncomplete = () => {
              d.close();
              res({ shows: s.result, watched: w.result });
            };
          };
        },
      ),
  );

  expect(guardado.shows).toHaveLength(3);
  const porUuid = new Map(guardado.shows.map((s) => [s.uuid as string, s]));
  expect(porUuid.get(UUID_A)).toMatchObject({ followed: true, name: "Serie Seguida", tvdbId: 111111 });
  expect(porUuid.get(UUID_B)).toMatchObject({ inWatchlist: true });
  expect(porUuid.get(UUID_C)).toMatchObject({ archived: true });

  // 6 linhas → 4 episódios: as revisões colapsam com os vistos originais, e o
  // órfão vai para a série homónima em vez de criar uma cópia fantasma.
  expect(guardado.watched).toHaveLength(4);
  expect(guardado.watched.every((w) => w.showUuid === UUID_A)).toBe(true);
  expect(new Set(guardado.watched.map((w) => `${w.season}:${w.episode}`))).toEqual(
    new Set(["1:1", "1:2", "1:3", "2:1"]),
  );
});

test("a data exata do check-in vence a data do registo em massa", async ({ page }) => {
  await importar(page);
  await confirmar(page);

  const eps = await page.evaluate(
    () =>
      new Promise<Record<string, unknown>[]>((res) => {
        const p = indexedDB.open("flicki", 4);
        p.onsuccess = () => {
          const d = p.result;
          const r = d.transaction("watched").objectStore("watched").getAll();
          r.onsuccess = () => {
            d.close();
            res(r.result);
          };
        };
      }),
  );
  const porChave = new Map(eps.map((e) => [`${e.season}:${e.episode}`, e]));

  // Uma revisão MAIS RECENTE ganha ao visto original — é o que responde a
  // "quando vi isto pela última vez".
  expect(porChave.get("1:1")).toMatchObject({ dateIsExact: true });
  expect(porChave.get("1:1")!.watchedAt).toBe(new Date(1700000000 * 1000).toISOString());
  // Mas uma revisão mais ANTIGA não ganha só por vir depois no ficheiro. A
  // ordem das linhas do CSV não é garantida, e antes disto decidia o
  // resultado: o mesmo export dava respostas diferentes.
  expect(porChave.get("1:2")!.watchedAt).toBe(new Date(1615086400 * 1000).toISOString());
  // sem `gsi`, fica a data de criação da linha — e diz que não é exata
  expect(porChave.get("1:3")).toMatchObject({ dateIsExact: false });
  expect(porChave.get("1:3")!.watchedAt).toBe("2021-03-10T21:15:00.000Z");
  // o id TheTVDB do episódio é guardado: é a única chave estável entre sistemas
  expect(porChave.get("1:1")).toMatchObject({ episodeTvdbId: 5001 });
});

test("os filmes vêm do ficheiro v1, com a data e a estreia", async ({ page }) => {
  await importar(page);
  await confirmar(page);

  const filmes = await page.evaluate(
    () =>
      new Promise<Record<string, unknown>[]>((res) => {
        const p = indexedDB.open("flicki", 4);
        p.onsuccess = () => {
          const d = p.result;
          const r = d.transaction("movies").objectStore("movies").getAll();
          r.onsuccess = () => {
            d.close();
            res(r.result);
          };
        };
      }),
  );
  const porNome = new Map(filmes.map((m) => [m.name as string, m]));

  expect(porNome.get("Filme Visto Um")).toMatchObject({
    watchedAt: "2023-07-04T19:30:00.000Z",
    releaseDate: "2016-11-04",
  });
  expect(porNome.get("Filme Visto Dois")).toBeTruthy();
  // as linhas de ruído do v1 não podem virar filmes
  expect(porNome.has("Filme Seguido")).toBe(false);
});

test("um filme marcado 'para ver' no TV Time chega cá como 'para ver'", async ({ page }) => {
  // Medido no export real do Ruben: 22 linhas `towatch`, 21 de filmes que ele
  // nunca viu. O parser só olhava para `type=watch` e deitava-os fora — 21
  // filmes que ele escolheu a dizer "quero ver isto" desapareciam no import,
  // numa app que tem "Para ver" para filmes desde a Fase L.
  await importar(page);
  await confirmar(page);

  await page.goto("/library?tipo=filmes&filtro=para-ver");
  await expect(page.getByText("Filme Para Ver").first()).toBeVisible();
});
