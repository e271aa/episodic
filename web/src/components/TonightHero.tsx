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
  /** episódios vistos / total, para a barra de progresso */
  watchedCount?: number;
  totalEpisodes?: number | null;
  /** quantos episódios há para pôr em dia — a pílula de entrada no modo foco */
  emDia?: number;
  onCheck: (season: number, episode: number) => Promise<void>;
}

/**
 * O ecrã responde a uma pergunta só: o que vejo a seguir?
 *
 * Na direção 2b o episódio ocupa o ecrã inteiro — não é um cartão dentro de
 * uma página, é a página. O texto vive por cima da arte, no terço de baixo,
 * onde o polegar chega e onde o gradiente já escureceu o suficiente para se
 * ler sem tapar a imagem.
 */
export default function TonightHero({
  showUuid,
  showName,
  backdropPath,
  posterPath,
  episode,
  eyebrow = "Esta noite",
  watchedCount,
  totalEpisodes,
  emDia = 0,
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

  const progresso =
    watchedCount !== undefined && totalEpisodes
      ? Math.min(100, (watchedCount / totalEpisodes) * 100)
      : null;

  const agora = new Date();
  const dia = agora.toLocaleDateString("pt-PT", { weekday: "short" }).slice(0, 3).toUpperCase();
  const hora = agora.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="relative -mx-4 -mt-8 min-h-[calc(100dvh-var(--dock-h)-1rem)] overflow-hidden bg-panel">
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
      {/* o texto vive no terço de baixo: o gradiente escurece aí o suficiente
          para se ler, e deixa a arte respirar em cima */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-tube via-tube/75 via-45% to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-tube/80 to-transparent" />
      <div className="bars absolute inset-x-0 top-0 h-[3px]" />

      {/* Barra de cima: quando é, e a entrada para o modo de foco */}
      <div className="relative flex items-center justify-between px-5 pt-4">
        <span className="ep-code text-[13px] text-dim">
          {dia} · {hora}
        </span>
        {emDia > 0 && (
          <Link
            href="/em-dia"
            className="flex min-h-9 items-center gap-2 rounded-full border border-line bg-tube/60 px-3 text-[13px] font-semibold text-ink backdrop-blur transition active:scale-95"
          >
            <span className="bars h-4 w-4 shrink-0 rounded-full" aria-hidden />
            {emDia} em dia
          </Link>
        )}
      </div>

      <div className="relative flex min-h-[calc(100dvh-var(--dock-h)-5rem)] flex-col justify-end px-5 pb-6">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-dim [font-stretch:80%]">
          {eyebrow}
        </p>
        <Link href={`/series/${showUuid}`} className="mt-2 block">
          <h1 className="font-display text-[40px] font-bold leading-[0.98] tracking-[-0.015em] text-ink [font-stretch:110%]">
            {showName}
          </h1>
        </Link>

        <div className="mt-3 flex items-center gap-2">
          <span className="ep-code rounded-md bg-ink px-[7px] py-0.5 text-[15px] font-bold text-tube">
            {formatEpCode(episode.season, episode.episode)}
          </span>
          {episode.airDate && (
            <span className="ep-code text-[15px] text-faint">
              {episode.airDate.slice(0, 4)}
            </span>
          )}
        </div>
        <p className="mt-2 text-[17px] font-medium text-ink">{episode.name}</p>

        {progresso !== null && (
          <div className="mt-3 flex items-center gap-2.5">
            <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-ink/20">
              <div
                className="h-full bg-ink transition-[width] duration-[240ms] ease-out"
                style={{ width: `${progresso}%` }}
              />
            </div>
            <span className="ep-code shrink-0 text-[13px] text-dim">
              {watchedCount}/{totalEpisodes}
            </span>
          </div>
        )}

        <button
          onClick={() => void handleCheck()}
          disabled={checking}
          className="mt-5 flex h-[60px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-full bg-ink text-[18px] font-semibold text-tube transition active:scale-[0.98] disabled:opacity-60"
        >
          {checking ? (
            <span className="spinner h-5 w-5 rounded-full border-2 border-tube/30 border-t-tube" />
          ) : (
            <CheckIcon className="h-5 w-5" />
          )}
          Marcar visto
        </button>
      </div>
    </div>
  );
}
