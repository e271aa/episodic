import { test, expect } from "./apoio/base";
import {
  degrau,
  horasPorAno,
  plural,
  porMesAno,
  segundosPorEpisodio,
  seriesMaisVistas,
} from "../src/lib/graficos";
import type { StoredShow, WatchedEpisode } from "../src/lib/db";

/**
 * Ronda 12, Fase 7 — os números por trás dos gráficos das Estatísticas.
 * Funções puras: testam-se aqui, em Node, sem browser.
 */

const ep = (showUuid: string, watchedAt: string, n = 1): WatchedEpisode => ({
  id: `${showUuid}:1:${n}`,
  showUuid,
  season: 1,
  episode: n,
  watchedAt,
  dateIsExact: true,
});
const serie = (uuid: string, name: string, runtime?: number): StoredShow =>
  ({ uuid, name, posterPath: null, ...(runtime ? { runtime } : {}) }) as StoredShow;

test("plural: 1 é singular, o resto plural — '1 meses' era o erro do herói", () => {
  expect(plural(1, "mês", "meses")).toBe("mês");
  expect(plural(0, "mês", "meses")).toBe("meses");
  expect(plural(2, "mês", "meses")).toBe("meses");
});

test("o mapa ano×mês conta por mês, ordena os anos e diz o máximo", () => {
  const m = porMesAno([
    ep("a", "2022-03-05T20:00:00Z", 1),
    ep("a", "2022-03-20T20:00:00Z", 2),
    ep("a", "2021-12-31T23:00:00Z", 3),
    ep("a", "2022-11-01T20:00:00Z", 4),
  ]);
  expect(m.anos.map((a) => a.ano)).toEqual([2021, 2022]);
  expect(m.anos[1].meses[2]).toBe(2); // março de 2022
  expect(m.anos[1].meses[10]).toBe(1); // novembro
  expect(m.anos[0].meses[11]).toBe(1); // dezembro de 2021
  expect(m.anos[1].total).toBe(3);
  expect(m.maximo).toBe(2);
});

test("sem episódios, o mapa está vazio e o máximo é 0", () => {
  expect(porMesAno([])).toEqual({ anos: [], maximo: 0 });
});

test("os degraus: 0 é nada; qualquer coisa nunca cai no 0; o máximo é o 4", () => {
  expect(degrau(0, 40)).toBe(0);
  expect(degrau(1, 40)).toBe(1); // um episódio num mês de 40 ainda se vê
  expect(degrau(10, 40)).toBe(1);
  expect(degrau(11, 40)).toBe(2);
  expect(degrau(21, 40)).toBe(3);
  expect(degrau(31, 40)).toBe(4);
  expect(degrau(40, 40)).toBe(4);
  expect(degrau(5, 0)).toBe(0);
});

test("as séries mais vistas: por episódios, desempate por nome, e só as que existem", () => {
  const eps = [
    ...[1, 2, 3].map((n) => ep("a", "2022-01-01T00:00:00Z", n)),
    ...[1, 2, 3].map((n) => ep("b", "2022-01-01T00:00:00Z", n)),
    ep("c", "2022-01-01T00:00:00Z"),
    ep("apagada", "2022-01-01T00:00:00Z"),
    ep("apagada", "2022-01-01T00:00:00Z", 2),
    ep("apagada", "2022-01-01T00:00:00Z", 3),
    ep("apagada", "2022-01-01T00:00:00Z", 4),
  ];
  const top = seriesMaisVistas(eps, [serie("a", "Zeta"), serie("b", "Alfa"), serie("c", "Gama")]);
  expect(top.map((s) => [s.name, s.count])).toEqual([
    ["Alfa", 3], // empate a 3: Alfa antes de Zeta
    ["Zeta", 3],
    ["Gama", 1],
  ]);
  expect(seriesMaisVistas(eps, [serie("a", "Zeta"), serie("b", "Alfa"), serie("c", "Gama")], 2)).toHaveLength(2);
});

test("horas por ano: o import vale a média dele, o que se marcou depois vale a duração da série", () => {
  const corte = "2026-07-01T00:00:00.000Z";
  const meta = { importedAt: corte, totalSeriesRuntimeSec: 4 * 3600, totalMoviesRuntimeSec: null };
  const todos = [
    ep("a", "2021-05-01T20:00:00Z", 1),
    ep("a", "2021-05-02T20:00:00Z", 2),
    ep("a", "2022-05-01T20:00:00Z", 3),
    ep("a", "2022-05-02T20:00:00Z", 4), // 4 importados, 4h → 1h cada
    ep("a", "2026-09-01T20:00:00Z", 5), // depois do import: 30 min
  ];
  const seg = segundosPorEpisodio(meta, [serie("a", "A", 30)], todos);
  const anos = horasPorAno(todos, seg);
  expect(anos).toEqual([
    { ano: 2021, horas: 2 },
    { ano: 2022, horas: 2 },
    { ano: 2026, horas: 1 }, // 0,5h arredonda para 1
  ]);
});

test("sem import nem duração, um episódio não vale horas inventadas", () => {
  const todos = [ep("a", "2024-01-01T20:00:00Z")];
  const seg = segundosPorEpisodio(null, [serie("a", "A")], todos);
  expect(seg(todos[0])).toBeNull();
  expect(horasPorAno(todos, seg)).toEqual([]);
});
