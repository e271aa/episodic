/**
 * Diagnóstico de temporadas desalinhadas.
 *
 * O problema, medido no Naruto do Ruben: os episódios vistos estão guardados
 * com a numeração do TV Time (que é a do TheTVDB, congelada no dia em que
 * exportou), mas o progresso é mostrado contra a divisão de temporadas que o
 * fornecedor publica HOJE. Quando as duas divergem, aparecem coisas como
 * "Temporada 1 · 57/13".
 *
 * Não há divisão "certa" a que se possa recorrer: o TheTVDB de hoje divide o
 * Naruto em 35 + 48 + 48 + 48 + 41, o TMDB em 52 + 52 + 54 + 62, a TVmaze por
 * ano de emissão em 13 + 53 + 52 + 51 + 50 + 7, e o export do Ruben tem
 * 57 + 26 + 48 + 48 + 41. Todas somam ~220 e nenhuma bate com a outra.
 *
 * Este módulo NÃO corrige nada — mede. Antes de mexer em anos de histórico
 * é preciso saber quantas séries estão afetadas e de que forma, e isso só a
 * biblioteca real responde.
 */
import { getShows, getWatchedForShow, type StoredShow } from "./db";
import { getSeasons } from "./metadata";

export interface SeasonMismatch {
  /** número da temporada tal como está guardado */
  season: number;
  /** maior número de episódio visto nessa temporada */
  maxEpisode: number;
  /** episódios vistos nessa temporada */
  watched: number;
  /** quantos o fornecedor diz que a temporada tem (null = nem existe lá) */
  providerCount: number | null;
}

export interface ShowIntegrity {
  uuid: string;
  name: string;
  /** total de episódios vistos guardados */
  watchedTotal: number;
  /** total que o fornecedor publica (soma das temporadas) */
  providerTotal: number | null;
  /** temporadas onde a numeração guardada não cabe na do fornecedor */
  mismatches: SeasonMismatch[];
  /** quantos episódios guardados trazem o ID TheTVDB (só os importados depois
   *  de este campo passar a ser guardado — mede se dá para corrigir pela chave
   *  estável ou se é preciso reimportar) */
  withTvdbId: number;
}

export interface IntegrityReport {
  checked: number;
  affected: ShowIntegrity[];
}

/**
 * Percorre a biblioteca e devolve as séries onde a numeração guardada não
 * encaixa na do fornecedor. Uma série está afetada quando existe pelo menos
 * uma temporada em que o maior episódio visto ultrapassa o tamanho publicado
 * — é isso que produz o "57/13".
 */
export async function checkSeasonAlignment(
  onProgress?: (done: number, total: number) => void,
): Promise<IntegrityReport> {
  const shows = (await getShows()).filter((s) => !s.archived);
  const affected: ShowIntegrity[] = [];
  let done = 0;

  for (const show of shows) {
    onProgress?.(done, shows.length);
    done += 1;
    const problema = await checkShow(show);
    if (problema) affected.push(problema);
  }
  onProgress?.(shows.length, shows.length);

  // Os casos mais graves primeiro: quanto maior o desvio, mais confuso no ecrã
  affected.sort((a, b) => desvio(b) - desvio(a));
  return { checked: shows.length, affected };
}

function desvio(s: ShowIntegrity): number {
  return s.mismatches.reduce(
    (max, m) => Math.max(max, m.maxEpisode - (m.providerCount ?? 0)),
    0,
  );
}

async function checkShow(show: StoredShow): Promise<ShowIntegrity | null> {
  const watched = await getWatchedForShow(show.uuid);
  if (watched.length === 0) return null;

  const seasons = await getSeasons(show);
  if (!seasons || seasons.length === 0) return null;

  // O ecrã da série mapeia as temporadas por POSIÇÃO (1ª, 2ª…), não pelo
  // número literal do fornecedor — animes indexados por ano de emissão dariam
  // "Temporada 2007". A verificação tem de usar a mesma regra, senão acusava
  // desalinhamento em todas essas séries sem haver nenhum.
  const porPosicao = new Map(seasons.map((s, i) => [i + 1, s.episodeCount]));

  const stats = new Map<number, { max: number; count: number }>();
  let withTvdbId = 0;
  for (const ep of watched) {
    if (ep.episodeTvdbId != null) withTvdbId += 1;
    const cur = stats.get(ep.season);
    if (cur) {
      cur.max = Math.max(cur.max, ep.episode);
      cur.count += 1;
    } else {
      stats.set(ep.season, { max: ep.episode, count: 1 });
    }
  }

  const mismatches: SeasonMismatch[] = [];
  for (const [season, { max, count }] of [...stats.entries()].sort((a, b) => a[0] - b[0])) {
    const providerCount = porPosicao.get(season) ?? null;
    // Sem temporada correspondente do lado do fornecedor também é desalinho
    // (ex.: guardadas 5 temporadas, o fornecedor publica 4).
    if (providerCount === null || max > providerCount) {
      mismatches.push({ season, maxEpisode: max, watched: count, providerCount });
    }
  }
  if (mismatches.length === 0) return null;

  return {
    uuid: show.uuid,
    name: show.name,
    watchedTotal: watched.length,
    providerTotal: seasons.reduce((n, s) => n + s.episodeCount, 0),
    mismatches,
    withTvdbId,
  };
}
