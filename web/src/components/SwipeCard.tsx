"use client";

import { useRef, useState } from "react";
import { imageUrl } from "@/lib/tmdb";
import { formatEpCode } from "@/lib/watchnext";
import type { MetaEpisode } from "@/lib/metadata";

export interface SwipeCardProps {
  showName: string;
  posterPath: string | null;
  backdropPath: string | null;
  episode: MetaEpisode;
  /** true = topo da pilha (só este responde ao gesto) */
  active: boolean;
  onDecide: (watched: boolean) => void;
}

const THRESHOLD = 100;

// Cartão de triagem: arrasta-se com o rato/dedo, ou usa os botões por baixo
// (mesma ação, sempre disponível — o gesto nunca é a única forma de decidir).
export default function SwipeCard({
  showName,
  posterPath,
  backdropPath,
  episode,
  active,
  onDecide,
}: SwipeCardProps) {
  const [drag, setDrag] = useState({ x: 0, dragging: false });
  const [leaving, setLeaving] = useState<"left" | "right" | null>(null);
  const startX = useRef(0);
  const pointerId = useRef<number | null>(null);
  const image = imageUrl(backdropPath ?? posterPath, "w780");

  const decide = (watched: boolean) => {
    setLeaving(watched ? "right" : "left");
    setTimeout(() => onDecide(watched), 220);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!active || leaving) return;
    startX.current = e.clientX;
    pointerId.current = e.pointerId;
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {
      // ignora — alguns dispositivos/eventos sintéticos não têm um ponteiro
      // ativo para capturar; o gesto continua a funcionar sem a captura
    }
    setDrag({ x: 0, dragging: true });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!drag.dragging || pointerId.current !== e.pointerId) return;
    setDrag({ x: e.clientX - startX.current, dragging: true });
  };

  const endDrag = () => {
    if (!drag.dragging) return;
    if (Math.abs(drag.x) > THRESHOLD) {
      decide(drag.x > 0);
    } else {
      setDrag({ x: 0, dragging: false });
    }
    pointerId.current = null;
  };

  const rotate = drag.x / 18;
  const liftOpacity = Math.min(1, Math.abs(drag.x) / THRESHOLD);
  const transform = leaving
    ? `translateX(${leaving === "right" ? 600 : -600}px) rotate(${leaving === "right" ? 24 : -24}deg)`
    : `translateX(${drag.x}px) rotate(${rotate}deg)`;

  return (
    <div
      className="absolute inset-0 touch-none select-none"
      style={{
        transform,
        transition: drag.dragging ? "none" : "transform 220ms ease-out",
        zIndex: active ? 10 : 1,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div className="ep-card relative h-full overflow-hidden">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- imagem já dimensionada
          <img src={image} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-raised p-4 text-center font-display text-lg font-bold text-dim">
            {showName}
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-tube via-tube/50 to-transparent" />

        {/* rótulos de intenção — só aparecem enquanto se arrasta */}
        <div
          className="pointer-events-none absolute right-5 top-5 rounded-lg border-2 px-3 py-1 font-display text-lg font-bold uppercase [font-stretch:75%]"
          style={{
            borderColor: "#37c837",
            color: "#37c837",
            opacity: drag.x > 0 ? liftOpacity : 0,
            transform: "rotate(-8deg)",
          }}
        >
          Visto
        </div>
        <div
          className="pointer-events-none absolute left-5 top-5 rounded-lg border-2 px-3 py-1 font-display text-lg font-bold uppercase [font-stretch:75%]"
          style={{
            borderColor: "var(--color-faint)",
            color: "var(--color-faint)",
            opacity: drag.x < 0 ? liftOpacity : 0,
            transform: "rotate(8deg)",
          }}
        >
          Saltar
        </div>

        <div className="relative flex h-full flex-col justify-end p-5">
          <p className="ep-code text-sm text-dim">
            {formatEpCode(episode.season, episode.episode)}
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold text-ink [font-stretch:110%]">
            {showName}
          </h2>
          <p className="mt-1 truncate text-sm text-dim">{episode.name}</p>
        </div>
      </div>
    </div>
  );
}
