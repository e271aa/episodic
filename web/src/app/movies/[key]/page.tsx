"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getMovie, putMovie, updateMovie, type StoredMovie } from "@/lib/db";
import { getMovieDetails, type TmdbMovieDetails } from "@/lib/tmdb";
import { pushUndo } from "@/lib/undo";
import AddToListButton from "@/components/AddToListButton";
import Poster from "@/components/Poster";
import StreamingBadges from "@/components/StreamingBadges";
import { CheckIcon } from "@/components/icons";

function formatWatchedDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-PT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatRuntime(minutes: number | null): string | null {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export default function MoviePage() {
  const { key } = useParams<{ key: string }>();
  const [movie, setMovie] = useState<StoredMovie | null | undefined>(undefined);
  const [details, setDetails] = useState<TmdbMovieDetails | null>(null);

  useEffect(() => {
    void (async () => {
      const stored = await getMovie(key);
      setMovie(stored ?? null);
      if (!stored) return;

      // Filmes só têm tmdbId se já tiverem sido enriquecidos (aba Filmes);
      // aqui pedimos sempre os detalhes completos (sinopse, elenco de género,
      // duração) — não fazem parte do enriquecimento em massa por serem raramente vistos.
      if (stored.tmdbId) {
        try {
          const full = await getMovieDetails(stored.tmdbId);
          setDetails(full);
          if (!stored.posterPath && full.poster_path) {
            await updateMovie(key, { posterPath: full.poster_path });
            setMovie((m) => (m ? { ...m, posterPath: full.poster_path } : m));
          }
        } catch {
          // sem ligação ou filme removido do TMDB — fica só com os dados locais
        }
      }
    })();
  }, [key]);

  if (movie === undefined) {
    return (
      <main className="mx-auto w-full max-w-2xl">
        <div className="h-44 animate-pulse bg-panel sm:h-56" />
        <div className="space-y-3 px-4 pt-6">
          <div className="h-6 w-48 animate-pulse rounded-lg bg-panel" />
          <div className="h-4 w-32 animate-pulse rounded-lg bg-panel" />
        </div>
      </main>
    );
  }

  if (movie === null) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-dim">Filme não encontrado.</p>
        <Link
          href="/library?tipo=filmes"
          className="mt-4 inline-block cursor-pointer text-ink underline"
        >
          Voltar aos filmes
        </Link>
      </main>
    );
  }

  const backdropPath = details?.backdrop_path ?? null;
  const posterPath = movie.posterPath ?? null;
  const year = (details?.release_date ?? movie.releaseDate)?.slice(0, 4);
  const runtime = formatRuntime(details?.runtime ?? null);
  const metaBits = [year, runtime, details?.genres.map((g) => g.name).join(" · ")].filter(
    Boolean,
  );

  const markWatched = async () => {
    const watchedAt = new Date().toISOString();
    await putMovie({ ...movie, watchedAt });
    setMovie((m) => (m ? { ...m, watchedAt } : m));
    pushUndo({
      label: "Filme marcado como visto",
      detail: movie.name,
      undo: async () => {
        await putMovie({ ...movie, watchedAt: null });
        setMovie((m) => (m ? { ...m, watchedAt: null } : m));
      },
    });
  };

  return (
    <main className="mx-auto w-full max-w-2xl pb-8">
      <div className="relative h-44 sm:h-56">
        {backdropPath ? (
          <>
            <Poster
              path={backdropPath}
              alt=""
              size="w780"
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-tube via-tube/40 to-transparent" />
          </>
        ) : (
          <div className="h-full w-full bg-gradient-to-r from-raised to-panel" />
        )}
        <div className="bars absolute inset-x-0 top-0 h-[3px]" />
        <Link
          href="/library?tipo=filmes"
          className="absolute left-3 top-3 cursor-pointer rounded-full bg-black/50 px-3 py-1.5 text-sm text-white backdrop-blur"
        >
          ← Filmes
        </Link>
      </div>

      {/* relative: sem isto, o gradiente absoluto da subcapa pinta por cima do poster */}
      <div className="relative px-4">
        <div className="-mt-10 flex items-end gap-4">
          {posterPath ? (
            <div className="relative aspect-2/3 w-24 shrink-0 overflow-hidden rounded-xl shadow-lg">
              <Poster path={posterPath} alt={movie.name} fill sizes="96px" priority className="object-cover" />
            </div>
          ) : (
            <div className="flex h-36 w-24 shrink-0 items-center justify-center rounded-xl bg-raised p-2 text-center font-display text-sm font-bold text-dim shadow-lg">
              {movie.name}
            </div>
          )}
          <div className="min-w-0 flex-1 pb-1">
            <h1 className="font-display text-xl font-bold leading-tight">{movie.name}</h1>
            {metaBits.length > 0 && (
              <p className="ep-code mt-1 truncate text-xs text-dim">{metaBits.join("  ·  ")}</p>
            )}
            <p className="ep-code mt-1 text-sm text-dim">
              {movie.watchedAt ? `Visto a ${formatWatchedDate(movie.watchedAt)}` : "Na lista para ver"}
            </p>
          </div>
        </div>

        {!movie.watchedAt && (
          <button
            onClick={() => void markWatched()}
            className="mt-4 flex w-full cursor-pointer items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-left text-tube transition hover:brightness-110 active:scale-[0.99]"
          >
            <CheckIcon className="h-6 w-6 shrink-0" />
            <span className="text-sm font-semibold">Marcar como visto</span>
          </button>
        )}

        <div className="mt-3">
          <AddToListButton kind="movie" refId={key} />
        </div>

        <StreamingBadges kind="movie" tmdbId={movie.tmdbId} />

        {details?.tagline && (
          <p className="mt-5 font-display italic text-dim">
            &ldquo;{details.tagline}&rdquo;
          </p>
        )}

        <section className="mt-4">
          {details?.overview ? (
            <p className="text-sm leading-relaxed text-dim">{details.overview}</p>
          ) : movie.tmdbId ? (
            <p className="text-sm text-dim">A carregar sinopse…</p>
          ) : (
            <p className="text-sm text-dim">
              Sem sinopse disponível — este filme ainda não foi encontrado na TMDB.
            </p>
          )}
        </section>

        {movie.tmdbId && (
          <a
            href={`https://www.themoviedb.org/movie/${movie.tmdbId}`}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block cursor-pointer text-sm text-ink hover:underline"
          >
            Ver na TMDB ↗
          </a>
        )}
      </div>
    </main>
  );
}
