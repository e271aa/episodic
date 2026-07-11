"use client";

import { useCallback, useState } from "react";
import { getShow, putShow, updateShow } from "@/lib/db";
import { searchShows, type MetaSearchResult } from "@/lib/metadata";
import { TvIcon, CheckIcon } from "@/components/icons";

type FollowState = "idle" | "following" | "done";

// Sugestões para o estado vazio — populares e variadas (anime, drama, sitcom)
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
        <p className="mt-1 line-clamp-2 text-xs text-dim">
          {result.overview}
        </p>
        <button
          onClick={() => void follow()}
          disabled={state !== "idle"}
          className={`mt-2 flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full px-4 py-1 text-sm font-semibold transition active:scale-95 ${
            state === "done"
              ? "bg-raised text-dim"
              : "bg-signal text-on-signal hover:brightness-110"
          }`}
        >
          {state === "following" && (
            <span className="spinner h-3.5 w-3.5 rounded-full border-2 border-on-signal/30 border-t-on-signal" />
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

export default function ExplorePage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MetaSearchResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-display text-2xl font-bold">Explorar</h1>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Procurar séries…"
          className="flex-1 rounded-full border border-line bg-panel px-5 py-2.5 outline-none transition-colors focus:border-signal"
          data-testid="search-input"
        />
        <button
          type="submit"
          disabled={busy}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-full bg-signal px-5 py-2.5 font-semibold text-on-signal transition hover:brightness-110 active:scale-95 disabled:opacity-50"
        >
          {busy && (
            <span className="spinner h-4 w-4 rounded-full border-2 border-on-signal/30 border-t-on-signal" />
          )}
          Procurar
        </button>
      </form>

      {error && (
        <p className="page-enter mt-6 text-center text-sm text-danger">{error}</p>
      )}

      {/* Antes da primeira pesquisa: convite com sugestões clicáveis */}
      {!results && !busy && (
        <div className="mt-12 text-center">
          <p className="ep-code text-xs tracking-[0.2em] text-faint">
            PRÓXIMA MARATONA
          </p>
          <p className="mt-2 text-dim">
            Procura qualquer série — ou começa por uma destas:
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => void search(s)}
                className="cursor-pointer rounded-full border border-line bg-panel px-4 py-1.5 text-sm text-dim transition hover:border-signal hover:text-signal active:scale-95"
              >
                {s}
              </button>
            ))}
          </div>
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
              Sem resultados para “{query.trim()}”. Tenta o nome original da série.
            </p>
          )}
          {results.map((result) => (
            <ResultCard key={`${result.provider}-${result.providerId}`} result={result} />
          ))}
        </div>
      )}
    </main>
  );
}
