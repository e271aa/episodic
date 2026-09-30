// Calcula o próximo episódio por ver de cada série — o coração do Flicki.
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
 * O episódio já estreado que vem DEPOIS do último visto. Devolve null quando
 * não há nada por ver à frente — a série está em dia, mesmo que tenha
 * episódios por marcar para trás.
 *
 * Começava no S01·E01 e devolvia o primeiro por marcar que encontrasse: com
 * buracos para trás, propunha um deles (a crítica da Ronda 12, 5b.4: "Marcar
 * próximo · S02·E20" ao lado de "22 por marcar mais atrás", e o E20 era um
 * dos 22). Os buracos são "por marcar", não "por ver" — têm o cartão deles
 * no detalhe e o Rever (`buracos.ts`, `rever.ts`).
 *
 * O TV Time numera temporadas sequencialmente (1, 2, 3…), mas alguns
 * fornecedores não — a TVmaze indexa animes longos (Naruto, etc.) pelo ANO de
 * emissão como se fosse o nº da temporada (2007, 2008…). Comparar esse número
 * literalmente com o que está guardado localmente nunca bateria certo, e a
 * série apareceria sempre "por ver desde o início" mesmo 100% vista. Em vez
 * do número do fornecedor, usa-se a POSIÇÃO da temporada na lista ordenada
 * (1ª, 2ª, 3ª…) — o mesmo que o TV Time já assume — o que não muda nada nas
 * séries normais (onde posição e número já coincidem).
 */
export async function findNextUnwatched(
  show: StoredShow,
  watched: WatchedEpisode[],
): Promise<NextUp | null> {
  const seen = new Set(watched.map((w) => w.id));
  const today = new Date().toISOString().slice(0, 10);

  const seasons = await getSeasons(show);
  if (!seasons) return null;

  // o último visto, por posição (os especiais, temporada 0, não contam)
  let ultimo = { season: 1, episode: 0 };
  for (const w of watched) {
    if (w.season < 1) continue;
    if (
      w.season > ultimo.season ||
      (w.season === ultimo.season && w.episode > ultimo.episode)
    ) {
      ultimo = { season: w.season, episode: w.episode };
    }
  }

  // só a partir da temporada do último visto: as de trás não se leem
  for (let i = ultimo.season - 1; i < seasons.length; i++) {
    const localSeason = i + 1; // posição, não o número literal do fornecedor
    const episodes = await getEpisodesOfSeason(show, seasons[i].number);
    const aired = episodes
      .filter((ep) => hasAired(ep, today))
      .map((ep) => ({ ...ep, season: localSeason }))
      .filter((ep) => localSeason > ultimo.season || ep.episode > ultimo.episode)
      .filter((ep) => !seen.has(episodeKey(show.uuid, ep.season, ep.episode)));
    if (aired.length > 0) {
      return { showUuid: show.uuid, episode: aired[0], remainingInSeason: aired.length };
    }
  }
  return null;
}

/** Formata o código de episódio à Flicki: S04·E01 */
export function formatEpCode(season: number, episode: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `S${pad(season)}·E${pad(episode)}`;
}
