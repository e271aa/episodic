"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { imageUrl } from "@/lib/tmdb";
import { formatEpCode } from "@/lib/watchnext";
import type { MetaEpisode } from "@/lib/metadata";
import { CheckIcon } from "@/components/icons";

export interface TonightHeroProps {
  showUuid: string;
  showName: string;
  backdropPath: string | null;
  posterPath: string | null;
  episode: MetaEpisode;
  /** rótulo por cima do título — muda consoante a série seja ativa, parada ou nova */
  eyebrow?: string;
  onCheck: (season: number, episode: number) => Promise<void>;
}

/**
 * O ecrã responde a uma pergunta só: o que vejo a seguir? Um cartão
 * cinematográfico único — não mais uma grelha — com o momento "ligar a
 * televisão" na entrada (a chave é showUuid: troca de série reinicia o efeito).
 */
export default function TonightHero({
  showUuid,
  showName,
  backdropPath,
  posterPath,
  episode,
  eyebrow = "A seguir",
  onCheck,
}: TonightHeroProps) {
  const [checking, setChecking] = useState(false);
  // A troca de série (key={showUuid} no chamador) remonta o componente, por
  // isso "lit" nasce sempre a false e só este efeito o liga — sem precisar
  // de o repor manualmente a cada mudança.
  const [lit, setLit] = useState(false);
  const backdrop = imageUrl(backdropPath ?? posterPath, "original");

  useEffect(() => {
    const raf = requestAnimationFrame(() => setLit(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleCheck = async () => {
    if (checking) return;
    setChecking(true);
    try {
      await onCheck(episode.season, episode.episode);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="relative -mx-4 aspect-4/5 overflow-hidden bg-panel sm:aspect-video">
      {backdrop && (
        <Image
          key={showUuid}
          src={backdrop}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover transition-[transform,opacity] duration-[900ms] ease-out"
          style={{
            transform: lit ? "scale(1)" : "scale(1.05)",
            opacity: lit ? 1 : 0,
          }}
        />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-tube via-tube/55 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-tube/70 to-transparent" />

      <div className="relative flex h-full flex-col justify-end p-5 pb-6">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.3em] text-dim [font-stretch:75%]">
          {eyebrow}
        </p>
        <Link href={`/series/${showUuid}`} className="mt-2 block">
          <h1 className="font-display text-3xl font-bold text-ink [font-stretch:120%] sm:text-4xl">
            {showName}
          </h1>
        </Link>
        <p className="ep-code mt-1.5 text-sm text-dim">
          {formatEpCode(episode.season, episode.episode)} · {episode.name}
        </p>

        <button
          onClick={() => void handleCheck()}
          disabled={checking}
          className="mt-4 flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-tube transition active:scale-95 disabled:opacity-60"
        >
          {checking ? (
            <span className="spinner h-4 w-4 rounded-full border-2 border-tube/30 border-t-tube" />
          ) : (
            <CheckIcon className="h-4 w-4" />
          )}
          Marcar visto
        </button>
      </div>

      {/* fio de cor — a única cor no ecrã, a marcar o cartão em destaque */}
      <div className="bars absolute inset-x-0 top-0 h-[3px]" />
    </div>
  );
}
