"use client";

import { useCallback, useState } from "react";
import { deleteMovie, getMovie, putMovie } from "@/lib/db";
import type { MetaMovieResult } from "@/lib/metadata";
import { pushUndo } from "@/lib/undo";
import Poster from "@/components/Poster";
import { CheckIcon, ClapperboardIcon } from "@/components/icons";

type FollowState = "idle" | "following" | "done";

/**
 * Resultado da pesquisa remota de filmes, na Biblioteca. Um filme não se
 * "segue" — ou já o viste ou não, por isso a ação é marcá-lo como visto hoje
 * (a data edita-se depois na página do filme).
 */
export default function MovieResultCard({
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
