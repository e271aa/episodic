"use client";

import { useCallback, useState } from "react";
import { getShow, putShow, updateShow } from "@/lib/db";
import type { MetaSearchResult } from "@/lib/metadata";
import Poster from "@/components/Poster";
import { CheckIcon, TvIcon } from "@/components/icons";

type FollowState = "idle" | "following" | "done";

/** Resultado da pesquisa remota de séries, na Biblioteca. */
export default function ShowResultCard({ result }: { result: MetaSearchResult }) {
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
