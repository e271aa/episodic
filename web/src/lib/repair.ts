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
  deleteMovie,
  deleteShow,
  getMovies,
  getShows,
  getWatchedForShow,
  kvGet,
  kvSet,
  markWatched,
  putMovie,
  reapontarListas,
  unmarkWatched,
  updateShow,
  type StoredMovie,
  type StoredShow,
  type WatchedEpisode,
} from "./db";
import { idsDaSerie, juntarNomes, tmdbDoFilme } from "./existente";
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
 * Duas séries com o mesmo nome são MESMO a mesma série?
 *
 * Nem sempre. A biblioteca do Ruben tem duas "Hunter x Hunter" — a de 1999
 * (TheTVDB 79076, TVmaze 1537) e o reboot de 2011 (TheTVDB 252322, TVmaze
 * 1536), ambas seguidas e ambas sem episódios marcados. Só pelo nome, uma
 * regra automática apagaria uma delas.
 *
 * Regra: se as duas trazem o mesmo tipo de id e os ids são DIFERENTES, são
 * séries diferentes — e nada as junta, por muito que o nome coincida.
 */
function idsEmConflito(a: StoredShow, b: StoredShow): boolean {
  const pares: [number | null | undefined, number | null | undefined][] = [
    [a.tmdbId, b.tmdbId],
    [a.tvdbId, b.tvdbId],
    [a.tvmazeId, b.tvmazeId],
  ];
  return pares.some(([x, y]) => x != null && y != null && x !== y);
}

/**
 * Junta em grupos o que está ligado por qualquer um dos pares — se A liga a B
 * e B liga a C, os três são um grupo, mesmo que A e C não se liguem direto.
 */
function agrupar<T>(itens: T[], ligados: (a: T, b: T) => boolean): T[][] {
  const pai = itens.map((_, i) => i);
  const raiz = (i: number): number => (pai[i] === i ? i : (pai[i] = raiz(pai[i])));
  for (let i = 0; i < itens.length; i++) {
    for (let j = i + 1; j < itens.length; j++) {
      if (ligados(itens[i], itens[j])) pai[raiz(i)] = raiz(j);
    }
  }
  const grupos = new Map<number, T[]>();
  itens.forEach((item, i) => grupos.set(raiz(i), [...(grupos.get(raiz(i)) ?? []), item]));
  return [...grupos.values()].filter((g) => g.length > 1);
}

/** Todos os nomes por que uma série é conhecida, na forma normalizada. */
function nomesDaSerie(s: StoredShow): Set<string> {
  return new Set([s.name, ...(s.tmdbAliases ?? [])].map(normalizeTitle));
}

/**
 * Procura séries repetidas.
 *
 * Agrupava só pelo nome — e as cópias criadas pela pesquisa da Biblioteca
 * têm o nome **português** da TMDB: "Ruptura Total" ao lado do "Breaking Bad"
 * importado. Passavam por baixo desta verificação (Ronda 12). Agora liga
 * também pelo id (o do registo, ou o que a própria chave traz, `tmdb-1396`)
 * e pelos nomes alternativos.
 *
 * Os dois travões continuam, os dois necessários:
 *  - a cópia a apagar não pode ter episódios marcados
 *  - as duas não podem ter ids de fornecedor que se contradigam
 */
