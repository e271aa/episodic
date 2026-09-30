import type { StoredShow, WatchedEpisode } from "@/lib/db";

/**
 * As séries de onde se pode escolher a personagem favorita: só as que já se
 * viu ou se está a ver — pelo menos um episódio marcado. Uma série só «Para
 * ver» ou seguida sem nada marcado não conta: a personagem é de alguém que se
 * conhece. Arquivadas incluídas (viram-se). Por ordem alfabética.
 */
export function seriesParaPersonagem(shows: StoredShow[], vistos: WatchedEpisode[]): StoredShow[] {
  const comEpisodios = new Set(vistos.map((v) => v.showUuid));
  return shows
    .filter((s) => comEpisodios.has(s.uuid))
    .sort((a, b) => a.name.localeCompare(b.name, "pt"));
}
