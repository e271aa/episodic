import {
  getShows,
  getWatchedForShow,
  kvGet,
  kvSet,
  markWatchedMany,
  unmarkWatchedMany,
  updateShow,
  type StoredShow,
} from "./db";
import { getSeasons } from "./metadata";

/**
 * "Rever a biblioteca" — as séries atrás do que já estreou, uma de cada vez.
 *
 * Na Fase 0 da Ronda 12, 17 das 74 séries estavam atrás do que já tinha
 * estreado. A app não tem forma de saber quais viste: o How I Met Your Mother
 * tem só as T8 e T9 marcadas porque o TV Time nunca teve as outras; o Grey's
 * Anatomy tem um episódio porque começaste e largaste. Só tu sabes. Isto
 * pergunta — e cada resposta faz uma coisa só, com anulação:
 *
 *   · vi tudo          → marca o que já estreou, com data inexata
 *   · ainda estou a ver → deixa tudo como está, e não volta a perguntar
 *   · deixei de ver     → arquiva
 *
 * É a mesma regra da Fase 1 da Ronda 11: a app propõe, nunca decide.
 */

export type Padrao = "buracos" | "fronteira" | "meio";

export interface Episodio {
  season: number;
  episode: number;
}

export interface SerieARever {
  show: StoredShow;
  /** marcados dentro do que já estreou */
  vistos: number;
  estreados: number;
  /** tudo o que já estreou e não está marcado */
  porMarcar: Episodio[];
  /** só os que estão ANTES do último marcado — os "buracos" */
  paraTras: Episodio[];
  padrao: Padrao;
  ultimo: Episodio | null;
  /** quantos episódios tem cada temporada (por posição), já estreados */
  porTemporada: number[];
}

const CHAVE_A_VER = "rever:a-ver";

async function respondidas(): Promise<Set<string>> {
  return new Set((await kvGet<string[]>(CHAVE_A_VER)) ?? []);
}

export async function marcarAindaAVer(uuid: string): Promise<void> {
  const atuais = await respondidas();
  atuais.add(uuid);
  await kvSet(CHAVE_A_VER, [...atuais]);
}

export async function desfazerAindaAVer(uuid: string): Promise<void> {
  const atuais = await respondidas();
  atuais.delete(uuid);
  await kvSet(CHAVE_A_VER, [...atuais]);
}

const ORDEM: Record<Padrao, number> = { buracos: 0, fronteira: 1, meio: 2 };

async function analisar(show: StoredShow): Promise<SerieARever | null> {
  const vistos = (await getWatchedForShow(show.uuid)).filter((w) => w.season !== 0);
  if (vistos.length === 0) return null;
  const temporadas = await getSeasons(show);
  // sem fornecedor não há "o que já estreou" com que comparar
  if (!temporadas || temporadas.length === 0) return null;

  const marcados = new Set(vistos.map((w) => `${w.season}:${w.episode}`));
  const porTemporada = temporadas.map((t) => t.estreados);
  const todos: Episodio[] = [];
  porTemporada.forEach((n, i) => {
    for (let e = 1; e <= n; e++) todos.push({ season: i + 1, episode: e });
  });

  let ultimoIndice = -1;
  todos.forEach((ep, i) => {
    if (marcados.has(`${ep.season}:${ep.episode}`)) ultimoIndice = i;
  });
  const porMarcar = todos.filter((ep) => !marcados.has(`${ep.season}:${ep.episode}`));
  const estreados = todos.length;

  // O total guardado é o que a Biblioteca lê; já que se perguntou ao
  // fornecedor, fica certo.
  if (show.totalEpisodes !== estreados) {
    await updateShow(show.uuid, { totalEpisodes: estreados || null });
  }
  if (porMarcar.length === 0 || ultimoIndice < 0) return null;

  const ultimo = todos[ultimoIndice];
  const paraTras = todos
    .slice(0, ultimoIndice)
    .filter((ep) => !marcados.has(`${ep.season}:${ep.episode}`));
  const padrao: Padrao =
    paraTras.length > 0
      ? "buracos"
      : ultimo.episode === porTemporada[ultimo.season - 1]
        ? "fronteira"
        : "meio";

  return {
    show,
    vistos: estreados - porMarcar.length,
    estreados,
    porMarcar,
    paraTras,
    padrao,
    ultimo,
    porTemporada,
  };
}

/**
 * As séries a rever, pela ordem em que a pergunta é mais fácil: primeiro as
 * que têm buracos para trás (quase de certeza vistas), depois as que param
 * no fim de uma temporada, e por fim as que ficaram a meio.
 */
export async function seriesARever(
  aoProgredir?: (feitas: number, total: number) => void,
): Promise<SerieARever[]> {
  const jaRespondidas = await respondidas();
  const candidatas = (await getShows()).filter(
    (s) => !s.archived && !jaRespondidas.has(s.uuid),
  );
  const resultado: SerieARever[] = [];
  let feitas = 0;
  let cursor = 0;
  aoProgredir?.(0, candidatas.length);
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let i = cursor++; i < candidatas.length; i = cursor++) {
        try {
          const r = await analisar(candidatas[i]);
          if (r) resultado.push(r);
        } catch {
          // sem rede para esta série: fica para a próxima vez
        }
        aoProgredir?.(++feitas, candidatas.length);
      }
    }),
  );
  return resultado.sort(
    (a, b) => ORDEM[a.padrao] - ORDEM[b.padrao] || a.show.name.localeCompare(b.show.name),
  );
}

/** Marca o que se diz ter visto — sem data certa, porque não se sabe. */
export async function marcarVistos(uuid: string, episodios: Episodio[]): Promise<void> {
  await markWatchedMany(uuid, episodios, { exata: false });
}

export async function desmarcarVistos(uuid: string, episodios: Episodio[]): Promise<void> {
  await unmarkWatchedMany(uuid, episodios);
}

export async function arquivar(uuid: string, arquivada: boolean): Promise<void> {
  await updateShow(uuid, { archived: arquivada });
}

/** "T6 e T7", "T1 a T7" — as temporadas onde estão os episódios por marcar. */
export function temporadasDe(episodios: Episodio[]): string {
  const t = [...new Set(episodios.map((e) => e.season))].sort((a, b) => a - b);
  if (t.length === 0) return "";
  if (t.length === 1) return `T${t[0]}`;
  if (t.length === 2) return `T${t[0]} e T${t[1]}`;
  const seguidas = t.every((n, i) => i === 0 || n === t[i - 1] + 1);
  return seguidas ? `T${t[0]} a T${t[t.length - 1]}` : t.map((n) => `T${n}`).join(", ");
}
