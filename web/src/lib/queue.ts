// Fila partilhada entre o ecrã "A seguir" e a Triagem por swipe.
// Guarda o próximo episódio por ver de cada série seguida + quando foi visto
// o último, para separar Continuar (ativo) / Retomar (parado) / Por começar.
import { kvGet, kvSet, type StoredShow } from "./db";
import type { MetaEpisode } from "./metadata";
import type { ShowWithProgress } from "./shows";

export interface QueueEntry {
  episode: MetaEpisode;
  lastWatchedAt: string | null;
}

export type NextUpMap = Map<string, QueueEntry>;

// Série sem episódios vistos há mais de 30 dias sai da fila principal
export const STALE_MS = 30 * 24 * 60 * 60 * 1000;

// A fila calculada persiste entre visitas: mostra-se logo a última versão
// conhecida e recalcula-se em segundo plano (stale-while-revalidate).
const NEXTUP_CACHE_KEY = "nextup-cache";

export function persistNextUp(map: NextUpMap): void {
  void kvSet(NEXTUP_CACHE_KEY, Object.fromEntries(map));
}

// A cache antiga guardava só o episódio (MetaEpisode, onde `episode` é um
// número); no formato novo `episode` é um objeto. Converte sem perder a fila.
function reviveQueueEntry(value: QueueEntry | MetaEpisode): QueueEntry {
  return typeof value.episode === "object"
    ? (value as QueueEntry)
    : { episode: value as MetaEpisode, lastWatchedAt: null };
}

export async function loadCachedNextUp(): Promise<NextUpMap | null> {
  const cached = await kvGet<Record<string, QueueEntry | MetaEpisode>>(
    NEXTUP_CACHE_KEY,
  );
  if (!cached || Object.keys(cached).length === 0) return null;
  return new Map(
    Object.entries(cached).map(([uuid, value]) => [uuid, reviveQueueEntry(value)]),
  );
}

export function lastWatchDate(watched: { watchedAt: string }[]): string | null {
  let max: string | null = null;
  for (const w of watched) {
    if (max === null || w.watchedAt > max) max = w.watchedAt;
  }
  return max;
}

export interface QueueBuckets {
  active: ShowWithProgress[];
  stale: ShowWithProgress[];
  notStarted: ShowWithProgress[];
}

/**
 * Divide a fila como o TV Time: ativas (vistas há -30 dias), paradas
 * (Retomar) e seguidas mas nunca começadas (Por começar). Mais
 * recentemente vistas primeiro dentro de cada grupo.
 */
export function classifyQueue(
  shows: ShowWithProgress[],
  nextUp: NextUpMap,
  now: number,
): QueueBuckets {
  const watching = shows.filter((s) => s.followed && !s.archived);
  const active: ShowWithProgress[] = [];
  const stale: ShowWithProgress[] = [];
  const notStarted: ShowWithProgress[] = [];
  for (const show of watching) {
    const entry = nextUp.get(show.uuid);
    if (!entry) continue;
    if (show.watchedCount === 0) {
      notStarted.push(show);
    } else if (entry.lastWatchedAt && now - Date.parse(entry.lastWatchedAt) > STALE_MS) {
      stale.push(show);
    } else {
      active.push(show);
    }
  }
  const byLastWatchedDesc = (a: StoredShow, b: StoredShow) =>
    (nextUp.get(b.uuid)?.lastWatchedAt ?? "").localeCompare(
      nextUp.get(a.uuid)?.lastWatchedAt ?? "",
    );
  active.sort(byLastWatchedDesc);
  stale.sort(byLastWatchedDesc);
  return { active, stale, notStarted };
}
