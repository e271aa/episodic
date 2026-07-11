"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMovies, type StoredMovie } from "@/lib/db";
import { ClapperboardIcon } from "@/components/icons";

export default function MoviesPage() {
  const [movies, setMovies] = useState<StoredMovie[] | null>(null);

  useEffect(() => {
    void getMovies().then((list) =>
      setMovies(list.sort((a, b) => b.watchedAt.localeCompare(a.watchedAt))),
    );
  }, []);

  if (movies === null) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <div className="h-8 w-32 animate-pulse rounded-lg bg-panel" />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="font-display text-2xl font-bold">Filmes</h1>

      {movies.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center">
          <ClapperboardIcon className="h-12 w-12 text-faint" />
          <p className="mt-4 max-w-sm text-dim">
            Ainda não há filmes na tua biblioteca. Quando importares o export da tua
            conta principal do TV Time, os filmes vistos aparecem aqui.
          </p>
          <Link
            href="/import"
            className="mt-6 inline-block cursor-pointer rounded-full bg-signal px-6 py-3 font-semibold text-on-signal transition hover:brightness-110"
          >
            Importar do TV Time
          </Link>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-2">
          {movies.map((movie) => (
            <div
              key={movie.key}
              className="flex items-center justify-between rounded-2xl border border-line bg-panel px-4 py-3"
            >
              <p className="font-medium">{movie.name}</p>
              <p className="ep-code text-sm text-dim">
                {movie.watchedAt.slice(0, 10)}
              </p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
