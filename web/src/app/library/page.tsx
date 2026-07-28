"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Poster from "@/components/Poster";
import {
  deleteMovie,
  getMovie,
  getMovies,
  getShow,
  kvGet,
  kvSet,
  putMovie,
  putShow,
  updateMovie,
  updateShow,
  type StoredMovie,
} from "@/lib/db";
import { loadShows, type ShowWithProgress } from "@/lib/shows";
import {
  enrichMovie,
  searchMovies,
  searchShows,
  type MetaMovieResult,
  type MetaSearchResult,
} from "@/lib/metadata";
import { pushUndo } from "@/lib/undo";
import {
  decadeLabel,
  groupByBucket,
  groupSorted,
  letterLabel,
  periodLabel,
} from "@/lib/grouping";
import PosterCard from "@/components/PosterCard";
import SectionHeader from "@/components/SectionHeader";
import LibraryControls from "@/components/LibraryControls";
import SheetPanel from "@/components/SheetPanel";
import { PosterGridBone, TitleBone } from "@/components/Skeleton";
import {
  TvIcon,
  CheckIcon,
  ClapperboardIcon,
  SearchIcon,
} from "@/components/icons";

type Segment = "series" | "filmes";
type SeriesFilter = "tudo" | "a-ver" | "completas" | "para-ver" | "arquivadas" | "parei";
type MovieFilter = "vistos" | "para-ver" | "todos";
/** Filmes não têm "estado" como as séries — o eixo útil é quando saíram */
type MovieSort = "vistos" | "recentes" | "antigos" | "az";
type SeriesSort = "vistos" | "progresso" | "az" | "adicionadas";

const SERIES_SORTS: { id: SeriesSort; label: string }[] = [
  { id: "vistos", label: "Vistos há pouco" },
  { id: "progresso", label: "Mais episódios vistos" },
  { id: "az", label: "A–Z" },
  { id: "adicionadas", label: "Adicionadas há pouco" },
];

const MOVIE_SORTS: { id: MovieSort; label: string }[] = [
  { id: "vistos", label: "Vistos há pouco" },
  { id: "recentes", label: "Estreia mais recente" },
  { id: "antigos", label: "Estreia mais antiga" },
  { id: "az", label: "A–Z" },
];

type FollowState = "idle" | "following" | "done";

/** A ordem por que as secções de estado aparecem, e a cor de cada uma. As
 *  cores são as mesmas da barra de progresso do cartaz: verde = a andar,
 *  roxo = acabou. Cor com significado, não decoração. */
const ESTADOS = ["A ver", "Completas", "Para ver", "Já não sigo", "Arquivadas"];
const COR_ESTADO: Record<string, string> = {
  "A ver": "#37c837",
  Completas: "#d24bd2",
  "Para ver": "#3fd2c8",
  "Já não sigo": "#8a8880",
  Arquivadas: "#8a8880",
};

// Sobe quando a forma de escolher o filme no TMDB muda: obriga a rever os
// filmes já enriquecidos uma vez, em vez de deixar os erros antigos fossilizados.
const ENRICH_VERSION = 2;
const ENRICH_KEY = "movies:enrich-v";

