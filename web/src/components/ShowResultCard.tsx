"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { putShow, updateShow, type StoredShow } from "@/lib/db";
import { juntarNomes, serieExistente } from "@/lib/existente";
import type { MetaSearchResult } from "@/lib/metadata";
import Poster from "@/components/Poster";
import { CheckIcon, TvIcon } from "@/components/icons";

type FollowState = "idle" | "following" | "done";

function estadoDa(serie: StoredShow): string {
  if (serie.archived) return "Arquivada na tua biblioteca";
  if (serie.followed) return "Já a segues";
  return "Já está na tua biblioteca";
}

/**
 * Resultado da pesquisa remota de séries, na Biblioteca.
 *
 * Se a série já lá estiver, o cartão leva até ela em vez de oferecer
 * "Seguir". Antes procurava só pela chave `tmdb-<id>`: uma série importada
 * do TV Time (outra chave, nome em inglês) aparecia como nova, e "Seguir"
 * criava uma segunda cópia vazia — que ia parar a "Por começar" enquanto a
 * verdadeira estava nas completas (Ronda 12).
 */
export default function ShowResultCard({ result }: { result: MetaSearchResult }) {
  const [state, setState] = useState<FollowState>("idle");
  /** undefined = ainda a ver; null = não está na biblioteca */
  const [existente, setExistente] = useState<StoredShow | null | undefined>(undefined);
  const procura = {
    tmdbId: result.provider === "tmdb" ? result.providerId : null,
    tvmazeId: result.provider === "tvmaze" ? result.providerId : null,
    nomes: [result.name, result.originalName],
  };

  useEffect(() => {
    let vivo = true;
    void serieExistente(procura).then((s) => {
      if (vivo) setExistente(s);
    });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.provider, result.providerId]);

  const add = useCallback(
    async () => {
      setState("following");
      const ja = await serieExistente(procura);
      if (ja) {
        await updateShow(ja.uuid, {
          followed: true,
          inWatchlist: false,
          archived: false,
          tmdbAliases: juntarNomes(ja.tmdbAliases, result.name, result.originalName),
        });
      } else {
        await putShow({
          uuid: `${result.provider}-${result.providerId}`,
          name: result.name,
          tvdbId: null,
          tmdbId: procura.tmdbId,
          tvmazeId: procura.tvmazeId,
          tmdbAliases: juntarNomes(result.name, result.originalName),
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
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [result],
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
        <p className="mt-1 line-clamp-2 text-[0.9375rem] text-dim">{result.overview}</p>
        {existente && state === "idle" ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-[0.9375rem] text-dim" data-testid="serie-ja-existe">
              {estadoDa(existente)}
            </p>
            <Link
              href={`/series/${existente.uuid}`}
              className="flex min-h-11 cursor-pointer items-center text-[0.9375rem] font-semibold text-ink hover:underline"
            >
              Abrir →
            </Link>
          </div>
        ) : state === "done" ? (
          <button
            disabled
            className="mt-2 flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full bg-raised px-4 text-[0.9375rem] font-semibold text-dim"
          >
            <CheckIcon className="check-pop h-3.5 w-3.5" />
            {/* "A seguir" é só a fila (a dock) — Ronda 12, Fase 5 */}
            Em «Por começar»
          </button>
        ) : (
          <button
            onClick={() => void add()}
            disabled={state !== "idle" || existente === undefined}
            className="mt-2 flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full bg-ink px-4 text-[0.9375rem] font-semibold text-tube transition hover:brightness-110 active:scale-95 disabled:opacity-50"
          >
            {state === "following" && (
              <span className="spinner h-3.5 w-3.5 rounded-full border-2 border-tube/30 border-t-tube" />
            )}
            Por começar
          </button>
        )}
      </div>
    </div>
  );
}
