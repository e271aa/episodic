// Calcula o próximo episódio por ver de cada série — o coração do Episodic.
import { episodeKey, type StoredShow, type WatchedEpisode } from "./db";
import { getEpisodesOfSeason, getSeasons, type MetaEpisode } from "./metadata";

export interface NextUp {
  showUuid: string;
  episode: MetaEpisode;
  /** quantos episódios por ver (nesta temporada, mínimo conhecido) */
  remainingInSeason: number;
}

function hasAired(episode: MetaEpisode, todayIso: string): boolean {
  // sem data de estreia contamos como disponível (melhor mostrar a mais que esconder)
  return !episode.airDate || episode.airDate <= todayIso;
}

/**
 * Primeiro episódio já estreado que ainda não foi visto, percorrendo as
 * temporadas por ordem. Devolve null quando a série está em dia.
 */
export async function findNextUnwatched(
  show: StoredShow,
  watched: WatchedEpisode[],
): Promise<NextUp | null> {
  const seen = new Set(watched.map((w) => w.id));
  const today = new Date().toISOString().slice(0, 10);

  const seasons = await getSeasons(show);
  if (!seasons) return null;

  for (const season of seasons) {
    const episodes = await getEpisodesOfSeason(show, season.number);
    const aired = episodes.filter((ep) => hasAired(ep, today));
    const next = aired.find(
      (ep) => !seen.has(episodeKey(show.uuid, ep.season, ep.episode)),
    );
    if (next) {
      const remaining = aired.filter(
        (ep) => !seen.has(episodeKey(show.uuid, ep.season, ep.episode)),
      ).length;
      return { showUuid: show.uuid, episode: next, remainingInSeason: remaining };
    }
  }
  return null;
}

/** Formata o código de episódio à Episodic: S04·E01 */
export function formatEpCode(season: number, episode: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `S${pad(season)}·E${pad(episode)}`;
}
