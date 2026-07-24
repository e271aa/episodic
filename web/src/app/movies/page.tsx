"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getImportMeta, getMovies, updateMovie, type StoredMovie } from "@/lib/db";
import { enrichMovie } from "@/lib/metadata";
import { imageUrl } from "@/lib/tmdb";
import { ClapperboardIcon } from "@/components/icons";

interface MoviesState {
  movies: StoredMovie[];
  hasImported: boolean;
}

function byWatchedDesc(a: StoredMovie, b: StoredMovie): number {
  return b.watchedAt.localeCompare(a.watchedAt);
}

function MovieCard({ movie }: { movie: StoredMovie }) {
  const src = imageUrl(movie.posterPath, "w342");
  const year = movie.releaseDate?.slice(0, 4);
  return (
    <Link href={`/movies/${movie.key}`} className="group block cursor-pointer active:scale-[0.97]">
      <div className="relative aspect-2/3 overflow-hidden rounded-2xl bg-panel shadow-md shadow-black/30 transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lg group-hover:ring-2 group-hover:ring-ink/60">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- posters já vêm dimensionados
          <img
            src={src}
            alt={movie.name}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-raised p-2 text-center font-display text-sm font-bold text-dim">
            {movie.name}
          </div>
        )}
      </div>
      <p className="mt-1.5 truncate text-sm font-medium">{movie.name}</p>
      <p className="ep-code truncate text-xs text-dim">
        {year ? `${year} · ` : ""}visto {movie.watchedAt.slice(0, 10)}
      </p>
    </Link>
  );
}

export default function MoviesPage() {
  const [state, setState] = useState<MoviesState | null>(null);
  const enriching = useRef(false);

  useEffect(() => {
    void (async () => {
      const [list, meta] = await Promise.all([getMovies(), getImportMeta()]);
      setState({ movies: list.sort(byWatchedDesc), hasImported: meta !== null });

      // Completa posters em falta via TMDB (quando há chave), persistindo —
      // nas visitas seguintes já está tudo em cache local
      if (enriching.current) return;
      enriching.current = true;
      try {
        let changed = false;
        for (const movie of list) {
          if (movie.posterPath) continue;
          const patch = await enrichMovie(movie);
          if (patch) {
            await updateMovie(movie.key, patch);
            changed = true;
          }
        }
        if (changed) {
          const fresh = await getMovies();
          setState((current) =>
            current ? { ...current, movies: fresh.sort(byWatchedDesc) } : current,
          );
        }
      } finally {
        enriching.current = false;
      }
    })();
  }, []);

  if (state === null) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <div className="h-8 w-32 animate-pulse rounded-lg bg-panel" />
      </main>
    );
  }

  const { movies, hasImported } = state;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="font-display text-2xl font-bold">Filmes</h1>
      {movies.length > 0 && (
        <p className="ep-code mt-1 text-xs text-dim">{movies.length} vistos</p>
      )}

      {movies.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center">
          <ClapperboardIcon className="h-12 w-12 text-faint" />
          {hasImported ? (
            // Biblioteca importada antes do suporte a filmes — basta reimportar
            <>
              <p className="mt-4 max-w-sm font-display font-semibold">
                Falta só reimportar o export
              </p>
              <p className="mt-2 max-w-sm text-sm text-dim">
                Os teus filmes estão no ficheiro antigo do export do TV Time, que
                agora já sabemos ler. Reimporta o ZIP completo e aparecem aqui
                com posters e tudo.
              </p>
              <Link
                href="/import"
                className="mt-6 inline-block cursor-pointer rounded-full bg-ink px-6 py-3 font-semibold text-tube transition hover:brightness-110 active:scale-95"
              >
                Reimportar do TV Time
              </Link>
            </>
          ) : (
            <>
              <p className="mt-4 max-w-sm text-dim">
                Ainda não há filmes na tua biblioteca.
              </p>
              <Link
                href="/import"
                className="mt-6 inline-block cursor-pointer rounded-full bg-ink px-6 py-3 font-semibold text-tube transition hover:brightness-110 active:scale-95"
              >
                Importar do TV Time
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {movies.map((movie) => (
            <MovieCard key={movie.key} movie={movie} />
          ))}
        </div>
      )}
    </main>
  );
}
