import { test, expect } from "./apoio/base";
import { semear } from "./apoio/semear";
import { serieCompleta } from "./apoio/tmdb";

/**
 * Ronda 12, Fase 5b.2 — achados #14 e #11 (AUDITORIA.md, Fase 4).
 *
 * #14: seis sítios num degrau de 17px por documentar, oito a 10px (abaixo
 * do piso do Código, 11–13px), e o título do herói a 40px quando o DESIGN
 * diz 36 — tudo por encaixar na rampa já escrita.
 *
 * #11: os `text-[Npx]` são absolutos — não respondem ao tamanho de letra
 * que a pessoa escolheu no telemóvel ou no browser. Medido antes: com a
 * raiz a 150%, só 32–60% dos textos crescem. `rem` responde à raiz; `px`
 * nunca. A troca é puramente aritmética (N ÷ 16), por isso o valor a 16px
 * de raiz (o que o Ruben já tem hoje) fica exatamente igual ao de antes —
 * é essa igualdade que prova que a letra MENOR do Ruben não muda.
 */

test("o título do herói usa os 36px do Display, não os 40px da v1", async ({
  page,
  tmdb,
}) => {
  Object.assign(tmdb.series, serieCompleta(500, "Serie Um", [5]).series);
  Object.assign(tmdb.episodios, serieCompleta(500, "Serie Um", [5]).episodios);
  await semear(page, {
    series: [{ uuid: "s-1", name: "Serie Um", tmdbId: 500, numeracao: "tmdb" }],
    vistos: [{ showUuid: "s-1", season: 1, episode: 1 }],
    kv: {
      "nextup-cache": {
        "s-1": { episode: { season: 1, episode: 2, name: "Dois", airDate: "2020-01-01" }, lastWatchedAt: null },
      },
    },
  });
  await page.goto("/series");
  const titulo = page.getByRole("heading", { level: 1, name: "Serie Um" });
  await titulo.waitFor();
  // em rem (cresce com o texto do sistema): 2.25 × a raiz — 36px a 16, e
  // 38,25 a 17, a base da Mira fora do iOS (Ronda 14)
  const { tamanho, raiz } = await titulo.evaluate((el) => ({
    tamanho: parseFloat(getComputedStyle(el).fontSize),
    raiz: parseFloat(getComputedStyle(document.documentElement).fontSize),
  }));
  expect(tamanho).toBeCloseTo(2.25 * raiz, 1);
});

test("nenhum texto usa o degrau de 17px, nem desce dos 11px do Código", async ({
  page,
}) => {
  await semear(page, {
    series: [{ uuid: "s-1", name: "Serie Um", totalEpisodes: 5 }],
    listas: [{ id: "l-1", name: "Uma lista", items: [{ kind: "show", refId: "s-1" }] }],
  });
  await page.goto("/listas/l-1");
  await page.getByText("Serie Um").first().waitFor();
  const tamanhos = await page.evaluate(() =>
    [...document.querySelectorAll("main *")]
      .filter((el) => el.children.length === 0 && el.textContent?.trim())
      .map((el) => parseFloat(getComputedStyle(el).fontSize)),
  );
  expect(tamanhos).not.toContain(17);
  for (const t of tamanhos) expect(t).toBeGreaterThanOrEqual(11);
});

test("com a raiz do documento maior, o corpo de texto cresce com ela", async ({
  page,
}) => {
  // Antes da Fase 5b.2: um `text-[15px]` fica sempre a 15px, seja qual for
  // a raiz — é um valor absoluto. Depois: `text-[0.9375rem]` cresce com ela.
  await semear(page, { series: [{ uuid: "s-1", name: "Serie Um", totalEpisodes: 5 }] });
  await page.goto("/library");
  // um <p>, não a `<div>` sem capa que também mostra o nome — sem isto o
  // teste podia acertar sempre no elemento errado e nunca apanhar nada
  const alvo = page.locator("p", { hasText: "Serie Um" }).first();
  await alvo.waitFor();
  const antes = await alvo.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

  await page.evaluate(() => {
    document.documentElement.style.fontSize = "150%";
  });
  const depois = await alvo.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

  expect(depois).toBeGreaterThan(antes * 1.3);
});

test("à raiz de hoje (16px), o tamanho do texto não muda um pixel", async ({
  page,
}) => {
  // A prova de que a letra do Ruben fica como está: à raiz que ele já tem,
  // o valor tem de bater certo com o antigo `text-[15px]`.
  await semear(page, { series: [{ uuid: "s-1", name: "Serie Um", totalEpisodes: 5 }] });
  await page.goto("/library");
  const alvo = page.locator("p", { hasText: "Serie Um" }).first();
  await alvo.waitFor();
  // a base fora do iOS passou a 17 (Mira); a prova é à raiz de 16
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "16px";
  });
  const tamanho = await alvo.evaluate((el) => getComputedStyle(el).fontSize);
  expect(tamanho).toBe("15px");
});
