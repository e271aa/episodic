import type { Page } from "@playwright/test";

/**
 * A TMDB falsa.
 *
 * Nenhum teste pode depender do que a TMDB responde hoje: o "Hacksaw Ridge"
 * pode mudar de posição na pesquisa e o teste da Ronda 5 passaria a falhar por
 * uma razão que não tem nada a ver com a app. Aqui as respostas são fixas, e
 * cada teste ajusta o `Catalogo` antes de navegar.
 *
 * O que **não** for intercetado aqui vai bater no `/api/tmdb`, que sem
 * `TMDB_API_KEY` (ver `playwright.config.ts`) responde 503 — uma fuga dá erro
 * em vez de passar despercebida.
 */

/** Uma linha de resultado da TMDB, como vem de `search/*`, `trending/*`, … */
export interface LinhaTmdb {
  id: number;
  media_type?: "tv" | "movie" | "person";
  name?: string;
  title?: string;
  original_name?: string;
  original_title?: string;
  first_air_date?: string;
  release_date?: string;
  poster_path: string | null;
  backdrop_path?: string | null;
  overview?: string;
  genre_ids?: number[];
  vote_average?: number;
  vote_count?: number;
}

export interface DetalheSerie {
  id: number;
  name: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  first_air_date?: string;
  status: string;
  number_of_episodes: number;
  number_of_seasons: number;
  episode_run_time: number[];
  seasons: { season_number: number; episode_count: number; name: string; poster_path: string | null }[];
}

export interface EpisodioTmdb {
  episode_number: number;
  season_number: number;
  name: string;
  overview: string;
  air_date: string | null;
  still_path: string | null;
  runtime: number | null;
}

export interface Catalogo {
  /** o que `search/multi` devolve — séries e filmes misturados, como a TMDB */
  multi: LinhaTmdb[];
  /** o que `trending/{tipo}/week?page=1` devolve (página 2 vem sempre vazia) */
  tendencias: LinhaTmdb[];
  /** detalhe por id: `tv/{id}` */
  series: Record<number, DetalheSerie>;
  /** episódios por `"{tmdbId}:{temporada}"`: `tv/{id}/season/{n}` */
  episodios: Record<string, EpisodioTmdb[]>;
  /** detalhe por id: `movie/{id}` */
  filmes: Record<number, Record<string, unknown>>;
}

export function catalogoVazio(): Catalogo {
  return { multi: [], tendencias: [], series: {}, episodios: {}, filmes: {} };
}

/** Uma série completa (detalhe + episódios), pronta a pôr no catálogo. */
export function serieCompleta(
  tmdbId: number,
  nome: string,
  temporadas: number[],
): Pick<Catalogo, "series" | "episodios"> {
  const total = temporadas.reduce((n, c) => n + c, 0);
  const episodios: Record<string, EpisodioTmdb[]> = {};
  temporadas.forEach((contagem, i) => {
    const numero = i + 1;
    episodios[`${tmdbId}:${numero}`] = Array.from({ length: contagem }, (_, j) => ({
      episode_number: j + 1,
      season_number: numero,
      name: `Episódio ${j + 1}`,
      overview: "",
      air_date: "2020-01-01",
      still_path: null,
      runtime: 42,
    }));
  });
  return {
    series: {
      [tmdbId]: {
        id: tmdbId,
        name: nome,
        poster_path: "/cartaz.jpg",
        backdrop_path: "/fundo.jpg",
        overview: "",
        first_air_date: "2020-01-01",
        status: "Ended",
        number_of_episodes: total,
        number_of_seasons: temporadas.length,
        episode_run_time: [42],
        seasons: temporadas.map((contagem, i) => ({
          season_number: i + 1,
          episode_count: contagem,
          name: `Temporada ${i + 1}`,
          poster_path: null,
        })),
      },
    },
    episodios,
  };
}

/** PNG transparente de 1×1 — chega para o layout, não vai à rede. */
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

export async function interceptarTmdb(page: Page, catalogo: Catalogo): Promise<void> {
  await page.route(/\/api\/tmdb\//, async (rota) => {
    const url = new URL(rota.request().url());
    const caminho = decodeURIComponent(url.pathname.replace(/^\/api\/tmdb\//, ""));
    const json = (corpo: unknown) =>
      rota.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(corpo),
      });

    if (caminho === "status") return json({ available: true });
    if (caminho === "search/multi") return json({ results: catalogo.multi });
    if (caminho === "search/tv")
      return json({ results: catalogo.multi.filter((r) => r.media_type !== "movie") });
    if (caminho === "search/movie")
      return json({ results: catalogo.multi.filter((r) => r.media_type === "movie") });

    const serie = /^tv\/(\d+)$/.exec(caminho);
    if (serie) {
      const detalhe = catalogo.series[Number(serie[1])];
      return detalhe ? json(detalhe) : json({ status_code: 34 });
    }

    const temporada = /^tv\/(\d+)\/season\/(\d+)$/.exec(caminho);
    if (temporada)
      return json({ episodes: catalogo.episodios[`${temporada[1]}:${temporada[2]}`] ?? [] });

    const filme = /^movie\/(\d+)$/.exec(caminho);
    if (filme) {
      const detalhe = catalogo.filmes[Number(filme[1])];
      return detalhe ? json(detalhe) : json({ status_code: 34 });
    }

    if (/^trending\/(tv|movie)\/week$/.test(caminho))
      return json({ results: url.searchParams.get("page") === "2" ? [] : catalogo.tendencias });

    if (/^genre\/(tv|movie)\/list$/.test(caminho)) return json({ genres: [] });

    // discover, recommendations, watch/providers, aggregate_credits, find/…
    return json({ results: [], tv_results: [], movie_results: [], cast: [], crew: [] });
  });

  // As capas passam pelo otimizador do Next (`/_next/image`), que as vai
  // buscar no servidor — sem isto o CI ligava-se mesmo ao CDN da TMDB.
  await page.route(/\/_next\/image/, (rota) =>
    rota.fulfill({ status: 200, contentType: "image/png", body: PIXEL }),
  );

  await page.route(/^https:\/\/api\.tvmaze\.com\//, (rota) =>
    rota.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );

  await page.route(/^https:\/\/(image\.tmdb\.org|static\.tvmaze\.com)\//, (rota) =>
    rota.fulfill({ status: 200, contentType: "image/png", body: PIXEL }),
  );
}
