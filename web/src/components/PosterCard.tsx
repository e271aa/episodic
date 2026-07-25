"use client";

import Link from "next/link";
import { imageUrl } from "@/lib/tmdb";

export interface PosterCardProps {
  href: string;
  name: string;
  posterPath: string | null;
  /** posição na grelha, para a entrada escalonada */
  index?: number;
  /** episódios vistos / total (total pode ser desconhecido antes dos metadados) */
  watched?: number;
  total?: number | null;
  subtitle?: string;
  /** estado da série no fornecedor (TMDB/TVmaze) — dita a cor da barra quando em dia */
  status?: string | null;
}

// A série acabou de vez — sem isto, "em dia" fica sempre verde (o valor
// por omissão é assumir que ainda pode vir mais, nunca o contrário)
const ENDED_STATUSES = new Set(["Ended", "Canceled", "Cancelled"]);

/**
 * Cor da barra de progresso, com significado (como o TV Time tinha):
 *  - a meio de ver: branco — neutro, é só progresso
 *  - em dia e a série ainda pode ter mais temporadas: verde
 *  - em dia mas a série já terminou, não vem mais nada: roxo
 * As cores vêm da paleta das barras SMPTE, não são novas.
 */
function progressBarColor(
  watched: number,
  total: number,
  status: string | null | undefined,
): string {
  if (watched < total) return "var(--color-ink)";
  return ENDED_STATUSES.has(status ?? "") ? "#d24bd2" : "#37c837";
}

export default function PosterCard({
  href,
  name,
  posterPath,
  index,
  watched,
  total,
  subtitle,
  status,
}: PosterCardProps) {
  const src = imageUrl(posterPath, "w342");
  const progress =
    watched !== undefined && total ? Math.min(100, (watched / total) * 100) : null;
  const barColor =
    watched !== undefined && total ? progressBarColor(watched, total, status) : null;

  return (
    <Link
      href={href}
      className="poster-in group block cursor-pointer transition active:scale-[0.97]"
      // entrada escalonada: a grelha monta-se em cascata, não toda de uma vez
      style={index !== undefined ? { animationDelay: `${Math.min(index, 11) * 35}ms` } : undefined}
    >
      <div className="relative aspect-2/3 overflow-hidden rounded-2xl bg-panel shadow-md shadow-black/30 transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lg group-hover:ring-2 group-hover:ring-ink/60">
        {/* O nome fica sempre por baixo: enquanto a capa não chega (ou se
            faltar de todo), a caixa lê-se como um cartaz sem arte em vez de
            um buraco preto que parece avariado. */}
        <div className="absolute inset-0 flex items-center justify-center bg-raised p-2 text-center font-display text-sm font-bold text-dim">
          {name}
        </div>
        {src && (
          // eslint-disable-next-line @next/next/no-img-element -- posters já vêm dimensionados do fornecedor
          <img
            src={src}
            alt={name}
            loading="lazy"
            className="relative h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        )}
        {progress !== null && (
          <>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-1 bg-black/50">
              <div
                className="h-full transition-[width]"
                style={{
                  width: `${progress}%`,
                  background: barColor ?? undefined,
                  boxShadow: barColor ? `0 0 6px ${barColor}b3` : undefined,
                }}
              />
            </div>
          </>
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
