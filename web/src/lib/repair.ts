/**
 * Reparação de episódios duplicados por numerações diferentes.
 *
 * O QUE ACONTECEU (medido na biblioteca real, 26-07)
 * ──────────────────────────────────────────────────
 * Duas séries tinham mais episódios marcados do que o fornecedor diz existir:
 *
 *   Naruto            264 marcados, o fornecedor tem 220
 *   La Casa de Papel   52 marcados, o fornecedor tem  41
 *
 * A causa não é viste-a-mais: é que os episódios foram marcados por DOIS
 * caminhos com numerações diferentes, e cada caminho criou as suas linhas.
 *
 *   · o import do TV Time escreveu a numeração do TheTVDB de então
 *   · marcar dentro da app escreve a numeração do fornecedor de hoje
 *
 * O que está guardado é exatamente o máximo, temporada a temporada, das duas
 * — verificado nas duas séries de forma independente:
 *
 *   Naruto            import [57,26,48,48,41] · app [13,51,51,50,50,5]
 *                     máximo [57,51,51,50,50,5] = o que lá está
 *   La Casa de Papel  import [13,9,8,8,10]     · app [15,8,8,10]
 *                     máximo [15,9,8,10,10]    = o que lá está
 *
 * Ou seja: as linhas a mais são DUPLICADOS dos mesmos episódios com outro
 * número, não episódios vistos que se percam ao apagar.
 *
 * A CONDIÇÃO DE SEGURANÇA
 * ───────────────────────
 * Ainda assim não se apaga às cegas. Só se propõe remover quando, DEPOIS de
 * remover, sobra uma série COMPLETA à luz do fornecedor. É essa a assinatura
 * de "o outro caminho já cobre tudo".
 *
 * Numa série vista só em parte esse teste falha, e aí as linhas fora do sítio
 * podem ser mesmo episódios vistos que o fornecedor numera de outra maneira —
 * essas são comunicadas e não se lhes toca.
 */
import {
  deleteShow,
  getShows,
  getWatchedForShow,
  kvGet,
  kvSet,
  markWatched,
  unmarkWatched,
  type StoredShow,
  type WatchedEpisode,
} from "./db";
import { getSeasons } from "./metadata";
import { normalizeTitle } from "./names";

/** Cópia do que foi removido, para dar para voltar atrás. */
const BACKUP_KEY = "repair:episodios-removidos";

export interface ExtraEpisode {
  season: number;
  episode: number;
}

export interface ShowRepair {
  uuid: string;
  name: string;
  /** episódios marcados hoje */
  storedTotal: number;
  /** episódios que o fornecedor publica */
  providerTotal: number;
  /** linhas fora da estrutura do fornecedor */
  extras: ExtraEpisode[];
  /**
   * true = removê-las deixa a série completa segundo o fornecedor, logo são
   * duplicados e é seguro. false = removê-las deixaria buracos, portanto
   * podem ser episódios a sério e não se mexe.
   */
  safe: boolean;
}

export interface RepairPlan {
  checked: number;
  repairs: ShowRepair[];
}

/** Estrutura do fornecedor tal como o ecrã a mostra: por POSIÇÃO, não pelo
 *  número literal (a TVmaze indexa animes por ano — 2002, 2003…). */
async function providerByPosition(show: StoredShow): Promise<Map<number, number> | null> {
  const seasons = await getSeasons(show);
  if (!seasons || seasons.length === 0) return null;
  return new Map(seasons.map((s, i) => [i + 1, s.episodeCount]));
}

function analyse(
  show: StoredShow,
  watched: WatchedEpisode[],
  porPosicao: Map<number, number>,
): ShowRepair | null {
  const extras: ExtraEpisode[] = [];
  // As especiais (temporada 0) vivem fora da numeração e ficam sempre de fora
  const reais = watched.filter((w) => w.season !== 0);
  const dentro = new Set<string>();

  for (const w of reais) {
    const cabe = porPosicao.get(w.season);
    if (cabe === undefined || w.episode < 1 || w.episode > cabe) {
      extras.push({ season: w.season, episode: w.episode });
    } else {
      dentro.add(`${w.season}:${w.episode}`);
    }
  }
  if (extras.length === 0) return null;

  // Seguro só se o que sobra cobre TODAS as temporadas do fornecedor por
  // inteiro — a prova de que as linhas a mais são o mesmo já contado.
  let completa = true;
  for (const [pos, count] of porPosicao) {
    for (let e = 1; e <= count; e++) {
      if (!dentro.has(`${pos}:${e}`)) {
        completa = false;
        break;
      }
    }
    if (!completa) break;
  }

  return {
    uuid: show.uuid,
    name: show.name,
    storedTotal: reais.length,
    providerTotal: [...porPosicao.values()].reduce((a, b) => a + b, 0),
    extras: extras.sort((a, b) => a.season - b.season || a.episode - b.episode),
    safe: completa,
  };
}

/** Procura séries com linhas fora da estrutura do fornecedor. Não altera nada. */
export async function planRepair(
  onProgress?: (done: number, total: number) => void,
): Promise<RepairPlan> {
  const shows = await getShows();
  const repairs: ShowRepair[] = [];
  let done = 0;

  for (const show of shows) {
    onProgress?.(done, shows.length);
    done += 1;
    const watched = await getWatchedForShow(show.uuid);
    if (watched.length === 0) continue;
    const porPosicao = await providerByPosition(show);
    if (!porPosicao) continue;
    const r = analyse(show, watched, porPosicao);
    if (r) repairs.push(r);
  }
  onProgress?.(shows.length, shows.length);

  repairs.sort((a, b) => b.extras.length - a.extras.length);
  return { checked: shows.length, repairs };
}

