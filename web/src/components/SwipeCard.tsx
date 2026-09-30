"use client";

import { useRef, useState } from "react";
import Poster from "@/components/Poster";
import { formatEpCode } from "@/lib/watchnext";
import { TvIcon } from "@/components/icons";
import type { MetaEpisode } from "@/lib/metadata";

export interface SwipeCardProps {
  showName: string;
  posterPath: string | null;
  backdropPath: string | null;
  episode: MetaEpisode;
  /** quantos episódios da série já estão marcados — situa o que vais decidir */
  watchedCount: number;
  totalEpisodes: number | null;
  /** true = topo da pilha (só este responde ao gesto) */
  active: boolean;
  /** posição na pilha: 0 = topo, 1 = o próximo a subir, … */
  depth: number;
  onDecide: (watched: boolean) => void;
}

/** faixa junto ao bordo esquerdo reservada ao gesto de recuar — tem de bater
 *  certo com o `EDGE` do `BackGesture`, senão os dois gestos disputam o
 *  mesmo toque */
const BACK_GESTURE_EDGE = 26;
/** distância a partir da qual largar o cartão decide */
const THRESHOLD = 100;
/** a partir daqui o selo já está a 100% — decidir "sente-se" antes do limiar */
const STAMP_FULL = 70;
/**
 * Um piparote decide mesmo antes do limiar (Ronda 12, Fase 6): px/ms a
 * partir dos quais o gesto conta, e a distância mínima para um toque com o
 * dedo a tremer não contar como piparote.
 */
const FLICK_VELOCITY = 0.11;
const FLICK_MIN = 24;

const YES = "var(--color-smpte-green)";
const NO = "var(--color-smpte-red)";

