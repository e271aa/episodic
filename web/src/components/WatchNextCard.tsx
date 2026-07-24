"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckIcon } from "@/components/icons";
import { imageUrl } from "@/lib/tmdb";
import { formatEpCode } from "@/lib/watchnext";
import type { MetaEpisode } from "@/lib/metadata";

export interface WatchNextCardProps {
  showUuid: string;
  showName: string;
  posterPath: string | null;
  episode: MetaEpisode;
  onCheck: (season: number, episode: number) => Promise<void>;
}

export default function WatchNextCard({
  showUuid,
  showName,
  posterPath,
  episode,
  onCheck,
}: WatchNextCardProps) {
  const [checking, setChecking] = useState(false);
  const [pulse, setPulse] = useState(false);
  const pulseTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const poster = imageUrl(posterPath, "w185");

  useEffect(() => () => clearTimeout(pulseTimeout.current), []);

  const handleCheck = async () => {
    if (checking) return;
    setChecking(true);
    // dispara sempre a animação completa (420ms), independentemente da
    // rapidez da resposta — é o "ritual" de marcar, não um spinner de rede
    setPulse(true);
    clearTimeout(pulseTimeout.current);
    pulseTimeout.current = setTimeout(() => setPulse(false), 450);
    try {
      // o pai troca o episódio pelo seguinte quando isto resolver
      await onCheck(episode.season, episode.episode);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="ep-card ep-card-hover flex items-center gap-3 p-3">
      <Link href={`/series/${showUuid}`} className="flex min-w-0 flex-1 items-center gap-3">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster}
            alt=""
            className="h-20 w-14 shrink-0 rounded-lg object-cover shadow-sm shadow-black/40"
          />
        ) : (
          <div className="h-20 w-14 shrink-0 rounded-lg bg-raised" />
        )}
        <div className="min-w-0">
          <p className="ep-code text-xs text-dim">
            {formatEpCode(episode.season, episode.episode)}
          </p>
          <p className="mt-0.5 truncate font-semibold">{showName}</p>
          <p className="truncate text-sm text-dim">{episode.name}</p>
        </div>
      </Link>

      <button
        onClick={() => void handleCheck()}
        disabled={checking}
        aria-label={`Marcar ${showName} ${formatEpCode(episode.season, episode.episode)} como visto`}
        className={`relative flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition-all duration-200 active:scale-90 ${
          checking
            ? "border-ink bg-ink text-tube"
            : "border-line text-faint hover:border-ink hover:bg-raised hover:text-ink"
        } ${pulse ? "check-ring" : ""}`}
      >
        <CheckIcon className={`h-6 w-6 ${pulse ? "check-pop" : ""}`} />
      </button>
    </div>
  );
}
