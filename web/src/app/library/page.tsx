"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  deleteMovie,
  getMovie,
  getMovies,
  getShow,
  putMovie,
  putShow,
  updateShow,
  type StoredMovie,
} from "@/lib/db";
import { loadShows, type ShowWithProgress } from "@/lib/shows";
import {
  searchMovies,
  searchShows,
  type MetaMovieResult,
  type MetaSearchResult,
} from "@/lib/metadata";
import { imageUrl } from "@/lib/tmdb";
import { pushUndo } from "@/lib/undo";
import PosterCard from "@/components/PosterCard";
import {
  TvIcon,
  CheckIcon,
  ClapperboardIcon,
  SearchIcon,
  SortIcon,
} from "@/components/icons";

type Segment = "series" | "filmes";
type SeriesFilter = "tudo" | "a-ver" | "completas" | "para-ver" | "arquivadas" | "parei";
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

// Normaliza para pesquisar sem acentos nem maiúsculas — "pokemon" encontra "Pokémon"
function norm(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function ResultCard({ result }: { result: MetaSearchResult }) {
  const [state, setState] = useState<FollowState>("idle");
  const uuid = `${result.provider}-${result.providerId}`;

  const follow = useCallback(async () => {
    setState("following");
    const existing = await getShow(uuid);
    if (existing) {
      await updateShow(uuid, { followed: true });
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
        followed: true,
        inWatchlist: false,
        archived: false,
        addedAt: new Date().toISOString(),
      });
    }
    setState("done");
  }, [result, uuid]);

  return (
    <div className="page-enter flex gap-3 rounded-2xl border border-line bg-panel p-3">
      {result.posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={result.posterUrl}
          alt=""
          className="h-24 w-16 shrink-0 rounded-lg object-cover"
        />
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
        <p className="mt-1 line-clamp-2 text-xs text-dim">{result.overview}</p>
        <button
          onClick={() => void follow()}
          disabled={state !== "idle"}
          className={`mt-2 flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition active:scale-95 ${
            state === "done" ? "bg-raised text-dim" : "bg-ink text-tube hover:brightness-110"
          }`}
        >
          {state === "following" && (
            <span className="spinner h-3.5 w-3.5 rounded-full border-2 border-tube/30 border-t-tube" />
          )}
          {state === "done" && <CheckIcon className="check-pop h-3.5 w-3.5" />}
          {state === "done" ? "A seguir" : "Seguir"}
        </button>
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

  const add = useCallback(async () => {
    setState("following");
    const existing = await getMovie(key);
    if (!existing) {
      await putMovie({
        key,
        name: result.name,
        watchedAt: new Date().toISOString(),
        dateIsExact: true,
        releaseDate: result.releaseDate,
        tmdbId: result.tmdbId,
        posterPath: result.posterPath,
      });
    }
    setState("done");
    onAdded();
    // só se anula o que esta ação criou — um filme que já lá estava fica
    if (!existing) {
      pushUndo({
        label: "Filme marcado como visto",
        detail: result.name,
        undo: async () => {
          await deleteMovie(key);
          setState("idle");
          onAdded();
        },
      });
    }
  }, [key, result, onAdded]);

  return (
    <div className="page-enter flex gap-3 rounded-2xl border border-line bg-panel p-3">
      {result.posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={result.posterUrl}
          alt=""
          className="h-24 w-16 shrink-0 rounded-lg object-cover"
        />
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
        <p className="mt-1 line-clamp-2 text-xs text-dim">{result.overview}</p>
        <button
          onClick={() => void add()}
          disabled={state !== "idle"}
          className={`mt-2 flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition active:scale-95 ${
            state === "done" ? "bg-raised text-dim" : "bg-ink text-tube hover:brightness-110"
          }`}
        >
          {state === "following" && (
            <span className="spinner h-3.5 w-3.5 rounded-full border-2 border-tube/30 border-t-tube" />
          )}
          {state === "done" && <CheckIcon className="check-pop h-3.5 w-3.5" />}
          {state === "done" ? "Na biblioteca" : "Marcar visto"}
        </button>
      </div>
    </div>
  );
}

function MovieCard({ movie }: { movie: StoredMovie }) {
  const src = imageUrl(movie.posterPath, "w342");
  const year = movie.releaseDate?.slice(0, 4);
  return (
    <Link
      href={`/movies/${movie.key}`}
      className="group block cursor-pointer active:scale-[0.97]"
    >
      <div className="relative aspect-2/3 overflow-hidden rounded-2xl bg-panel shadow-md shadow-black/30 transition duration-200 group-hover:-translate-y-0.5 group-hover:ring-2 group-hover:ring-ink/60">
        {/* nome por baixo da capa — ver nota em PosterCard */}
        <div className="absolute inset-0 flex items-center justify-center bg-raised p-2 text-center font-display text-sm font-bold text-dim">
          {movie.name}
        </div>
        {src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={movie.name}
            loading="lazy"
            className="relative h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        )}
      </div>
      <p className="mt-1.5 truncate text-sm font-medium">{movie.name}</p>
      <p className="ep-code truncate text-xs text-dim">
        {year ?? movie.watchedAt.slice(0, 4)}
      </p>
    </Link>
  );
}

/**
 * A ordem tem de estar sempre à vista — dizer "A–Z" ou "Vistos há pouco" em
 * texto resolve a dúvida sem ser preciso abrir nada; o ícone só muda.
 */
function SortMenu<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.id === value);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex cursor-pointer items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs text-dim transition hover:border-ink hover:text-ink active:scale-95"
        data-testid="sort-button"
      >
        <SortIcon className="h-3.5 w-3.5" />
        {current?.label}
      </button>
      {open && (
        <>
          <button
            aria-label="Fechar"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-2xl border border-line bg-panel shadow-lg shadow-black/40">
            {options.map((o) => (
              <button
                key={o.id}
                onClick={() => {
                  onChange(o.id);
                  setOpen(false);
                }}
                className={`flex w-full cursor-pointer items-center justify-between gap-2 px-3.5 py-2.5 text-left text-sm transition hover:bg-raised ${
                  o.id === value ? "text-ink" : "text-dim"
                }`}
              >
                {o.label}
                {o.id === value && <CheckIcon className="h-4 w-4 shrink-0" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function LibraryPage() {
  const [shows, setShows] = useState<ShowWithProgress[] | null>(null);
  const [movies, setMovies] = useState<StoredMovie[] | null>(null);
  const [segment, setSegment] = useState<Segment>("series");
  const [filter, setFilter] = useState<SeriesFilter>("tudo");
  const [movieSort, setMovieSort] = useState<MovieSort>("vistos");
  const [seriesSort, setSeriesSort] = useState<SeriesSort>("vistos");
  const [decade, setDecade] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  // Pesquisa remota é secundária: só corre quando o utilizador a pede
  const [remote, setRemote] = useState<MetaSearchResult[] | null>(null);
  const [remoteMovies, setRemoteMovies] = useState<MetaMovieResult[] | null>(null);
  const [remoteBusy, setRemoteBusy] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);

  const reloadMovies = useCallback(() => {
    void getMovies().then((list) =>
      setMovies(list.sort((a, b) => b.watchedAt.localeCompare(a.watchedAt))),
    );
  }, []);

  useEffect(() => {
    void loadShows().then(setShows);
    void getMovies().then((list) =>
      setMovies(list.sort((a, b) => b.watchedAt.localeCompare(a.watchedAt))),
    );
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

  // Ano do filme: preferimos a estreia; sem ela, o ano em que o viste
  const movieYear = (m: StoredMovie): number =>
    Number((m.releaseDate ?? m.watchedAt).slice(0, 4));

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
    if (decade !== null) {
      list = list.filter((m) => {
        const year = movieYear(m);
        return year >= decade && year < decade + 10;
      });
    }
    if (q) list = list.filter((m) => norm(m.name).includes(q));
    const sorted = [...list];
    if (movieSort === "vistos") {
      sorted.sort((a, b) => b.watchedAt.localeCompare(a.watchedAt));
    } else if (movieSort === "recentes") {
      sorted.sort((a, b) => movieYear(b) - movieYear(a));
    } else if (movieSort === "antigos") {
      sorted.sort((a, b) => movieYear(a) - movieYear(b));
    } else {
      sorted.sort((a, b) => a.name.localeCompare(b.name, "pt"));
    }
    return sorted;
  }, [movies, q, decade, movieSort]);

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

  // Trocar de segmento também invalida: os resultados eram do outro catálogo
  const changeSegment = useCallback((id: Segment) => {
    setSegment(id);
    setRemote(null);
    setRemoteMovies(null);
    setRemoteError(null);
  }, []);

  const loading = shows === null || movies === null;
  const showing = segment === "series" ? filteredShows.length : filteredMovies.length;
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

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="font-display text-2xl font-bold [font-stretch:110%]">Biblioteca</h1>

      {/* Triagem em destaque — é a interação-assinatura, não mais um cartão a meio */}
      <Link
        href="/triagem"
        className="ep-card ep-card-hover mt-4 flex items-center gap-3 p-4"
      >
        <span className="bars flex h-11 w-11 shrink-0 items-center justify-center rounded-full" />
        <span className="min-w-0 flex-1">
          <span className="block font-display font-semibold text-ink">
            Triagem por swipe
          </span>
          <span className="block text-xs text-dim">
            Arrasta para marcares o que já viste, um episódio de cada vez
          </span>
        </span>
        <span className="text-faint">→</span>
      </Link>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link href="/estrear" className="ep-card ep-card-hover flex items-center gap-2 p-3">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink">A estrear</span>
            <span className="block text-xs text-dim">Próximos episódios</span>
          </span>
          <span className="text-faint">→</span>
        </Link>
        <Link href="/listas" className="ep-card ep-card-hover flex items-center gap-2 p-3">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink">Listas</span>
            <span className="block text-xs text-dim">As tuas coleções</span>
          </span>
          <span className="text-faint">→</span>
        </Link>
      </div>

      {/* Pesquisa: filtra ao vivo o que já tens; procurar novas é um segundo passo */}
      <div className="relative mt-5">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
        <input
          type="search"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Procurar na biblioteca…"
          className="min-h-11 w-full rounded-full border border-line bg-panel py-2.5 pl-10 pr-4 outline-none transition-colors focus:border-ink"
          data-testid="search-input"
        />
      </div>

      {/* Segmentos: séries e filmes lado a lado, não em páginas separadas */}
      <div className="mt-4 flex gap-1 rounded-full border border-line bg-panel p-1">
        {(
          [
            ["series", "Séries", shows?.length ?? 0],
            ["filmes", "Filmes", movies?.length ?? 0],
          ] as const
        ).map(([id, label, total]) => (
          <button
            key={id}
            onClick={() => changeSegment(id)}
            aria-pressed={segment === id}
            className={`flex min-h-10 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full text-sm font-semibold transition ${
              segment === id ? "bg-ink text-tube" : "text-dim hover:text-ink"
            }`}
          >
            {label}
            <span className={`ep-code text-xs ${segment === id ? "opacity-70" : "text-faint"}`}>
              {total}
            </span>
          </button>
        ))}
      </div>

      {segment === "series" && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition active:scale-95 ${
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
      )}

      {segment === "filmes" && decades.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setDecade(null)}
            className={`shrink-0 cursor-pointer rounded-full border px-3.5 py-1.5 text-sm transition active:scale-95 ${
              decade === null
                ? "border-ink bg-ink text-tube"
                : "border-line text-dim hover:border-ink hover:text-ink"
            }`}
          >
            Todas as décadas
          </button>
          {decades.map((d) => (
            <button
              key={d}
              onClick={() => setDecade(d === decade ? null : d)}
              className={`ep-code shrink-0 cursor-pointer rounded-full border px-3.5 py-1.5 text-sm transition active:scale-95 ${
                decade === d
                  ? "border-ink bg-ink text-tube"
                  : "border-line text-dim hover:border-ink hover:text-ink"
              }`}
            >
              {d}s
            </button>
          ))}
        </div>
      )}

      {!loading && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="ep-code text-xs text-faint">
            {showing} {segment === "series" ? "séries" : "filmes"}
          </p>
          {segment === "series" ? (
            <SortMenu
              options={SERIES_SORTS}
              value={seriesSort}
              onChange={setSeriesSort}
            />
          ) : (
            <SortMenu options={MOVIE_SORTS} value={movieSort} onChange={setMovieSort} />
          )}
        </div>
      )}

      {loading ? (
        <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="aspect-2/3 animate-pulse rounded-2xl bg-panel" />
          ))}
        </div>
      ) : showing > 0 ? (
        <div
          className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5"
          data-testid="library-grid"
        >
          {segment === "series"
            ? filteredShows.map((s) => (
                <PosterCard
                  key={s.uuid}
                  href={`/series/${s.uuid}`}
                  name={s.name}
                  posterPath={s.posterPath}
                  watched={s.watchedCount}
                  total={s.totalEpisodes}
                  status={s.status}
                />
              ))
            : filteredMovies.map((m) => <MovieCard key={m.key} movie={m} />)}
        </div>
      ) : (
        <p className="mt-10 text-center text-sm text-dim">
          {q
            ? `Nada na tua biblioteca para “${query.trim()}”.`
            : "Nada nesta categoria."}
        </p>
      )}

      {/* Adicionar o que ainda não tens — o catálogo do segmento onde estás */}
      {q && (
        <div className="mt-6 border-t border-line pt-5">
          {searched === null ? (
            <button
              onClick={() => void searchRemote()}
              disabled={remoteBusy}
              className={`flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full text-sm font-semibold transition active:scale-95 disabled:opacity-50 ${
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
              <h2 className="font-display text-sm font-semibold uppercase tracking-[0.15em] text-dim [font-stretch:80%]">
                {segment === "series" ? "Séries encontradas" : "Filmes encontrados"}
              </h2>
              <div className="mt-3 flex flex-col gap-3" data-testid="search-results">
                {searched.length === 0 && !remoteError && (
                  <p className="text-center text-sm text-dim">
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
            <p className="page-enter mt-3 text-center text-sm text-danger">{remoteError}</p>
          )}
        </div>
      )}
    </main>
  );
}