// Normaliza para pesquisar sem acentos nem maiúsculas — "pokemon" encontra "Pokémon"
function norm(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function ResultCard({ result }: { result: MetaSearchResult }) {
  const [state, setState] = useState<FollowState>("idle");
  const [inWatchlist, setInWatchlist] = useState(false);
  const uuid = `${result.provider}-${result.providerId}`;

  const add = useCallback(
    async (followed: boolean) => {
      setState("following");
      const existing = await getShow(uuid);
      if (existing) {
        await updateShow(uuid, { followed, inWatchlist: !followed });
      } else {
        await putShow({
          uuid,
          name: result.name,
          tvdbId: null,
          tmdbId: result.provider === "tmdb" ? result.providerId : null,
          tvmazeId: result.provider === "tvmaze" ? result.providerId : null,
          posterPath: result.posterUrl,
          backdropPath: result.backdropUrl,
          overview: result.overview,
          totalEpisodes: null,
          followed,
          inWatchlist: !followed,
          archived: false,
          addedAt: new Date().toISOString(),
        });
      }
      setInWatchlist(!followed);
      setState("done");
    },
    [result, uuid],
  );

  return (
    <div className="page-enter flex gap-3 rounded-2xl border border-line bg-panel p-3">
      {result.posterUrl ? (
        <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-lg">
          <Poster path={result.posterUrl} alt="" fill className="object-cover" />
        </div>
      ) : (
        <div className="flex h-24 w-16 shrink-0 items-center justify-center rounded-lg bg-raised text-faint">
          <TvIcon className="h-6 w-6" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {result.name}
          {result.year && (
            <span className="ep-code ml-2 text-sm text-faint">{result.year}</span>
          )}
        </p>
        <p className="mt-1 line-clamp-2 text-[15px] text-dim">{result.overview}</p>
        {state === "done" ? (
          <button
            disabled
            className="mt-2 flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full bg-raised px-4 text-[15px] font-semibold text-dim"
          >
            <CheckIcon className="check-pop h-3.5 w-3.5" />
            {inWatchlist ? "Na lista para ver" : "A seguir"}
          </button>
        ) : (
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => void add(true)}
              disabled={state !== "idle"}
              className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full bg-ink px-4 text-[15px] font-semibold text-tube transition hover:brightness-110 active:scale-95 disabled:opacity-50"
            >
              {state === "following" && (
                <span className="spinner h-3.5 w-3.5 rounded-full border-2 border-tube/30 border-t-tube" />
              )}
              Seguir
            </button>
            <button
              onClick={() => void add(false)}
              disabled={state !== "idle"}
              className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-line px-4 text-[15px] font-semibold text-dim transition hover:border-ink hover:text-ink active:scale-95 disabled:opacity-50"
            >
              Para ver
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Resultado da pesquisa de filmes. Um filme não se "segue" — ou já o viste ou
 * não, por isso a ação é marcá-lo como visto hoje (a data edita-se depois na
 * página do filme).
 */
function MovieResultCard({
  result,
  onAdded,
}: {
  result: MetaMovieResult;
  onAdded: () => void;
}) {
  const [state, setState] = useState<FollowState>("idle");
  const key = `tmdb-${result.tmdbId}`;

  const add = useCallback(
    async (watched: boolean) => {
      setState("following");
      const existing = await getMovie(key);
      if (!existing) {
        await putMovie({
          key,
          name: result.name,
          watchedAt: watched ? new Date().toISOString() : null,
          dateIsExact: true,
          releaseDate: result.releaseDate,
          addedAt: new Date().toISOString(),
          tmdbId: result.tmdbId,
          posterPath: result.posterPath,
        });
      }
      setState("done");
      onAdded();
      // só se anula o que esta ação criou — um filme que já lá estava fica
      if (!existing) {
        pushUndo({
          label: watched ? "Filme marcado como visto" : "Filme adicionado a para ver",
          detail: result.name,
          undo: async () => {
            await deleteMovie(key);
            setState("idle");
            onAdded();
          },
        });
      }
    },
    [key, result, onAdded],
  );

  return (
    <div className="page-enter flex gap-3 rounded-2xl border border-line bg-panel p-3">
      {result.posterUrl ? (
        <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-lg">
          <Poster path={result.posterUrl} alt="" fill className="object-cover" />
        </div>
      ) : (
        <div className="flex h-24 w-16 shrink-0 items-center justify-center rounded-lg bg-raised text-faint">
          <ClapperboardIcon className="h-6 w-6" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {result.name}
          {result.year && (
            <span className="ep-code ml-2 text-sm text-faint">{result.year}</span>
          )}
        </p>
        <p className="mt-1 line-clamp-2 text-[15px] text-dim">{result.overview}</p>
        {state === "done" ? (
          <button
            disabled
            className="mt-2 flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full bg-raised px-4 text-[15px] font-semibold text-dim"
          >
            <CheckIcon className="check-pop h-3.5 w-3.5" />
            Na biblioteca
          </button>
        ) : (
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => void add(true)}
              disabled={state !== "idle"}
              className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full bg-ink px-4 text-[15px] font-semibold text-tube transition hover:brightness-110 active:scale-95 disabled:opacity-50"
            >
              {state === "following" && (
                <span className="spinner h-3.5 w-3.5 rounded-full border-2 border-tube/30 border-t-tube" />
              )}
              Marcar visto
            </button>
            <button
              onClick={() => void add(false)}
              disabled={state !== "idle"}
              className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-line px-4 text-[15px] font-semibold text-dim transition hover:border-ink hover:text-ink active:scale-95 disabled:opacity-50"
            >
              Para ver
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MovieCard({
  movie,
  index,
  onChanged,
}: {
  movie: StoredMovie;
  index: number;
  onChanged: () => void;
}) {
  const year = movie.releaseDate?.slice(0, 4);
  const paraVer = !movie.watchedAt;

  const markWatched = useCallback(
    async (e: React.MouseEvent) => {
      // o botão vive dentro do Link — não pode navegar para o detalhe
      e.preventDefault();
      e.stopPropagation();
      await putMovie({ ...movie, watchedAt: new Date().toISOString() });
      onChanged();
      pushUndo({
        label: "Filme marcado como visto",
        detail: movie.name,
        undo: async () => {
          await putMovie({ ...movie, watchedAt: null });
          onChanged();
        },
      });
    },
    [movie, onChanged],
  );

  return (
    <Link
      href={`/movies/${movie.key}`}
      className="poster-in group block cursor-pointer transition active:scale-[0.97]"
      style={{ animationDelay: `${Math.min(index, 11) * 35}ms` }}
    >
      <div className="relative aspect-2/3 overflow-hidden rounded-2xl bg-panel shadow-md shadow-black/30 transition duration-200 group-hover:-translate-y-0.5 group-hover:ring-2 group-hover:ring-ink/60">
        {/* nome por baixo da capa — ver nota em PosterCard */}
        <div className="absolute inset-0 flex items-center justify-center bg-raised p-2 text-center font-display text-[15px] font-bold text-dim">
          {movie.name}
        </div>
        <Poster
          path={movie.posterPath}
          alt={movie.name}
          fill
          sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, 20vw"
          className="object-cover transition duration-300 group-hover:scale-105"
        />
        {paraVer && (
          <>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/70 to-transparent" />
            <span className="ep-code absolute left-1.5 top-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink backdrop-blur">
              Para ver
            </span>
            <button
              onClick={(e) => void markWatched(e)}
              aria-label="Marcar como visto"
              className="tap-44 absolute bottom-1.5 right-1.5 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-ink text-tube shadow-md transition active:scale-90"
            >
              <CheckIcon className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
      <p className="mt-1.5 truncate text-[15px] font-medium">{movie.name}</p>
      <p className="ep-code truncate text-xs text-dim">{year ?? movie.watchedAt?.slice(0, 4) ?? ""}</p>
    </Link>
  );
}

/**
 * A ordem tem de estar sempre à vista — dizer "A–Z" ou "Vistos há pouco" em
 * texto resolve a dúvida sem ser preciso abrir nada; o ícone só muda.
 */
function StickySectionHeader({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color?: string;
}) {
  return (
    <div className="sticky top-0 z-10 -mx-5 mb-2 mt-5 bg-tube/90 px-5 py-2 backdrop-blur">
      <SectionHeader label={label} meta={count} color={color} />
    </div>
  );
}

function ShowPoster({ show, index }: { show: ShowWithProgress; index: number }) {
  return (
    <PosterCard
      href={`/series/${show.uuid}`}
      name={show.name}
      posterPath={show.posterPath}
      index={index}
      watched={show.watchedCount}
      total={show.totalEpisodes}
      status={show.status}
    />
  );
}

/**
 * Vazio com saída. Um ecrã que só diz "não há nada" deixa o utilizador
 * encalhado — há sempre um passo seguinte a oferecer.
 */
function EmptyState({
  query,
  segment,
  filter,
  onClearFilter,
}: {
  query: string | null;
  segment: Segment;
  filter: SeriesFilter;
  onClearFilter: () => void;
}) {
  const filtrado = segment === "series" && filter !== "tudo";
  return (
    <div className="mt-12 flex flex-col items-center px-6 text-center">
      <span className="bars mb-4 h-11 w-11 rounded-full opacity-40" aria-hidden />
      <p className="font-display font-semibold">
        {query
          ? `Nada na tua biblioteca para “${query}”`
          : filtrado
            ? "Nada neste filtro"
            : segment === "series"
              ? "Ainda não há séries"
              : "Ainda não há filmes"}
      </p>
      <p className="mt-1 max-w-xs text-[15px] text-dim">
        {query
          ? "Procura no catálogo em baixo para o adicionares."
          : filtrado
            ? "Este filtro está vazio — vê tudo o que tens."
            : "Procura pelo nome para adicionares o primeiro."}
      </p>
      {filtrado && !query && (
        <button
          onClick={onClearFilter}
          className="mt-5 min-h-11 cursor-pointer rounded-full bg-ink px-6 text-[15px] font-semibold text-tube transition hover:brightness-110"
        >
          Ver tudo
        </button>
      )}
    </div>
  );
}

const SERIES_SORT_IDS = new Set(SERIES_SORTS.map((s) => s.id));
const MOVIE_SORT_IDS = new Set(MOVIE_SORTS.map((s) => s.id));

function LibraryContent() {
  const router = useRouter();
  const params = useSearchParams();

  // O estado de navegação vive no URL: partilhável, sobrevive a recargas e
  // faz o gesto de recuar funcionar dentro da própria Biblioteca.
  const segment: Segment = params.get("tipo") === "filmes" ? "filmes" : "series";
  const rawFiltro = params.get("filtro") as SeriesFilter | null;
  const filter: SeriesFilter =
    rawFiltro && ["a-ver", "completas", "para-ver", "arquivadas", "parei"].includes(rawFiltro)
      ? rawFiltro
      : "tudo";
  const movieFilter: MovieFilter =
    rawFiltro && ["vistos", "para-ver", "todos"].includes(rawFiltro)
      ? (rawFiltro as MovieFilter)
      : "vistos";
  const rawOrdem = params.get("ordem");
  const seriesSort: SeriesSort =
    rawOrdem && SERIES_SORT_IDS.has(rawOrdem as SeriesSort)
      ? (rawOrdem as SeriesSort)
      : "vistos";
  const movieSort: MovieSort =
    rawOrdem && MOVIE_SORT_IDS.has(rawOrdem as MovieSort)
      ? (rawOrdem as MovieSort)
      : "vistos";
  const decade = Number(params.get("decada")) || null;

  const setParams = useCallback(
    (patch: Record<string, string | null>, push = false) => {
      const next = new URLSearchParams(params);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      const url = next.size > 0 ? `/library?${next}` : "/library";
      if (push) router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    },
    [params, router],
  );

  const [shows, setShows] = useState<ShowWithProgress[] | null>(null);
  const [movies, setMovies] = useState<StoredMovie[] | null>(null);
  const [query, setQuery] = useState("");
  // A pesquisa e os filtros saíram do cabeçalho; vivem atrás dos ícones da
  // barra flutuante e abrem por cima do conteúdo.
  const [pesquisaAberta, setPesquisaAberta] = useState(false);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  // Pesquisa remota é secundária: só corre quando o utilizador a pede
  const [remote, setRemote] = useState<MetaSearchResult[] | null>(null);
  const [remoteMovies, setRemoteMovies] = useState<MetaMovieResult[] | null>(null);
  const [remoteBusy, setRemoteBusy] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const enriching = useRef(false);

  // "Para ver" não tem watchedAt — cai para o fim numa ordenação por "vistos"
  const byWatchedDesc = (a: StoredMovie, b: StoredMovie) =>
    (b.watchedAt ?? "").localeCompare(a.watchedAt ?? "");

  const reloadMovies = useCallback(() => {
    void getMovies().then((list) => setMovies(list.sort(byWatchedDesc)));
  }, []);

  useEffect(() => {
    void loadShows().then(setShows);
    void getMovies().then(async (list) => {
      setMovies(list.sort(byWatchedDesc));
      // Completa capas e datas de estreia em falta via TMDB. A capa vivia na
      // antiga página /movies, que quase não tinha entradas — filmes sem
      // capa nunca eram enriquecidos. A data de estreia é a mesma história:
      // muitos filmes importados do TV Time nunca a trouxeram, e sem ela o
      // filtro de décadas usava a data em que marcaste como visto (errado).
      if (enriching.current) return;
      enriching.current = true;
      try {
        // Uma revisão em massa quando a regra de escolha do filme muda: os que
        // já estavam enriquecidos guardaram o filme ERRADO (o "Ciao Alberto"
        // ficou com o homónimo de 2003 em vez do spin-off do Luca de 2021) e
        // como têm capa e data nunca mais seriam tocados.
        const rever = ((await kvGet<number>(ENRICH_KEY)) ?? 0) < ENRICH_VERSION;
        let changed = false;
        for (const movie of list) {
          // Filmes vindos do Explorar já trazem o id TMDB certo — pesquisar
          // outra vez pelo nome só arriscaria trocá-los por um homónimo.
          if (movie.key.startsWith("tmdb-")) continue;
          if (!rever && movie.posterPath && movie.releaseDate) continue;
          const patch = await enrichMovie(movie, rever);
          if (patch) {
            await updateMovie(movie.key, patch);
            changed = true;
          }
        }
        if (rever) await kvSet(ENRICH_KEY, ENRICH_VERSION);
        if (changed) {
          const fresh = await getMovies();
          setMovies(fresh.sort(byWatchedDesc));
        }
      } finally {
        enriching.current = false;
      }
    });
  }, []);

  // Filtrar o que já tens é instantâneo (é tudo local) — sem botão, sem espera
  const q = norm(query.trim());

  const filteredShows = useMemo(() => {
    if (!shows) return [];
    const complete = (s: ShowWithProgress) =>
      s.totalEpisodes != null && s.watchedCount >= s.totalEpisodes;
    let list = shows;
    if (filter === "a-ver") {
      list = list.filter((s) => s.followed && !s.archived && !complete(s));
    } else if (filter === "completas") {
      list = list.filter((s) => complete(s));
    } else if (filter === "para-ver") {
      list = list.filter((s) => s.inWatchlist && !s.followed);
    } else if (filter === "arquivadas") {
      list = list.filter((s) => s.archived);
    } else if (filter === "parei") {
      list = list.filter((s) => !s.followed && !s.inWatchlist);
    }
    if (q) list = list.filter((s) => norm(s.name).includes(q));
    const sorted = [...list];
    if (seriesSort === "vistos") {
      sorted.sort((a, b) => b.lastWatchedAt.localeCompare(a.lastWatchedAt));
    } else if (seriesSort === "progresso") {
      sorted.sort((a, b) => b.watchedCount - a.watchedCount);
    } else if (seriesSort === "az") {
      sorted.sort((a, b) => a.name.localeCompare(b.name, "pt"));
    } else {
      sorted.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
    }
    return sorted;
  }, [shows, filter, q, seriesSort]);

  // Ano do filme: preferimos a estreia; sem ela, o ano em que o viste (um
  // filme "para ver" pode não ter nenhuma das duas ainda)
  const movieYear = (m: StoredMovie): number =>
    Number((m.releaseDate ?? m.watchedAt ?? "").slice(0, 4));

  /** Décadas presentes na coleção, da mais recente para a mais antiga */
  const decades = useMemo(() => {
    if (!movies) return [];
    const set = new Set<number>();
    for (const m of movies) {
      const year = movieYear(m);
      if (Number.isFinite(year)) set.add(Math.floor(year / 10) * 10);
    }
    return [...set].sort((a, b) => b - a);
  }, [movies]);

  const filteredMovies = useMemo(() => {
    if (!movies) return [];
    let list = movies;
    if (movieFilter === "vistos") list = list.filter((m) => m.watchedAt);
    else if (movieFilter === "para-ver") list = list.filter((m) => !m.watchedAt);
    if (decade !== null) {
      list = list.filter((m) => {
        const year = movieYear(m);
        return year >= decade && year < decade + 10;
      });
    }
    if (q) list = list.filter((m) => norm(m.name).includes(q));
    const sorted = [...list];
    if (movieSort === "vistos") {
      // sem data de visto (para ver), cai para a data em que adicionaste
      sorted.sort(
        (a, b) =>
          (b.watchedAt ?? b.addedAt ?? "").localeCompare(a.watchedAt ?? a.addedAt ?? ""),
      );
    } else if (movieSort === "recentes") {
      sorted.sort((a, b) => movieYear(b) - movieYear(a));
    } else if (movieSort === "antigos") {
      sorted.sort((a, b) => movieYear(a) - movieYear(b));
    } else {
      sorted.sort((a, b) => a.name.localeCompare(b.name, "pt"));
    }
    return sorted;
  }, [movies, q, decade, movieSort, movieFilter]);

  const counts = useMemo(() => {
    const complete = (s: ShowWithProgress) =>
      s.totalEpisodes != null && s.watchedCount >= s.totalEpisodes;
    return {
      tudo: shows?.length ?? 0,
      "a-ver": shows?.filter((s) => s.followed && !s.archived && !complete(s)).length ?? 0,
      completas: shows?.filter(complete).length ?? 0,
      "para-ver": shows?.filter((s) => s.inWatchlist && !s.followed).length ?? 0,
      arquivadas: shows?.filter((s) => s.archived).length ?? 0,
      parei: shows?.filter((s) => !s.followed && !s.inWatchlist).length ?? 0,
    } as Record<SeriesFilter, number>;
  }, [shows]);

  const movieCounts = useMemo(
    () => ({
      vistos: movies?.filter((m) => m.watchedAt).length ?? 0,
      "para-ver": movies?.filter((m) => !m.watchedAt).length ?? 0,
      todos: movies?.length ?? 0,
    }),
    [movies],
  );

  // Procura no catálogo do segmento em que estás: séries na aba das séries,
  // filmes na aba dos filmes.
  const searchRemote = useCallback(async () => {
    const term = query.trim();
    if (!term) return;
    setRemoteBusy(true);
    setRemoteError(null);
    try {
      if (segment === "series") setRemote(await searchShows(term));
      else setRemoteMovies(await searchMovies(term));
    } catch {
      if (segment === "series") setRemote([]);
      else setRemoteMovies([]);
      setRemoteError("Não foi possível pesquisar — verifica a ligação à internet.");
    } finally {
      setRemoteBusy(false);
    }
  }, [query, segment]);

  // Mudar o texto invalida os resultados remotos anteriores (é um evento,
  // não um efeito — o estado deriva diretamente da ação do utilizador)
  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    setRemote(null);
    setRemoteMovies(null);
    setRemoteError(null);
  }, []);

  // Trocar de segmento também invalida: os resultados eram do outro catálogo.
  // push (e não replace) para o gesto de recuar voltar ao segmento anterior.
  const changeSegment = useCallback(
    (id: Segment) => {
      setRemote(null);
      setRemoteMovies(null);
      setRemoteError(null);
      setParams(
        { tipo: id === "series" ? null : id, filtro: null, ordem: null, decada: null },
        true,
      );
    },
    [setParams],
  );

  const loading = shows === null || movies === null;
  const showing = segment === "series" ? filteredShows.length : filteredMovies.length;

  // Secções derivadas da ordem ativa: por tempo dá períodos, A–Z dá letras,
  // estreia dá décadas. A pesquisar não se agrupa — são poucos resultados e
  // as bandas só atrapalhavam.
  /** O estado da série, para as secções da grelha. É o agrupamento por
   *  omissão: sem filtro aplicado, "o que estou a ver" e "o que já acabei"
   *  são as duas perguntas que a Biblioteca responde. */
  const estadoLabel = (s: ShowWithProgress): string => {
    if (s.archived) return "Arquivadas";
    if (!s.followed) return s.inWatchlist ? "Para ver" : "Já não sigo";
    if (s.totalEpisodes && s.watchedCount >= s.totalEpisodes) return "Completas";
    return "A ver";
  };

  const showGroups = useMemo(
    () =>
      q
        ? null
        : filter === "tudo" && seriesSort === "vistos"
          ? groupByBucket(filteredShows, estadoLabel, ESTADOS)
          : groupSorted(filteredShows, {
            vistos: (s: ShowWithProgress) => periodLabel(s.lastWatchedAt || null),
            adicionadas: (s: ShowWithProgress) => periodLabel(s.addedAt),
            az: (s: ShowWithProgress) => letterLabel(s.name),
            progresso: null,
          }[seriesSort]),
    [filteredShows, seriesSort, filter, q],
  );

  const movieGroups = useMemo(
    () =>
      q
        ? null
        : groupSorted(filteredMovies, {
            vistos: (m: StoredMovie) => periodLabel(m.watchedAt),
            recentes: (m: StoredMovie) => decadeLabel(movieYear(m)),
            antigos: (m: StoredMovie) => decadeLabel(movieYear(m)),
            az: (m: StoredMovie) => letterLabel(m.name),
          }[movieSort]),
    [filteredMovies, movieSort, q],
  );
  /** resultados remotos do segmento atual — null enquanto ninguém pesquisou */
  const searched = segment === "series" ? remote : remoteMovies;

  const FILTERS: { id: SeriesFilter; label: string }[] = [
    { id: "tudo", label: "Tudo" },
    { id: "a-ver", label: "A ver" },
    { id: "completas", label: "Completas" },
    { id: "para-ver", label: "Para ver" },
    { id: "arquivadas", label: "Arquivadas" },
    { id: "parei", label: "Já não sigo" },
  ];

  const MOVIE_FILTERS: { id: MovieFilter; label: string }[] = [
    { id: "vistos", label: "Vistos" },
    { id: "para-ver", label: "Para ver" },
    { id: "todos", label: "Todos" },
  ];

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-10 pb-[calc(var(--dock-h)+5.5rem)]">

      {loading ? (
        <PosterGridBone count={9} />
      ) : showing > 0 ? (
        segment === "series" ? (
          showGroups ? (
            <div data-testid="library-grid">
              {showGroups.map((g) => (
                <section key={g.label}>
                  <StickySectionHeader
                    label={g.label}
                    count={g.items.length}
                    color={COR_ESTADO[g.label]}
                  />
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                    {g.items.map((s, i) => (
                      <ShowPoster key={s.uuid} show={s} index={i} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div
              className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4"
              data-testid="library-grid"
            >
              {filteredShows.map((s, i) => (
                <ShowPoster key={s.uuid} show={s} index={i} />
              ))}
            </div>
          )
        ) : movieGroups ? (
          <div data-testid="library-grid">
            {movieGroups.map((g) => (
              <section key={g.label}>
                <StickySectionHeader label={g.label} count={g.items.length} />
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                  {g.items.map((m, i) => (
                    <MovieCard key={m.key} movie={m} index={i} onChanged={reloadMovies} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div
            className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4"
            data-testid="library-grid"
          >
            {filteredMovies.map((m, i) => (
              <MovieCard key={m.key} movie={m} index={i} onChanged={reloadMovies} />
            ))}
          </div>
        )
      ) : (
        <EmptyState
          query={q ? query.trim() : null}
          segment={segment}
          filter={filter}
          onClearFilter={() => setParams({ filtro: null, decada: null })}
        />
      )}

      {/* Adicionar o que ainda não tens — o catálogo do segmento onde estás */}
      {q && (
        <div className="mt-6 border-t border-line pt-5">
          {searched === null ? (
            <button
              onClick={() => void searchRemote()}
              disabled={remoteBusy}
              className={`flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full text-[15px] font-semibold transition active:scale-95 disabled:opacity-50 ${
                // sem nada na biblioteca, adicionar é a ação óbvia — deixa de
                // ser um botão discreto no fundo da página
                showing === 0
                  ? "bg-ink text-tube hover:brightness-110"
                  : "border border-line text-dim hover:border-ink hover:text-ink"
              }`}
              data-testid="remote-search-button"
            >
              {remoteBusy && (
                <span className="spinner h-4 w-4 rounded-full border-2 border-line border-t-ink" />
              )}
              {remoteBusy
                ? "A procurar…"
                : segment === "series"
                  ? `Procurar “${query.trim()}” em todas as séries`
                  : `Procurar “${query.trim()}” em todos os filmes`}
            </button>
          ) : (
            <>
              <SectionHeader
                label={segment === "series" ? "Séries encontradas" : "Filmes encontrados"}
              />
              <div className="mt-3 flex flex-col gap-3" data-testid="search-results">
                {searched.length === 0 && !remoteError && (
                  <p className="text-center text-[15px] text-dim">
                    Sem resultados. Tenta o nome original
                    {segment === "series" ? " da série" : " do filme"}.
                  </p>
                )}
                {segment === "series"
                  ? remote?.map((result) => (
                      <ResultCard
                        key={`${result.provider}-${result.providerId}`}
                        result={result}
                      />
                    ))
                  : remoteMovies?.map((result) => (
                      <MovieResultCard
                        key={result.tmdbId}
                        result={result}
                        onAdded={reloadMovies}
                      />
                    ))}
              </div>
            </>
          )}
          {remoteError && (
            <p className="page-enter mt-3 text-center text-[15px] text-danger">{remoteError}</p>
          )}
        </div>
      )}

      <LibraryControls
        segment={segment}
        counts={{ series: shows?.length ?? 0, filmes: movies?.length ?? 0 }}
        onSegment={changeSegment}
        onSearch={() => setPesquisaAberta(true)}
        onFilters={() => setFiltrosAbertos(true)}
        filtrosAtivos={
          segment === "series"
            ? filter !== "tudo" || seriesSort !== "vistos"
            : movieFilter !== "vistos" || movieSort !== "vistos" || decade !== null
        }
      />

      {/* A pesquisa sobe por cima de tudo: enquanto se procura, procurar é a
          única coisa que interessa no ecrã. */}
      <SheetPanel
        titulo="Procurar"
        aberto={pesquisaAberta}
        onFechar={() => setPesquisaAberta(false)}
      >
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Procurar na biblioteca…"
            className="min-h-12 w-full rounded-full border border-line bg-tube py-2.5 pl-10 pr-4 outline-none transition-colors focus:border-ink"
            data-testid="search-input"
          />
        </div>
        <p className="mt-3 text-[15px] text-dim">
          {q
            ? `${showing} ${segment === "series" ? "séries" : "filmes"} na biblioteca`
            : "Escreve para filtrar o que já tens. Procurar títulos novos é o passo seguinte, no fim da lista."}
        </p>
        {q && (
          <button
            onClick={() => setPesquisaAberta(false)}
            className="mt-4 flex min-h-12 w-full cursor-pointer items-center justify-center rounded-full bg-ink text-[15px] font-semibold text-tube transition active:scale-95"
          >
            Ver resultados
          </button>
        )}
      </SheetPanel>

      <SheetPanel
        titulo="Filtros e ordenação"
        aberto={filtrosAbertos}
        onFechar={() => setFiltrosAbertos(false)}
      >
        {segment === "series" && (
          <>
            <SectionHeader label="Mostrar" />
            <div className="mt-3 flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setParams({ filtro: f.id === "tudo" ? null : f.id })}
                  className={`flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-[15px] transition active:scale-95 ${
                    filter === f.id
                      ? "border-ink bg-ink text-tube"
                      : "border-line text-dim hover:border-ink hover:text-ink"
                  }`}
                >
                  {f.label}
                  <span
                    className={`ep-code text-xs ${filter === f.id ? "opacity-70" : "text-faint"}`}
                  >
                    {counts[f.id]}
                  </span>
                </button>
              ))}
            </div>
            <SectionHeader label="Ordenar por" className="mt-6" />
            <div className="mt-3 flex flex-wrap gap-2">
              {SERIES_SORTS.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setParams({ ordem: o.id === "vistos" ? null : o.id })}
                  className={`min-h-11 cursor-pointer rounded-full border px-3.5 text-[15px] transition active:scale-95 ${
                    seriesSort === o.id
                      ? "border-ink bg-ink text-tube"
                      : "border-line text-dim hover:border-ink hover:text-ink"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </>
        )}

        {segment === "filmes" && (
          <>
            <SectionHeader label="Mostrar" />
            <div className="mt-3 flex flex-wrap gap-2">
              {MOVIE_FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setParams({ filtro: f.id === "vistos" ? null : f.id })}
                  className={`flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-[15px] transition active:scale-95 ${
                    movieFilter === f.id
                      ? "border-ink bg-ink text-tube"
                      : "border-line text-dim hover:border-ink hover:text-ink"
                  }`}
                >
                  {f.label}
                  <span
                    className={`ep-code text-xs ${movieFilter === f.id ? "opacity-70" : "text-faint"}`}
                  >
                    {movieCounts[f.id]}
                  </span>
                </button>
              ))}
            </div>
            <SectionHeader label="Ordenar por" className="mt-6" />
            <div className="mt-3 flex flex-wrap gap-2">
              {MOVIE_SORTS.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setParams({ ordem: o.id === "vistos" ? null : o.id })}
                  className={`min-h-11 cursor-pointer rounded-full border px-3.5 text-[15px] transition active:scale-95 ${
                    movieSort === o.id
                      ? "border-ink bg-ink text-tube"
                      : "border-line text-dim hover:border-ink hover:text-ink"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {decades.length > 1 && (
              <>
                <SectionHeader label="Década" className="mt-6" />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => setParams({ decada: null })}
                    className={`min-h-11 cursor-pointer rounded-full border px-3.5 text-[15px] transition active:scale-95 ${
                      decade === null
                        ? "border-ink bg-ink text-tube"
                        : "border-line text-dim hover:border-ink hover:text-ink"
                    }`}
                  >
                    Todas
                  </button>
                  {decades.map((d) => (
                    <button
                      key={d}
                      onClick={() => setParams({ decada: d === decade ? null : String(d) })}
                      className={`ep-code min-h-11 cursor-pointer rounded-full border px-3.5 text-sm transition active:scale-95 ${
                        decade === d
                          ? "border-ink bg-ink text-tube"
                          : "border-line text-dim hover:border-ink hover:text-ink"
                      }`}
                    >
                      {decadeLabel(d)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* As Listas perderam a entrada que tinham no cabeçalho quando o
            cabeçalho saiu de cena (Fase T). Ficam aqui — são outra forma de
            ver a mesma biblioteca, não um filtro dela, mas é o painel que
            sobrou depois do cromo todo ter descido para a barra flutuante. */}
        <SectionHeader label="Coleções" className="mt-6" />
        <Link
          href="/listas"
          className="mt-3 flex min-h-11 w-full cursor-pointer items-center justify-between rounded-full border border-line px-4 text-[15px] text-dim transition hover:border-ink hover:text-ink"
        >
          As tuas listas
          <span className="text-faint">→</span>
        </Link>
      </SheetPanel>
    </main>
  );
}

// useSearchParams exige uma fronteira de Suspense para a rota poder ser
// pré-renderizada; sem ela o build falha.
export default function LibraryPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-2xl px-4 py-8">
          <TitleBone />
          <PosterGridBone count={9} />
        </main>
      }
    >
      <LibraryContent />
    </Suspense>
  );
}
