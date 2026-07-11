"use client";

import Link from "next/link";
import { imageUrl } from "@/lib/tmdb";

export interface PosterCardProps {
  href: string;
  name: string;
  posterPath: string | null;
  /** episódios vistos / total (total pode ser desconhecido antes dos metadados) */
  watched?: number;
  total?: number | null;
  subtitle?: string;
}

export default function PosterCard({
  href,
  name,
  posterPath,
  watched,
  total,
  subtitle,
}: PosterCardProps) {
  const src = imageUrl(posterPath, "w342");
  const progress =
    watched !== undefined && total ? Math.min(100, (watched / total) * 100) : null;

  return (
    <Link href={href} className="group block cursor-pointer active:scale-[0.97]">
      <div className="relative aspect-2/3 overflow-hidden rounded-xl bg-panel transition duration-150 group-hover:ring-2 group-hover:ring-signal/60">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- posters já vêm dimensionados do fornecedor
          <img
            src={src}
            alt={name}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-raised p-2 text-center font-display text-sm font-bold text-dim">
            {name}
          </div>
        )}
        {progress !== null && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/50">
            <div className="h-full bg-signal" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
      <p className="mt-1.5 truncate text-sm font-medium">{name}</p>
      {(watched !== undefined || subtitle) && (
        <p className="ep-code truncate text-xs text-dim">
          {subtitle ?? (total ? `${watched}/${total}` : `${watched} vistos`)}
        </p>
      )}
    </Link>
  );
}
