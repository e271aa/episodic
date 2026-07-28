"use client";

import { useRef, useState } from "react";
import Poster from "@/components/Poster";
import type { DiscoverItem } from "@/lib/tmdb";

export interface DeckItem {
  item: DiscoverItem;
  /** de que secção veio ("Em alta esta semana", "Porque viste X"…) —
   *  sem as filas lado a lado, é a única forma de o utilizador saber
   *  porque é que aquele título está a aparecer */
  sectionTitle: string;
  sectionReason?: string;
}

/** distância a partir da qual largar o cartão decide */
const THRESHOLD = 100;
/** a partir daqui o selo já está a 100% — decidir "sente-se" antes do limiar */
const STAMP_FULL = 70;

const YES = "#37c837";
const NO = "#e8564a";

/**
 * Cartão do Explorar em modo cartões — mesma física do SwipeCard do "Pôr em
 * dia" (arrasta-se com o dedo, ou usa os botões por baixo). Aqui a decisão é
 * "quero ver" vs. "não me interessa", não "vi" vs. "ainda não".
 */
export default function DiscoverSwipeCard({
  deckItem,
  active,
  depth,
  onDecide,
}: {
  deckItem: DeckItem;
  active: boolean;
  depth: number;
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
      // idem SwipeCard: nem todo ponteiro sintético tem captura disponível
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
  const intent = Math.min(1, Math.abs(drag.x) / STAMP_FULL);
  const yes = drag.x > 0 ? intent : 0;
  const no = drag.x < 0 ? intent : 0;
  const committed = Math.abs(drag.x) > THRESHOLD;
  const rest = `scale(${1 - depth * 0.04}) translateY(${depth * -8}px)`;
  const transform = leaving
    ? `translateX(${leaving === "right" ? 600 : -600}px) rotate(${leaving === "right" ? 24 : -24}deg)`
    : `translateX(${drag.x}px) rotate(${rotate}deg) ${depth > 0 ? rest : ""}`;

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
        className="ep-card relative h-full overflow-hidden"
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
            size="w500"
            fill
            priority={active}
            sizes="(max-width: 640px) 100vw, 480px"
            className="object-cover"
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-raised p-4 text-center font-display text-lg font-bold text-dim">
            {item.name}
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-tube via-tube/60 to-transparent" />

        <div
          className="pointer-events-none absolute inset-0"
          style={{ backgroundColor: YES, opacity: yes * 0.28 }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ backgroundColor: NO, opacity: no * 0.28 }}
        />

        {/* Selo do lado contrário ao movimento — o cartão foge para a
            direita, o selo "Para ver" fica à esquerda para continuar visível. */}
        <div
          className="pointer-events-none absolute left-4 top-6 rounded-xl border-[5px] px-4 py-1.5 text-center font-display text-2xl font-bold uppercase leading-none tracking-wide [font-stretch:75%]"
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
          className="pointer-events-none absolute right-4 top-6 rounded-xl border-[5px] px-4 py-1.5 text-center font-display text-2xl font-bold uppercase leading-none tracking-wide [font-stretch:75%]"
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

        <div className="relative flex h-full flex-col justify-end p-5">
          <p className="truncate font-display text-xs font-semibold uppercase tracking-[0.18em] text-dim [font-stretch:80%]">
            {sectionTitle}
            {sectionReason ? ` · ${sectionReason}` : ""}
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold leading-tight text-ink [font-stretch:105%]">
            {item.name}
          </h2>
          {item.year && <p className="ep-code mt-1 text-xs text-faint">{item.year}</p>}
          {item.overview && (
            <p className="mt-2 line-clamp-3 text-base text-dim">{item.overview}</p>
          )}
        </div>
      </div>
    </div>
  );
}
