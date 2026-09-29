"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import Poster from "@/components/Poster";
import Codigo from "@/components/mira/Codigo";
import Segmentos from "@/components/mira/Segmentos";
import { formatEpCode } from "@/lib/watchnext";
import type { MetaEpisode } from "@/lib/metadata";

/**
 * Uma série da fila, numa lista agrupada: a capa com a barra de 3px da série
 * por baixo (a gramática de TV, também aqui), o nome, o próximo episódio com o
 * código em mono, e o círculo de marcar — a ação da linha, com contorno, porque
 * a cápsula preenchida é só a do cartão da casa (Regra da ação).
 */
export default function LinhaFila({
  showUuid,
  showName,
  posterPath,
  episode,
  watchedCount,
  totalEpisodes,
  onCheck,
}: {
  showUuid: string;
  showName: string;
  posterPath: string | null;
  episode: MetaEpisode;
  watchedCount: number;
  totalEpisodes: number | null;
  onCheck: (season: number, episode: number) => Promise<void>;
}) {
  const [aMarcar, setAMarcar] = useState(false);
  const [feito, setFeito] = useState(0);
  const codigo = formatEpCode(episode.season, episode.episode);

  const marcar = async () => {
    if (aMarcar) return;
    setAMarcar(true);
    setFeito((n) => n + 1);
    try {
      await onCheck(episode.season, episode.episode);
    } finally {
      setAMarcar(false);
    }
  };

  return (
    <div className="group/linha flex min-h-16 items-center gap-3 pl-4 pr-2">
      <Link href={`/series/${showUuid}`} className="flex min-w-0 flex-1 items-center gap-3 self-stretch py-2">
        <span className="flex w-9 shrink-0 flex-col gap-1">
          <span className="relative block h-[52px] w-9 overflow-hidden rounded-[8px] bg-elevated">
            <Poster path={posterPath} alt="" size="w185" fill sizes="36px" className="object-cover" />
          </span>
          {totalEpisodes ? (
            <Segmentos
              fino
              total={totalEpisodes}
              vistos={new Set(Array.from({ length: Math.min(watchedCount, totalEpisodes) }, (_, i) => i + 1))}
              rotulo={`${watchedCount} de ${totalEpisodes} vistos`}
            />
          ) : null}
        </span>
        <span className="min-w-0 flex-1 border-b-[0.5px] border-separator py-2.5 group-last/linha:border-b-0">
          <span className="block truncate text-base font-semibold text-label">{showName}</span>
          <span className="mt-0.5 block truncate text-[0.88rem] text-label-2">
            <Codigo className="mr-1.5 text-label">{codigo}</Codigo>
            {episode.name}
          </span>
        </span>
      </Link>
      <button
        type="button"
        onClick={() => void marcar()}
        aria-label={`Marcar ${showName} ${codigo} como visto`}
        className={`relative flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-label transition-transform active:scale-90 ${
          feito > 0 ? "check-ring" : ""
        }`}
        style={{ boxShadow: "inset 0 0 0 1.5px var(--m-label-3)" }}
      >
        <Check key={feito} aria-hidden strokeWidth={2.4} className={`h-5 w-5 ${feito > 0 ? "check-pop" : ""}`} />
      </button>
    </div>
  );
}
