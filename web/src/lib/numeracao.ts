import { getShows, getWatchedForShow, kvGet, kvSet, updateShow } from "./db";
import { hasTmdb } from "./metadata";
import * as tmdb from "./tmdb";
import * as tvmaze from "./tvmaze";

/**
 * Devolver a numeração às séries que a perderam.
 *
 * Até à Ronda 12, cada "Sincronizar agora" substituía a série local pela da
 * cloud — e a cloud não guardava a numeração. Uma série que a tinha perdido
 * voltava à regra antiga ("com id da TMDB, numera pela TMDB"), e nas que a
 * TVmaze e a TMDB dividem de maneira diferente, as marcações passavam a
 * apontar para outros episódios. Medido na biblioteca real: 11 séries, 729
 * marcações (Naruto 220, Friends 163, Hajime no Ippo 127…).
 *
 * Não se sabe no telemóvel se isto já aconteceu, nem a quais. Mas os próprios
 * episódios marcados dizem com que numeração foram marcados: o Naruto tem
 * marcações na 6.ª temporada, e a TMDB só tem 4. Só se decide quando
 * EXATAMENTE uma das divisões aceita todas as marcações — com as duas a
 * aceitarem (a maioria: mesma divisão) ou nenhuma, não se toca.
 */

export interface Marcacao {
  season: number;
  episode: number;
}

/** Todas as marcações (sem as especiais) existem nesta divisão? */
export function cabeEm(particao: number[], marcacoes: Marcacao[]): boolean {
  return marcacoes.every(
    (m) =>
      m.season === 0 ||
      (m.season >= 1 &&
        m.season <= particao.length &&
        m.episode >= 1 &&
        m.episode <= particao[m.season - 1]),
  );
}

export function escolherNumeracao(
  particaoTvmaze: number[],
  particaoTmdb: number[],
  marcacoes: Marcacao[],
): "tvmaze" | "tmdb" | null {
  const naTvmaze = cabeEm(particaoTvmaze, marcacoes);
  const naTmdb = cabeEm(particaoTmdb, marcacoes);
  if (naTvmaze && !naTmdb) return "tvmaze";
  if (naTmdb && !naTvmaze) return "tmdb";
  return null;
}

/** Séries que já se viu que não dá para decidir — não se volta a perguntar
 *  aos fornecedores a cada abertura da Biblioteca. */
const CHAVE_INDECISAS = "numeracao:indecisas";

async function particoes(tvmazeId: number, tmdbId: number) {
  const [episodios, detalhes] = await Promise.all([
    tvmaze.getEpisodes(tvmazeId),
    tmdb.getShowDetails(tmdbId),
  ]);
  const porTemporada = new Map<number, number>();
  for (const ep of episodios) porTemporada.set(ep.season, (porTemporada.get(ep.season) ?? 0) + 1);
  return {
    tvmaze: [...porTemporada.entries()].sort((a, b) => a[0] - b[0]).map(([, n]) => n),
    tmdb: (detalhes.seasons ?? [])
      .filter((s) => s.season_number > 0)
      .sort((a, b) => a.season_number - b.season_number)
      .map((s) => s.episode_count),
  };
}

let aCorrer = false;

/** Devolve quantas séries recuperaram a numeração. */
export async function curarNumeracao(): Promise<number> {
  if (aCorrer || !(await hasTmdb())) return 0;
  aCorrer = true;
  try {
    const indecisas = new Set((await kvGet<string[]>(CHAVE_INDECISAS)) ?? []);
    const candidatas = (await getShows()).filter(
      (s) => !s.numeracao && s.tmdbId && s.tvmazeId != null && !indecisas.has(s.uuid),
    );
    let curadas = 0;
    for (const serie of candidatas) {
      try {
        const marcacoes = (await getWatchedForShow(serie.uuid)).filter((w) => w.season !== 0);
        if (marcacoes.length === 0) {
          indecisas.add(serie.uuid);
          continue;
        }
        const p = await particoes(serie.tvmazeId as number, serie.tmdbId as number);
        const escolha = escolherNumeracao(p.tvmaze, p.tmdb, marcacoes);
        if (escolha) {
          await updateShow(serie.uuid, { numeracao: escolha });
          curadas += 1;
        } else {
          indecisas.add(serie.uuid);
        }
      } catch {
        // sem rede para esta série: tenta-se na próxima vez
      }
    }
    await kvSet(CHAVE_INDECISAS, [...indecisas]);
    return curadas;
  } finally {
    aCorrer = false;
  }
}
