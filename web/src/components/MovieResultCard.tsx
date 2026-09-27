"use client";

import { useCallback, useEffect, useState } from "react";
import { deleteMovie, putMovie, type StoredMovie } from "@/lib/db";
import { filmeExistente, juntarNomes } from "@/lib/existente";
import type { MetaMovieResult } from "@/lib/metadata";
import { pushUndo } from "@/lib/undo";
import Poster from "@/components/Poster";
import { CheckIcon, ClapperboardIcon } from "@/components/icons";

type FollowState = "idle" | "following" | "done";

/**
 * Resultado da pesquisa remota de filmes, na Biblioteca. Um filme não se
 * "segue" — ou já o viste ou não, por isso a ação é marcá-lo como visto hoje
 * (a data edita-se depois na página do filme).
 *
 * Antes de mostrar botões, pergunta se o filme já lá está. Sem isto, um filme
 * importado do TV Time aparecia aqui como novo — e "Marcar visto" criava uma
 * segunda cópia, deixando o original em "para ver" para sempre.
 */
export default function MovieResultCard({
  result,
  onAdded,
}: {
  result: MetaMovieResult;
  onAdded: () => void;
}) {
  const [state, setState] = useState<FollowState>("idle");
  /** undefined = ainda a ver; null = não está na biblioteca */
  const [existente, setExistente] = useState<StoredMovie | null | undefined>(undefined);
  const procura = {
    tmdbId: result.tmdbId,
    nomes: [result.name, result.originalName],
    ano: result.year ? Number(result.year) : null,
  };

  useEffect(() => {
    let vivo = true;
    void filmeExistente(procura).then((m) => {
      if (vivo) setExistente(m);
    });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.tmdbId]);

  const add = useCallback(
    async (watched: boolean) => {
      setState("following");
      // outra vez, no momento do toque: pode ter entrado entretanto
      const ja = await filmeExistente(procura);
      const agora = new Date().toISOString();

      if (ja) {
        // Já cá está. "Para ver" não tem nada a fazer; "Marcar visto" marca
        // ESTE registo, e aproveita para lhe ensinar o nome português.
        if (watched && !ja.watchedAt) {
          const antes = ja;
          const depois: StoredMovie = {
            ...ja,
            watchedAt: agora,
            dateIsExact: true,
            tmdbId: ja.tmdbId ?? result.tmdbId,
            aliases: juntarNomes(ja.aliases, result.name, result.originalName),
          };
          await putMovie(depois);
          pushUndo({
            label: "Filme marcado como visto",
            detail: ja.name,
            undo: async () => {
              await putMovie(antes);
              setExistente(antes);
              setState("idle");
              onAdded();
            },
          });
          setExistente(depois);
        }
        setState("done");
        onAdded();
        return;
      }

      const key = `tmdb-${result.tmdbId}`;
      await putMovie({
        key,
        name: result.name,
        watchedAt: watched ? agora : null,
        dateIsExact: true,
        releaseDate: result.releaseDate,
        addedAt: agora,
        tmdbId: result.tmdbId,
        posterPath: result.posterPath,
        aliases: juntarNomes(result.name, result.originalName),
      });
      setState("done");
      onAdded();
      pushUndo({
        label: watched ? "Filme marcado como visto" : "Filme adicionado a para ver",
        detail: result.name,
        undo: async () => {
          await deleteMovie(key);
          setState("idle");
          onAdded();
        },
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [result, onAdded],
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
        <p className="mt-1 line-clamp-2 text-[0.9375rem] text-dim">{result.overview}</p>
        {existente?.watchedAt ? (
          // já visto — seja de antes, seja deste toque
          <p
            className="mt-2 flex min-h-11 items-center gap-1.5 text-[0.9375rem] font-semibold text-dim"
            data-testid="filme-ja-visto"
          >
            <CheckIcon className={`h-3.5 w-3.5 ${state === "done" ? "check-pop" : ""}`} />
            {state === "done" ? "Marcado como visto" : "Já viste — está na biblioteca"}
          </p>
        ) : state === "done" ? (
          <button
            disabled
            className="mt-2 flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full bg-raised px-4 text-[0.9375rem] font-semibold text-dim"
          >
            <CheckIcon className="check-pop h-3.5 w-3.5" />
            Na biblioteca
          </button>
        ) : (
          <>
            {existente && (
              <p className="mt-2 text-[0.9375rem] text-dim" data-testid="filme-ja-para-ver">
                Já está na tua lista para ver.
              </p>
            )}
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => void add(true)}
                disabled={state !== "idle" || existente === undefined}
                className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full bg-ink px-4 text-[0.9375rem] font-semibold text-tube transition hover:brightness-110 active:scale-95 disabled:opacity-50"
              >
                {state === "following" && (
                  <span className="spinner h-3.5 w-3.5 rounded-full border-2 border-tube/30 border-t-tube" />
                )}
                Marcar visto
              </button>
              {!existente && (
                <button
                  onClick={() => void add(false)}
                  disabled={state !== "idle" || existente === undefined}
                  className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-line px-4 text-[0.9375rem] font-semibold text-dim transition hover:border-ink hover:text-ink active:scale-95 disabled:opacity-50"
                >
                  Para ver
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