export async function findDuplicateShows(): Promise<DuplicateShow[]> {
  const shows = await getShows();
  const contagens = new Map<string, number>();
  await Promise.all(
    shows.map(async (s) => {
      contagens.set(s.uuid, (await getWatchedForShow(s.uuid)).length);
    }),
  );

  const grupos = agrupar(shows, (a, b) => {
    if (idsEmConflito(a, b)) return false;
    const ia = idsDaSerie(a);
    const ib = idsDaSerie(b);
    if (ia.tmdb != null && ia.tmdb === ib.tmdb) return true;
    if (ia.tvmaze != null && ia.tvmaze === ib.tvmaze) return true;
    const nb = nomesDaSerie(b);
    return [...nomesDaSerie(a)].some((n) => nb.has(n));
  });

  const pares: DuplicateShow[] = [];
  for (const grupo of grupos) {
    // fica a que tem histórico; em empate, a que veio do TV Time (é a que as
    // tuas listas e o teu histórico conhecem), e depois a mais antiga
    const fica = [...grupo].sort(
      (a, b) =>
        (contagens.get(b.uuid) ?? 0) - (contagens.get(a.uuid) ?? 0) ||
        Number(/^(tmdb|tvmaze)-/.test(a.uuid)) - Number(/^(tmdb|tvmaze)-/.test(b.uuid)) ||
        a.addedAt.localeCompare(b.addedAt),
    )[0];
    for (const sai of grupo) {
      if (sai.uuid === fica.uuid) continue;
      // nunca apagar uma cópia que tem histórico próprio
      if ((contagens.get(sai.uuid) ?? 0) > 0) continue;
      // nem duas séries que os fornecedores dizem ser diferentes
      if (idsEmConflito(fica, sai)) continue;
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

/**
 * Apaga as cópias vazias. Devolve quantas saíram.
 *
 * Antes de apagar, passa para a que fica o que a cópia sabia: os nomes (para
 * a pesquisa a encontrar pelo português), as listas onde estava, e a
 * intenção — se seguiste a cópia, é porque queres seguir a série. **Os ids
 * não passam**: acrescentar um id do TMDB a uma série sem numeração declarada
 * mudava-lhe a numeração por baixo (ver `StoredShow.numeracao`).
 */
export async function removeDuplicateShows(pares: DuplicateShow[]): Promise<number> {
  const porUuid = new Map((await getShows()).map((s) => [s.uuid, s]));
  for (const p of pares) {
    const fica = porUuid.get(p.keepUuid);
    const sai = porUuid.get(p.dropUuid);
    if (fica && sai) {
      await updateShow(fica.uuid, {
        tmdbAliases: juntarNomes(fica.tmdbAliases, sai.name, sai.tmdbAliases),
        ...(sai.followed && !fica.followed ? { followed: true, archived: false } : null),
        ...(sai.inWatchlist && !fica.followed && !fica.inWatchlist ? { inWatchlist: true } : null),
      });
      await reapontarListas("show", sai.uuid, fica.uuid);
    }
    await deleteShow(p.dropUuid);
  }
  return pares.length;
}

// ── Filmes repetidos ──────────────────────────────────────────
//
// O mesmo bug, do lado dos filmes, com uma consequência pior: marcar visto
// na pesquisa um filme que estava em "para ver" criava uma cópia vista, e o
// original ficava em "para ver" para sempre (Ronda 12). Ao contrário das
// séries, aqui as duas cópias têm informação — uma sabe que o viste — por
// isso junta-se, não se apaga só.

export interface DuplicateMovie {
  /** a que fica: a do TV Time, que as listas e o histórico conhecem */
  keepKey: string;
  keepName: string;
  /** as que saem, depois de passarem o que sabem para a que fica */
  dropKeys: string[];
  dropNames: string[];
  /** como fica depois de juntar */
  watchedAt: string | null;
}

const anoDoFilme = (m: StoredMovie) =>
  m.releaseDate ? Number(m.releaseDate.slice(0, 4)) || null : null;

function mesmoFilme(a: StoredMovie, b: StoredMovie): boolean {
  const ia = tmdbDoFilme(a);
  const ib = tmdbDoFilme(b);
  // um id diferente é um filme diferente, sempre — "O Rei Leão" de 1994 e o
  // de 2019 têm o mesmo título
  if (ia != null && ib != null) return ia === ib;
  const na = new Set([a.name, ...(a.aliases ?? [])].map(normalizeTitle));
  if (![b.name, ...(b.aliases ?? [])].some((n) => na.has(normalizeTitle(n)))) return false;
  const ya = anoDoFilme(a);
  const yb = anoDoFilme(b);
  return ya == null || yb == null || Math.abs(ya - yb) <= 1;
}

/** Procura filmes repetidos. Não altera nada. */
export async function findDuplicateMovies(): Promise<DuplicateMovie[]> {
  const filmes = await getMovies();
  const grupos: DuplicateMovie[] = [];
  for (const grupo of agrupar(filmes, mesmoFilme)) {
    const fica = [...grupo].sort(
      (a, b) =>
        Number(a.key.startsWith("tmdb-")) - Number(b.key.startsWith("tmdb-")) ||
        (a.addedAt ?? "").localeCompare(b.addedAt ?? ""),
    )[0];
    // Diretamente o mesmo filme que o que fica, não só ligado por um terceiro:
    // um registo sem ano nem id ligava o "Rei Leão" de 1994 ao de 2019
    const saem = grupo.filter((m) => m.key !== fica.key && mesmoFilme(fica, m));
    if (saem.length === 0) continue;
    const visto =
      fica.watchedAt ??
      saem
        .map((m) => m.watchedAt)
        .filter((d): d is string => d != null)
        .sort()[0] ??
      null;
    grupos.push({
      keepKey: fica.key,
      keepName: fica.name,
      dropKeys: saem.map((m) => m.key),
      dropNames: saem.map((m) => m.name),
      watchedAt: visto,
    });
  }
  return grupos;
}

/**
 * Junta cada grupo num filme só. Fica o do TV Time; recebe dos outros a data
 * de visto (se ele não tiver), os nomes, o id e a capa; as listas passam a
 * apontar para ele; e os outros saem. Devolve quantos filmes saíram.
 */
export async function mergeDuplicateMovies(grupos: DuplicateMovie[]): Promise<number> {
  const porChave = new Map((await getMovies()).map((m) => [m.key, m]));
  let sairam = 0;
  for (const g of grupos) {
    const fica = porChave.get(g.keepKey);
    const saem = g.dropKeys.map((k) => porChave.get(k)).filter((m): m is StoredMovie => !!m);
    if (!fica || saem.length === 0) continue;
    const comData = fica.watchedAt
      ? fica
      : [...saem].filter((m) => m.watchedAt).sort((a, b) => a.watchedAt!.localeCompare(b.watchedAt!))[0];
    await putMovie({
      ...fica,
      watchedAt: comData?.watchedAt ?? null,
      dateIsExact: comData?.dateIsExact ?? fica.dateIsExact,
      tmdbId: fica.tmdbId ?? saem.map(tmdbDoFilme).find((id) => id != null) ?? null,
      posterPath: fica.posterPath ?? saem.find((m) => m.posterPath)?.posterPath ?? null,
      aliases: juntarNomes(fica.aliases, ...saem.flatMap((m) => [m.name, ...(m.aliases ?? [])])),
    });
    for (const m of saem) {
      await reapontarListas("movie", m.key, fica.key);
      await deleteMovie(m.key);
      sairam += 1;
    }
  }
  return sairam;
}