// Cartão do "Pôr em dia": arrasta-se com o rato/dedo, ou usa os botões por baixo
// (mesma ação, sempre disponível — o gesto nunca é a única forma de decidir).
export default function SwipeCard({
  showName,
  posterPath,
  backdropPath,
  episode,
  watchedCount,
  totalEpisodes,
  active,
  depth,
  onDecide,
}: SwipeCardProps) {
  const [drag, setDrag] = useState({ x: 0, dragging: false });
  const [leaving, setLeaving] = useState<"left" | "right" | null>(null);
  const startX = useRef(0);
  const startT = useRef(0);
  const pointerId = useRef<number | null>(null);
  const backdropOrPoster = backdropPath ?? posterPath;

  const decide = (watched: boolean) => {
    setLeaving(watched ? "right" : "left");
    setTimeout(() => onDecide(watched), 220);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!active || leaving || e.clientX <= BACK_GESTURE_EDGE) return;
    startX.current = e.clientX;
    startT.current = performance.now();
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
    const velocity = Math.abs(drag.x) / Math.max(1, performance.now() - startT.current);
    const flick = velocity > FLICK_VELOCITY && Math.abs(drag.x) > FLICK_MIN;
    if (Math.abs(drag.x) > THRESHOLD || flick) {
      decide(drag.x > 0);
    } else {
      setDrag({ x: 0, dragging: false });
    }
    pointerId.current = null;
  };

  const rotate = drag.x / 18;
  // O selo cresce depressa: aos 70px já está cheio, para a intenção ser
  // legível muito antes de o gesto ficar comprometido.
  const intent = Math.min(1, Math.abs(drag.x) / STAMP_FULL);
  const yes = drag.x > 0 ? intent : 0;
  const no = drag.x < 0 ? intent : 0;
  const committed = Math.abs(drag.x) > THRESHOLD;
  // Os cartões de trás encolhem um pouco, para se perceber que há uma pilha
  // e qual é o que sobe a seguir.
  const rest = `scale(${1 - depth * 0.04}) translateY(${depth * -8}px)`;
  const transform = leaving
    ? `translateX(${leaving === "right" ? 600 : -600}px) rotate(${leaving === "right" ? 24 : -24}deg)`
    : `translateX(${drag.x}px) rotate(${rotate}deg) ${depth > 0 ? rest : ""}`;

  return (
    <div
      className="absolute inset-0 touch-none select-none"
      style={{
        transform,
        transition: drag.dragging ? "none" : "transform 220ms var(--ease-out)",
        // sem isto, os cartões de trás partilham o mesmo z-index e é o último
        // do DOM (o 3.º) que se vê atrás — não o que sobe a seguir
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
          // a moldura acende com a decisão — o cartão inteiro responde,
          // não só um autocolante no canto
          boxShadow: committed
            ? `0 0 0 3px ${drag.x > 0 ? YES : NO}, 0 18px 40px -12px rgba(0,0,0,.7)`
            : undefined,
          transition: drag.dragging ? "none" : "box-shadow 200ms ease-out",
        }}
      >
        {/* a imagem é fundo (absoluta): se ficar em fluxo, empurra o bloco de
            texto para fora do cartão e não se vê que episódio se está a decidir */}
        {backdropOrPoster ? (
          <Poster
            path={backdropOrPoster}
            alt=""
            size="w780"
            fill
            // as duas ou três cartas do topo da pilha estão sempre à vista —
            // não faz sentido nenhuma delas ser lazy
            priority={active}
            sizes="(max-width: 640px) 100vw, 480px"
            className="object-cover"
            draggable={false}
          />
        ) : (
          // o nome já é o título do cartão, por baixo — aqui só o sinal de
          // que falta a arte, no terço de cima: centrado no cartão inteiro
          // caía em cima do título (visto no Safari do iOS, Fase 8)
          <div className="absolute inset-0 bg-group text-label-3">
            <div className="absolute inset-x-0 top-0 flex h-1/3 items-center justify-center">
              <TvIcon className="h-12 w-12" />
            </div>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-tube via-tube/50 to-transparent" />

        {/* banho de cor: a decisão tinge o cartão todo, como nas dating apps */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ backgroundColor: YES, opacity: yes * 0.28 }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ backgroundColor: NO, opacity: no * 0.28 }}
        />

        {/* Selos de intenção — grandes, inclinados, impossíveis de não ver.
            Ficam do lado contrário ao movimento: o cartão foge para a direita,
            por isso o selo "Visto" tem de estar à esquerda para continuar à
            vista (é o que as dating apps fazem). */}
        <div
          className="pointer-events-none absolute left-4 top-6 rounded-xl border-[5px] px-4 py-1.5 text-[1.65rem] font-bold leading-none"
          style={{
            borderColor: YES,
            color: YES,
            backgroundColor: "rgba(0,0,0,.35)",
            opacity: yes,
            transform: `rotate(-12deg) scale(${0.7 + yes * 0.3})`,
          }}
          data-testid="stamp-visto"
        >
          Visto
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
          data-testid="stamp-ainda-nao"
        >
          Ainda
          <br />
          não
        </div>

        {/* De que série é, primeiro — como no herói da casa. Estava ao
            contrário: a série a 12px, cinza, em maiúsculas sobre a arte, e o
            nome do episódio a 24px ("Episódio 5" não diz nada a ninguém;
            Ronda 12, 5b.4, P1 #5). O código continua a ser o que fica
            marcado, no chip. O `pb` sobe o texto acima das ações flutuantes
            e da dock — sem isto o título ficava tapado por baixo delas. */}
        <div className="relative flex h-full flex-col justify-end px-5 pt-5 pb-[calc(var(--dock-h)+10.25rem)]">
          <h2 className="line-clamp-2 text-[1.65rem] font-bold leading-[1.1] text-label">
            {showName}
          </h2>
          <div className="mt-2 flex items-center gap-2.5">
            <span className="ep-code rounded-full bg-acao px-3 py-1 text-[0.88rem] font-semibold text-on-label">
              {formatEpCode(episode.season, episode.episode)}
            </span>
            {episode.airDate && (
              <span className="ep-code text-[0.76rem] text-label-2">
                {episode.airDate.slice(0, 4)}
              </span>
            )}
          </div>
          <p className="mt-2 line-clamp-2 text-base leading-snug text-label">
            {episode.name}
          </p>
          {/* onde é que este episódio cai na série — sem isto, "visto" decide-se
              às cegas: é o próximo por ver, mas não se sabe de quantos */}
          <p className="ep-code mt-2 text-[0.76rem] text-label-2">
            {watchedCount}
            {totalEpisodes ? `/${totalEpisodes}` : ""} vistos até agora
          </p>
        </div>
      </div>
    </div>
  );
}
