// Carregamento partilhado da biblioteca de séries com progresso — usado
// tanto pelo ecrã "A seguir" como pela Biblioteca.
import { getAllWatched, getShows, migrateLegacyImport, type StoredShow } from "./db";

export interface ShowWithProgress extends StoredShow {
  watchedCount: number;
  /** data do episódio marcado mais recentemente ("" se nunca marcaste nada) */
  lastWatchedAt: string;
}

export async function loadShows(): Promise<ShowWithProgress[]> {
  await migrateLegacyImport();
  const [stored, watched] = await Promise.all([getShows(), getAllWatched()]);
  const counts = new Map<string, number>();
  const last = new Map<string, string>();
  for (const ep of watched) {
    // A temporada 0 são especiais/OVAs. Contam como visionamento (e entram
    // nas estatísticas do perfil), mas NÃO no progresso da série: o total do
    // fornecedor só inclui episódios regulares, e somá-las aqui dava
    // "90/88 episódios vistos" no Prison Break, com todas as temporadas
    // certas e a série a 100% mesmo assim.
    if (ep.season === 0) continue;
    counts.set(ep.showUuid, (counts.get(ep.showUuid) ?? 0) + 1);
    const seen = last.get(ep.showUuid);
    if (!seen || ep.watchedAt > seen) last.set(ep.showUuid, ep.watchedAt);
  }
  return stored
    .map((s) => ({
      ...s,
      watchedCount: counts.get(s.uuid) ?? 0,
      lastWatchedAt: last.get(s.uuid) ?? "",
    }))
    .sort((a, b) => b.watchedCount - a.watchedCount);
}
