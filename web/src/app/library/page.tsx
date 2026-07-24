"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getShow, putShow, updateShow } from "@/lib/db";
import { loadShows, type ShowWithProgress } from "@/lib/shows";
import { searchShows, type MetaSearchResult } from "@/lib/metadata";
import PosterCard from "@/components/PosterCard";
import { TvIcon, CheckIcon, SearchIcon } from "@/components/icons";

type FollowState = "idle" | "following" | "done";

// Sugestões para o estado vazio da pesquisa — populares e variadas
const SUGGESTIONS = ["One Piece", "Breaking Bad", "Friends", "Demon Slayer", "The Boys"];

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

function ResultSkeleton() {
  return (
    <div className="flex gap-3 rounded-2xl border border-line bg-panel p-3">
      <div className="h-24 w-16 shrink-0 animate-pulse rounded-lg bg-raised" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-4 w-2/3 animate-pulse rounded bg-raised" />
        <div className="h-3 w-full animate-pulse rounded bg-raised" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-raised" />
      </div>
    </div>
  );
}

export default function LibraryPage() {
  const [shows, setShows] = useState<ShowWithProgress[] | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MetaSearchResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadShows().then(setShows);
  }, []);

  const search = useCallback(
    async (term?: string) => {
      const q = (term ?? query).trim();
      if (!q) return;
      if (term) setQuery(term);
      setBusy(true);
      setError(null);
      try {
        setResults(await searchShows(q));
      } catch {
        setResults([]);
        setError("Não foi possível pesquisar — verifica a ligação à internet.");
      } finally {
        setBusy(false);
      }
    },
    [query],
  );

  const grid = (list: ShowWithProgress[]) => (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
      {list.map((s) => (
        <PosterCard
          key={s.uuid}
          href={`/series/${s.uuid}`}
          name={s.name}
          posterPath={s.posterPath}
          watched={s.watchedCount}
          total={s.totalEpisodes}
          status={s.status}
        />
      ))}
    </div>
  );

  const watching = shows?.filter((s) => s.followed && !s.archived) ?? [];
  const watchlist = shows?.filter((s) => s.inWatchlist && !s.followed) ?? [];
  const stopped = shows?.filter((s) => !s.followed && !s.inWatchlist) ?? [];
  const archived = shows?.filter((s) => s.followed && s.archived) ?? [];

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="font-display text-2xl font-bold [font-stretch:110%]">Biblioteca</h1>

      <div className="mt-4 flex items-center gap-2">
        <form
          className="flex flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void search();
          }}
        >
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Procurar séries…"
              className="w-full rounded-full border border-line bg-panel py-2.5 pl-10 pr-4 outline-none transition-colors focus:border-ink"
              data-testid="search-input"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-ink px-5 font-semibold text-tube transition hover:brightness-110 active:scale-95 disabled:opacity-50"
          >
            {busy && (
              <span className="spinner h-4 w-4 rounded-full border-2 border-tube/30 border-t-tube" />
            )}
            Procurar
          </button>
        </form>
        <Link
          href="/movies"
          className="flex min-h-11 shrink-0 cursor-pointer items-center rounded-full border border-line px-4 text-sm font-medium text-dim transition hover:bg-raised hover:text-ink"
        >
          Filmes
        </Link>
      </div>

      <Link
        href="/triagem"
        className="ep-card ep-card-hover mt-3 flex items-center gap-3 p-4"
      >
        <span className="bars flex h-10 w-10 shrink-0 items-center justify-center rounded-full" />
        <span className="min-w-0 flex-1">
          <span className="block font-display font-semibold text-ink">
            Triagem por swipe
          </span>
          <span className="block text-xs text-dim">
            Passa em revista os episódios pendentes, um a um
          </span>
        </span>
        <span className="text-faint">→</span>
      </Link>

      {error && (
        <p className="page-enter mt-6 text-center text-sm text-danger">{error}</p>
      )}

      {!results && !busy && (
        <div className="mt-6 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => void search(s)}
              className="cursor-pointer rounded-full border border-line bg-panel px-4 py-1.5 text-sm text-dim transition hover:border-ink hover:text-ink active:scale-95"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {busy && !results && (
        <div className="mt-6 flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <ResultSkeleton key={i} />
          ))}
        </div>
      )}

      {results && !busy && (
        <div className="mt-6 flex flex-col gap-3" data-testid="search-results">
          {results.length === 0 && !error && (
            <p className="text-center text-dim">
              Sem resultados para &ldquo;{query.trim()}&rdquo;. Tenta o nome original da
              série.
            </p>
          )}
          {results.map((result) => (
            <ResultCard key={`${result.provider}-${result.providerId}`} result={result} />
          ))}
          <button
            onClick={() => {
              setResults(null);
              setQuery("");
            }}
            className="mx-auto mt-2 cursor-pointer text-sm text-dim hover:text-ink hover:underline"
          >
            ← Voltar à biblioteca
          </button>
        </div>
      )}

      {!results && shows === null && (
        <div className="mt-10 space-y-6">
          <div className="h-6 w-32 animate-pulse rounded-lg bg-panel" />
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="aspect-2/3 animate-pulse rounded-2xl bg-panel" />
            ))}
          </div>
        </div>
      )}

      {!results && shows !== null && shows.length === 0 && (
        <p className="mt-10 text-center text-sm text-dim">
          Ainda não segues nenhuma série — procura acima para começar.
        </p>
      )}

      {!results && watching.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-lg font-semibold">As minhas séries</h2>
          <div className="mt-3">{grid(watching)}</div>
        </section>
      )}
      {!results && watchlist.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-lg font-semibold">Para ver</h2>
          <div className="mt-3">{grid(watchlist)}</div>
        </section>
      )}
      {!results && stopped.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-lg font-semibold text-dim">Já não sigo</h2>
          <div className="mt-3">{grid(stopped)}</div>
        </section>
      )}
      {!results && archived.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-lg font-semibold text-dim">Arquivadas</h2>
          <div className="mt-3">{grid(archived)}</div>
        </section>
      )}
    </main>
  );
}