export interface RemovedBackup {
  at: string;
  episodes: (ExtraEpisode & { showUuid: string; watchedAt: string })[];
}

/**
 * Remove as linhas a mais das séries marcadas como seguras. Guarda uma cópia
 * do que removeu — inclusive a data de visto — para o poder repor.
 */
export async function applyRepair(repairs: ShowRepair[]): Promise<number> {
  const backup: RemovedBackup = { at: new Date().toISOString(), episodes: [] };

  for (const r of repairs) {
    if (!r.safe) continue;
    const watched = await getWatchedForShow(r.uuid);
    const datas = new Map(watched.map((w) => [`${w.season}:${w.episode}`, w.watchedAt]));
    for (const ex of r.extras) {
      backup.episodes.push({
        showUuid: r.uuid,
        season: ex.season,
        episode: ex.episode,
        watchedAt: datas.get(`${ex.season}:${ex.episode}`) ?? new Date().toISOString(),
      });
      await unmarkWatched(r.uuid, ex.season, ex.episode);
    }
  }

  await kvSet(BACKUP_KEY, backup);
  return backup.episodes.length;
}

/** O que está guardado para reverter (null se nunca se reparou nada). */
export async function getRepairBackup(): Promise<RemovedBackup | null> {
  return kvGet<RemovedBackup>(BACKUP_KEY);
}

/** Repõe tudo o que a última reparação removeu, com as datas originais. */
export async function undoRepair(): Promise<number> {
  const backup = await getRepairBackup();
  if (!backup) return 0;
  for (const ep of backup.episodes) {
    await markWatched(ep.showUuid, ep.season, ep.episode, ep.watchedAt);
  }
  await kvSet(BACKUP_KEY, null);
  return backup.episodes.length;
}

// ── Séries duplicadas ──────────────────────────────────────────
//
// Adicionar pelo Explorar criava uma segunda cópia da mesma série: a
// importada do TV Time tem o uuid do TV Time, a nova tem `tmdb-<id>`, e a
// verificação de "já existe" só olhava para o uuid novo. Isto encontra os
// pares e apaga a cópia vazia, ficando com a que tem o histórico.

export interface DuplicateShow {
  /** a que fica — a que tem episódios marcados */
  keepUuid: string;
  keepName: string;
  keepWatched: number;
  /** a que sai */
  dropUuid: string;
  dropName: string;
  dropWatched: number;
}

/**
 * Procura séries repetidas (mesmo id TMDB ou mesmo nome normalizado).
 *
 * Só devolve pares em que a cópia a apagar NÃO tem episódios marcados — se
 * ambas tiverem histórico, juntá-las é uma decisão que precisa de olhos, não
 * de uma regra automática, e essas ficam de fora.
 */
export async function findDuplicateShows(): Promise<DuplicateShow[]> {
  const shows = await getShows();
  const contagens = new Map<string, number>();
  await Promise.all(
    shows.map(async (s) => {
      contagens.set(s.uuid, (await getWatchedForShow(s.uuid)).length);
    }),
  );

  const grupos = new Map<string, StoredShow[]>();
  for (const s of shows) {
    // O id TMDB é a chave mais forte quando existe; o nome apanha o resto
    const chave = s.tmdbId != null ? `tmdb:${s.tmdbId}` : `nome:${normalizeTitle(s.name)}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), s]);
  }
  // Segunda passagem por nome: a original pode ter tmdbId e a cópia também,
  // mas séries sem tmdbId nenhum só se encontram pelo nome.
  const porNome = new Map<string, StoredShow[]>();
  for (const s of shows) {
    const n = normalizeTitle(s.name);
    porNome.set(n, [...(porNome.get(n) ?? []), s]);
  }

  const pares: DuplicateShow[] = [];
  const jaVistos = new Set<string>();

  for (const grupo of [...grupos.values(), ...porNome.values()]) {
    if (grupo.length < 2) continue;
    const ordenado = [...grupo].sort(
      (a, b) => (contagens.get(b.uuid) ?? 0) - (contagens.get(a.uuid) ?? 0),
    );
    const fica = ordenado[0];
    for (const sai of ordenado.slice(1)) {
      if (jaVistos.has(sai.uuid)) continue;
      // nunca apagar uma cópia que tem histórico próprio
      if ((contagens.get(sai.uuid) ?? 0) > 0) continue;
      jaVistos.add(sai.uuid);
      pares.push({
        keepUuid: fica.uuid,
        keepName: fica.name,
        keepWatched: contagens.get(fica.uuid) ?? 0,
        dropUuid: sai.uuid,
        dropName: sai.name,
        dropWatched: contagens.get(sai.uuid) ?? 0,
      });
    }
  }
  return pares;
}

/** Apaga as cópias vazias. Devolve quantas saíram. */
export async function removeDuplicateShows(pares: DuplicateShow[]): Promise<number> {
  for (const p of pares) await deleteShow(p.dropUuid);
  return pares.length;
}
