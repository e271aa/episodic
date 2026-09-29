/**
 * Os números por trás dos gráficos das Estatísticas (Ronda 12, Fase 7).
 *
 * Funções puras, sem base de dados — recebem o que já foi lido e devolvem o
 * que se desenha. Assim testam-se sem browser, e o gráfico e a tabela que o
 * acompanha (para o leitor de ecrã) leem os mesmos números.
 *
 * Tudo aqui trabalha só com episódios de **data certa**: os que o TV Time
 * marcou em massa não sabem quando foram vistos (ver `advancedStats.ts`).
 */
import type { ImportMeta, StoredShow, WatchedEpisode } from "./db";

/** "1 mês" / "2 meses" — o plural certo, para o que o herói e os gráficos dizem. */
export function plural(n: number, singular: string, pluralForma: string): string {
  return n === 1 ? singular : pluralForma;
}

export interface AnoDeMeses {
  ano: number;
  /** episódios por mês, janeiro (0) a dezembro (11) */
  meses: number[];
  total: number;
}

export interface MapaAnoMes {
  anos: AnoDeMeses[];
  /** o maior valor de um mês */
  maximo: number;
  /** os quartis (25, 50, 75%) dos meses com alguma coisa — a escala das células */
  limites: [number, number, number];
}

/** Episódios por mês, em cada ano — do mais antigo ao mais recente. */
export function porMesAno(watched: WatchedEpisode[]): MapaAnoMes {
  const porAno = new Map<number, number[]>();
  for (const ep of watched) {
    const ano = Number(ep.watchedAt.slice(0, 4));
    const mes = Number(ep.watchedAt.slice(5, 7)) - 1;
    if (!Number.isFinite(ano) || !(mes >= 0 && mes <= 11)) continue;
    const meses = porAno.get(ano) ?? new Array<number>(12).fill(0);
    meses[mes]++;
    porAno.set(ano, meses);
  }
  const anos = [...porAno.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([ano, meses]) => ({ ano, meses, total: meses.reduce((n, c) => n + c, 0) }));
  const cheios = anos.flatMap((a) => a.meses).filter((n) => n > 0).sort((x, y) => x - y);
  const maximo = cheios.at(-1) ?? 0;
  const quartil = (q: number) => cheios[Math.floor(q * (cheios.length - 1))] ?? 0;
  return { anos, maximo, limites: [quartil(0.25), quartil(0.5), quartil(0.75)] };
}

/**
 * A intensidade de uma célula, de 0 (nada) a 4 — quatro degraus em vez de
 * uma escala contínua: dois meses de 38 e 40 episódios não são distinguíveis
 * a olho, e fingir que são é ruído. Um mês com **alguma** coisa nunca cai no
 * degrau 0, e o mês mais forte está sempre no 4.
 *
 * Os degraus são **quartis** dos meses com alguma coisa, não frações do
 * máximo (Ronda 12, Fecho). Com frações, uma biblioteca regular (meses entre
 * 15 e 18) ficava toda no degrau de cima — uma parede creme — e um mês de
 * maratona esmagava os outros todos no de baixo.
 */
export function degrau(
  valor: number,
  { maximo, limites }: Pick<MapaAnoMes, "maximo" | "limites">,
): 0 | 1 | 2 | 3 | 4 {
  if (valor <= 0 || maximo <= 0) return 0;
  if (valor >= maximo) return 4;
  const [q1, q2, q3] = limites;
  if (valor > q3) return 4;
  if (valor > q2) return 3;
  if (valor > q1) return 2;
  return 1;
}

export interface SerieVista {
  uuid: string;
  name: string;
  posterPath: string | null;
  count: number;
}

/** As séries com mais episódios vistos (todos, com ou sem data certa). */
export function seriesMaisVistas(
  watched: WatchedEpisode[],
  shows: StoredShow[],
  quantas = 5,
): SerieVista[] {
  const contagem = new Map<string, number>();
  for (const ep of watched) contagem.set(ep.showUuid, (contagem.get(ep.showUuid) ?? 0) + 1);
  const porUuid = new Map(shows.map((s) => [s.uuid, s]));
  return [...contagem.entries()]
    .filter(([uuid]) => porUuid.has(uuid))
    .sort((a, b) => b[1] - a[1] || porUuid.get(a[0])!.name.localeCompare(porUuid.get(b[0])!.name))
    .slice(0, quantas)
    .map(([uuid, count]) => {
      const s = porUuid.get(uuid)!;
      return { uuid, name: s.name, posterPath: s.posterPath, count };
    });
}

/**
 * Quantos segundos vale cada episódio — a mesma regra do Tempo de antena
 * (`horasDeAntena`, em `stats.ts`): o que veio do TV Time vale a média do
 * próprio import (o total dele, dividido pelos episódios que ele trouxe); o
 * que se marcou depois vale a duração da série, ou a média se não a
 * soubermos. `null` quando não há como saber.
 */
export function segundosPorEpisodio(
  meta: ImportMeta | null,
  shows: StoredShow[],
  todos: WatchedEpisode[],
): (ep: WatchedEpisode) => number | null {
  const corte = meta?.importedAt ?? null;
  const base = meta?.totalSeriesRuntimeSec ?? 0;
  const importados = corte ? todos.filter((w) => w.watchedAt <= corte).length : 0;
  const media = base > 0 && importados > 0 ? base / importados : null;
  const duracao = new Map(shows.map((s) => [s.uuid, s.runtime ?? null]));
  return (ep) => {
    if (corte && ep.watchedAt <= corte) return media;
    const minutos = duracao.get(ep.showUuid);
    return minutos ? minutos * 60 : media;
  };
}

export interface HorasDeUmAno {
  ano: number;
  horas: number;
}

/**
 * Horas por ano — **uma estimativa**, e diz-se. O TV Time só deu o total; a
 * app reparte-o pelos episódios importados (média igual para todos) e usa a
 * duração de cada série no que se marcou depois. Só entram episódios de
 * data certa, por isso a soma dos anos é ≤ ao Tempo de antena.
 */
export function horasPorAno(
  exatos: WatchedEpisode[],
  segundos: (ep: WatchedEpisode) => number | null,
): HorasDeUmAno[] {
  const porAno = new Map<number, number>();
  for (const ep of exatos) {
    const s = segundos(ep);
    if (!s) continue;
    const ano = Number(ep.watchedAt.slice(0, 4));
    if (Number.isFinite(ano)) porAno.set(ano, (porAno.get(ano) ?? 0) + s);
  }
  return [...porAno.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([ano, s]) => ({ ano, horas: Math.round(s / 3600) }));
}
