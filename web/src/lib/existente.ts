import {
  getMovie,
  getMovies,
  getShow,
  getShows,
  type StoredMovie,
  type StoredShow,
} from "./db";
import { normalizeTitle } from "./names";

/**
 * "Isto já está na biblioteca?" — respondido num sítio só.
 *
 * Estava escrito no Explorar e em falta na pesquisa da Biblioteca, que só
 * procurava pela chave `tmdb-<id>`. O que veio do TV Time tem a chave do TV
 * Time e o nome em inglês; a TMDB devolve o nome português. A pesquisa não o
 * reconhecia, e "Marcar visto" ou "Seguir" criava uma segunda cópia. Medido
 * na Ronda 12: o filme ficava para sempre em "para ver" e a série aparecia
 * duas vezes — uma completa, outra por começar.
 *
 * Foi a segunda vez: em julho aconteceu o mesmo pelo Explorar, corrigiu-se
 * lá, e a pesquisa ficou de fora. Por isso agora há só esta função.
 */

type Nome = string | null | undefined;

function normalizados(nomes: Nome[]): Set<string> {
  return new Set(nomes.filter((n): n is string => Boolean(n)).map(normalizeTitle));
}

/** O id que a própria chave traz, nos registos criados dentro da app. */
export function idDaChave(chave: string, fornecedor: "tmdb" | "tvmaze"): number | null {
  const m = new RegExp(`^${fornecedor}-(\\d+)$`).exec(chave);
  return m ? Number(m[1]) : null;
}

export function tmdbDoFilme(filme: StoredMovie): number | null {
  return filme.tmdbId ?? idDaChave(filme.key, "tmdb");
}

export function idsDaSerie(serie: StoredShow): { tmdb: number | null; tvmaze: number | null } {
  return {
    tmdb: serie.tmdbId ?? idDaChave(serie.uuid, "tmdb"),
    tvmaze: serie.tvmazeId ?? idDaChave(serie.uuid, "tvmaze"),
  };
}

const anoDe = (data: Nome) => (data ? Number(data.slice(0, 4)) || null : null);

/**
 * O filme, se já estiver na biblioteca.
 *
 * Mais estrito do que as séries, de propósito: aqui a resposta **muda o
 * registo** (marcar visto na pesquisa marca o que já lá está). Um remake com
 * o mesmo título — "O Rei Leão" de 1994 e de 2019 — confundido com o
 * original marcaria o filme errado. Por isso um id diferente é um filme
 * diferente, e sem id o nome só conta com o ano a bater.
 */
export async function filmeExistente(procura: {
  tmdbId: number;
  nomes: Nome[];
  ano?: number | null;
}): Promise<StoredMovie | null> {
  const direto = await getMovie(`tmdb-${procura.tmdbId}`);
  if (direto) return direto;
  const nomes = normalizados(procura.nomes);
  const filmes = await getMovies();
  return (
    filmes.find((m) => tmdbDoFilme(m) === procura.tmdbId) ??
    filmes.find((m) => {
      if (tmdbDoFilme(m) != null) return false;
      if (![m.name, ...(m.aliases ?? [])].some((n) => nomes.has(normalizeTitle(n)))) {
        return false;
      }
      const a = anoDe(m.releaseDate);
      const b = procura.ano ?? null;
      return a == null || b == null || Math.abs(a - b) <= 1;
    }) ??
    null
  );
}

/**
 * A série, se já estiver na biblioteca.
 *
 * Aqui o nome ganha mesmo com ids diferentes — é a regra que o Explorar
 * sempre teve, porque a TMDB às vezes tem a mesma série em duas entradas.
 * Um falso "já tens" só impede de criar uma cópia; o custo é baixo. A regra
 * inversa (ids diferentes = séries diferentes) vive no `repair.ts`, onde a
 * resposta serve para **apagar**, e um falso positivo destruía uma série.
 */
export async function serieExistente(procura: {
  tmdbId?: number | null;
  tvmazeId?: number | null;
  nomes: Nome[];
}): Promise<StoredShow | null> {
  for (const chave of [
    procura.tmdbId != null ? `tmdb-${procura.tmdbId}` : null,
    procura.tvmazeId != null ? `tvmaze-${procura.tvmazeId}` : null,
  ]) {
    if (!chave) continue;
    const serie = await getShow(chave);
    if (serie) return serie;
  }
  const nomes = normalizados(procura.nomes);
  const series = await getShows();
  return (
    series.find((s) => {
      const ids = idsDaSerie(s);
      return (
        (procura.tmdbId != null && ids.tmdb === procura.tmdbId) ||
        (procura.tvmazeId != null && ids.tvmaze === procura.tvmazeId)
      );
    }) ??
    series.find((s) =>
      [s.name, ...(s.tmdbAliases ?? [])].some((n) => nomes.has(normalizeTitle(n))),
    ) ??
    null
  );
}

/** Junta nomes sem repetir (pela forma normalizada), mantendo a ordem. */
export function juntarNomes(...listas: (Nome | Nome[])[]): string[] {
  const vistos = new Set<string>();
  const saida: string[] = [];
  for (const n of listas.flat()) {
    if (!n) continue;
    const chave = normalizeTitle(n);
    if (!chave || vistos.has(chave)) continue;
    vistos.add(chave);
    saida.push(n);
  }
  return saida;
}
