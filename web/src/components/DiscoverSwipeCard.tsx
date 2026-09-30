"use client";

import { useRef, useState } from "react";
import Poster from "@/components/Poster";
import type { DiscoverItem } from "@/lib/tmdb";

export interface DeckItem {
  item: DiscoverItem;
  sectionTitle: string;
  sectionReason?: string;
}

/** física calibrada — igual à do "Pôr em dia". Não mexer. */
const THRESHOLD = 100;
const STAMP_FULL = 70;

const YES = "var(--color-smpte-green)";
const NO = "var(--color-smpte-red)";


/**
 * Cartão da Triagem: de bordo a bordo, recortado. (A variante «cartão», com
 * a faixa da mira como progresso, saiu na Fase 12 — nenhum ecrã a usava.)
 */
export default function DiscoverSwipeCard({
  deckItem,
  active,
  depth,
  mostrarTipo = false,
  onDecide,
}: {
  deckItem: DeckItem;
  active: boolean;
  depth: number;
  /** a pesquisa mistura séries e filmes — sem isto não se sabe qual é qual */
  mostrarTipo?: boolean;
  onDecide: (guardar: boolean) => void;
}) {
  const { item, sectionTitle, sectionReason } = deckItem;
  const [drag, setDrag] = useState({ x: 0, dragging: false });
  const [leaving, setLeaving] = useState<"left" | "right" | null>(null);
  const startX = useRef(0);
  const pointerId = useRef<number | null>(null);

  const decide = (guardar: boolean) => {
    setLeaving(guardar ? "right" : "left");
    setTimeout(() => onDecide(guardar), 220);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!active || leaving) return;
    startX.current = e.clientX;
    pointerId.current = e.pointerId;
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {
      // nem todo ponteiro sintético tem captura disponível
    }
    setDrag({ x: 0, dragging: true });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!drag.dragging || pointerId.current !== e.pointerId) return;
    setDrag({ x: e.clientX - startX.current, dragging: true });
  };

  const endDrag = () => {
    if (!drag.dragging) return;
    if (Math.abs(drag.x) > THRESHOLD) decide(drag.x > 0);
    else setDrag({ x: 0, dragging: false });
    pointerId.current = null;
  };

  const rotate = drag.x / 18;
  const intent = Math.min(1, Math.abs(drag.x) / STAMP_FULL);
  const yes = drag.x > 0 ? intent : 0;
  const no = drag.x < 0 ? intent : 0;
  const committed = Math.abs(drag.x) > THRESHOLD;
  const rest = `scale(${1 - depth * 0.04}) translateY(${depth * -8}px)`;
  const transform = leaving
    ? `translateX(${leaving === "right" ? 600 : -600}px) rotate(${leaving === "right" ? 24 : -24}deg)`
    : `translateX(${drag.x}px) rotate(${rotate}deg) ${depth > 0 ? rest : ""}`;

  // O rating só aparece quando diz alguma coisa. A app evita transformar
  // tudo em números: abaixo de 8,0 não ajuda a decidir, é ruído.
  const nota = item.rating && item.rating >= 8 ? item.rating.toFixed(1).replace(".", ",") : null;

  return (
    <div
      className="absolute inset-0 touch-none select-none"
      style={{
        transform,
        transition: drag.dragging ? "none" : "transform 220ms ease-out",
        zIndex: 10 - depth,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div
        className="relative h-full overflow-hidden bg-group"
        style={{
          boxShadow: committed
            ? `0 0 0 3px ${drag.x > 0 ? YES : NO}, 0 18px 40px -12px rgba(0,0,0,.7)`
            : undefined,
          transition: drag.dragging ? "none" : "box-shadow 200ms ease-out",
        }}
      >
        {item.posterPath ? (
          <Poster
            path={item.posterPath}
            alt=""
            size="w780"
            fill
            priority={active}
            sizes="(max-width: 640px) 100vw, 480px"
            className="object-cover"
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-group p-4 text-center text-[1.18rem] font-semibold text-label-2">
            {item.name}
          </div>
        )}

        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `linear-gradient(to top,var(--color-tube) 2%,color-mix(in srgb, var(--color-tube) 85%, transparent) 26%,color-mix(in srgb, var(--color-tube) 15%, transparent) 52%,color-mix(in srgb, var(--color-tube) 55%, transparent) 100%)`,
          }}
        />

        <div
          className="pointer-events-none absolute inset-0"
          style={{ backgroundColor: YES, opacity: yes * 0.28 }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ backgroundColor: NO, opacity: no * 0.28 }}
        />

        {/* Selos do lado contrário ao movimento */}
        <div
          className="pointer-events-none absolute left-4 top-6 rounded-xl border-[5px] px-4 py-1.5 text-center text-[1.65rem] font-bold leading-none"
          style={{
            borderColor: YES,
            color: YES,
            backgroundColor: "rgba(0,0,0,.35)",
            opacity: yes,
            transform: `rotate(-12deg) scale(${0.7 + yes * 0.3})`,
          }}
        >
          Para
          <br />
          ver
        </div>
        <div
          className="pointer-events-none absolute right-4 top-6 rounded-xl border-[5px] px-4 py-1.5 text-center text-[1.65rem] font-bold leading-none"
          style={{
            borderColor: NO,
            color: NO,
            backgroundColor: "rgba(0,0,0,.35)",
            opacity: no,
            transform: `rotate(12deg) scale(${0.7 + no * 0.3})`,
          }}
        >
          Não
          <br />
          quero
        </div>

        <div
          className="pointer-events-none relative flex h-full flex-col justify-end px-5 pb-[13rem]"
        >
          {/* De onde veio isto — sem as filas lado a lado é a única pista do
              porquê. Só texto: a mira não é decoração (Fase 12). */}
          <p data-testid="origem-triagem" className="flex max-w-full items-center gap-2 self-start truncate vidro rounded-full py-1 pl-2 pr-3 text-[0.76rem] font-semibold text-label">
            <span className="truncate">
              {sectionTitle}
              {sectionReason ? ` · ${sectionReason}` : ""}
            </span>
          </p>

          <h2
            className="mt-2 text-4xl font-bold leading-[1.02] text-label"
          >
            {item.name}
          </h2>

          <p className="ep-code mt-1 text-[0.76rem] text-label-2">
            {[
              mostrarTipo ? (item.kind === "movie" ? "Filme" : "Série") : null,
              item.year,
              nota ? `TMDB ${nota}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>

          {item.overview && (
            <p
              className="mt-2 line-clamp-3 text-base text-label-2"
            >
              {item.overview}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
