// Carregamento partilhado da biblioteca de séries com progresso — usado
// tanto pelo ecrã "Esta noite" como pela Biblioteca.
import { getAllWatched, getShows, migrateLegacyImport, type StoredShow } from "./db";

export interface ShowWithProgress extends StoredShow {
  watchedCount: number;
}

export async function loadShows(): Promise<ShowWithProgress[]> {
  await migrateLegacyImport();
  const [stored, watched] = await Promise.all([getShows(), getAllWatched()]);
  const counts = new Map<string, number>();
  for (const ep of watched) {
    counts.set(ep.showUuid, (counts.get(ep.showUuid) ?? 0) + 1);
  }
  return stored
    .map((s) => ({ ...s, watchedCount: counts.get(s.uuid) ?? 0 }))
    .sort((a, b) => b.watchedCount - a.watchedCount);
}
