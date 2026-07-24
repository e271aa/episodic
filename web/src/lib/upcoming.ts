// Calendário "a estrear": o próximo episódio ainda por emitir de cada série
// seguida. Só olha para a última temporada conhecida — é onde os episódios
// futuros aparecem — para não pedir todas as temporadas de cada série.
import type { StoredShow } from "./db";
import { getEpisodesOfSeason, getSeasons, type MetaEpisode } from "./metadata";

export interface UpcomingEntry {
  show: StoredShow;
  episode: MetaEpisode;
}

const ENDED_STATUSES = new Set(["Ended", "Canceled", "Cancelled"]);

export async function findNextUpcoming(
  show: StoredShow,
  todayIso: string,
): Promise<MetaEpisode | null> {
  // séries terminadas nunca têm episódios por estrear — poupa o pedido
  if (show.status && ENDED_STATUSES.has(show.status)) return null;
  try {
    const seasons = await getSeasons(show);
    if (!seasons || seasons.length === 0) return null;
    const last = seasons[seasons.length - 1];
    const episodes = await getEpisodesOfSeason(show, last.number);
    const upcoming = episodes
      .filter((ep) => ep.airDate && ep.airDate > todayIso)
      .sort((a, b) => (a.airDate as string).localeCompare(b.airDate as string));
    return upcoming[0] ?? null;
  } catch {
    return null;
  }
}

/** Calendário de todas as séries seguidas com próximo episódio conhecido. */
export async function buildUpcomingCalendar(
  shows: StoredShow[],
): Promise<UpcomingEntry[]> {
  const today = new Date().toISOString().slice(0, 10);
  const followed = shows.filter((s) => s.followed && !s.archived);
  const entries: UpcomingEntry[] = [];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let i = cursor++; i < followed.length; i = cursor++) {
        const show = followed[i];
        const episode = await findNextUpcoming(show, today);
        if (episode) entries.push({ show, episode });
      }
    }),
  );
  entries.sort((a, b) => (a.episode.airDate as string).localeCompare(b.episode.airDate as string));
  return entries;
}
