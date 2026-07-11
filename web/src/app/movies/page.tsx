"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getImportMeta, getMovies, type StoredMovie } from "@/lib/db";
import { ClapperboardIcon } from "@/components/icons";

interface MoviesState {
  movies: StoredMovie[];
  hasImported: boolean;
}

export default function MoviesPage() {
  const [state, setState] = useState<MoviesState | null>(null);

  useEffect(() => {
    void Promise.all([getMovies(), getImportMeta()]).then(([list, meta]) =>
      setState({
        movies: list.sort((a, b) => b.watchedAt.localeCompare(a.watchedAt)),
        hasImported: meta !== null,
      }),
    );
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

      {movies.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center">
          <ClapperboardIcon className="h-12 w-12 text-faint" />
          {hasImported ? (
            // Já importou: honestidade — os filmes do TV Time estão guardados
            // no export, mas precisam de um fornecedor de metadados de filmes
            <>
              <p className="mt-4 max-w-sm font-display font-semibold">
                Os teus filmes estão a caminho
              </p>
              <p className="mt-2 max-w-sm text-sm text-dim">
                O TV Time guardou-os no teu export e nada se perdeu — mas o
                fornecedor de metadados que usamos só cobre séries. Assim que
                ligarmos um fornecedor de filmes, aparecem aqui com posters e tudo.
              </p>
            </>
          ) : (
            <>
              <p className="mt-4 max-w-sm text-dim">
                Ainda não há filmes na tua biblioteca.
              </p>
              <Link
                href="/import"
                className="mt-6 inline-block cursor-pointer rounded-full bg-signal px-6 py-3 font-semibold text-on-signal transition hover:brightness-110 active:scale-95"
              >
                Importar do TV Time
              </Link>
            </>
          )}
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
