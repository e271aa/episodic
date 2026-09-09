"use client";

import { useState } from "react";
import Poster from "@/components/Poster";
import { CheckIcon } from "@/components/icons";
import type { DiscoverItem } from "@/lib/tmdb";

type Estado = "idle" | "a-guardar" | "guardado" | "dispensado";

/**
 * Um cartaz do Explorar. Duas ações, ambas de um toque: guardar para ver
 * depois, ou dispensar para nunca mais aparecer.
 */
export default function DiscoverCard({
  item,
  index,
  onSave,
  onDismiss,
  mostrarTipo = false,
  fluida = false,
}: {
  item: DiscoverItem;
  index: number;
  onSave: (item: DiscoverItem) => Promise<void>;
  onDismiss: (item: DiscoverItem) => Promise<void>;
  /** a pesquisa mistura séries e filmes — sem isto não se sabe qual é qual */
  mostrarTipo?: boolean;
  /** numa faixa que rola, o cartaz tem largura fixa; num mosaico, acompanha
   *  a coluna — senão as três colunas ficavam com um vão à direita */
  fluida?: boolean;
}) {
  const [estado, setEstado] = useState<Estado>("idle");

  if (estado === "dispensado") return null;

  const guardar = async () => {
    setEstado("a-guardar");
    await onSave(item);
    setEstado("guardado");
  };

  const dispensar = async () => {
    setEstado("dispensado");
    await onDismiss(item);
  };

  return (
    <div
      className={`poster-in ${fluida ? "w-full" : "w-32 shrink-0 sm:w-36"}`}
      style={{ animationDelay: `${Math.min(index, 11) * 35}ms` }}
    >
      <div className="relative aspect-2/3 overflow-hidden rounded-2xl bg-panel shadow-md shadow-black/30">
        <div className="absolute inset-0 flex items-center justify-center bg-raised p-2 text-center font-display text-xs font-bold text-dim">
          {item.name}
        </div>
        <Poster
          path={item.posterPath}
          alt={item.name}
          fill
          sizes="144px"
          className="object-cover"
        />
        {estado === "guardado" && (
          <div className="absolute inset-0 flex items-center justify-center bg-tube/75">
            <span className="flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-tube">
              <CheckIcon className="check-pop h-3.5 w-3.5" />
              Para ver
            </span>
          </div>
        )}
      </div>

      <p className="mt-1.5 truncate text-[17px] font-semibold">{item.name}</p>
      <p className="ep-code truncate text-xs text-dim">
        {[mostrarTipo ? (item.kind === "movie" ? "Filme" : "Série") : null, item.year]
          .filter(Boolean)
          .join(" · ")}
      </p>

      {estado === "idle" && (
        <div className="mt-1.5 flex gap-1.5">
          <button
            onClick={() => void guardar()}
            className="flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-full bg-ink text-xs font-semibold text-tube transition hover:brightness-110 active:scale-95"
          >
            Para ver
          </button>
          <button
            onClick={() => void dispensar()}
            aria-label="Não me interessa"
            className="flex min-h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line text-faint transition hover:border-ink hover:text-ink active:scale-90"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
