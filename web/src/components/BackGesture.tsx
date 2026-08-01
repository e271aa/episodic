"use client";

import { useCallback, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

/** faixa junto ao bordo onde o gesto horizontal pode começar (como no iOS) */
const EDGE = 26;
/** distância que confirma o recuo */
const THRESHOLD = 80;
/** movimento a partir do qual se decide se o gesto é mesmo de recuar */
const AXIS_LOCK = 12;

/** As paragens da dock não recuam para lado nenhum — a dock é a navegação. */
const ROOTS = new Set(["/", "/series", "/library", "/profile"]);

/** Sem histórico (PWA aberta de raiz nesta página), sobe-se um nível na rota. */
function parentOf(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  return parts.length > 1 ? `/${parts.slice(0, -1).join("/")}` : "/series";
}

/**
 * Uma fila de chips que desliza na horizontal e o gesto de recuar querem o
 * mesmo movimento. Quem começou em cima de algo que rola tem prioridade.
 */
function insideScroller(target: EventTarget | null, horizontal: boolean): boolean {
  let el = target instanceof Element ? target : null;
  for (let i = 0; el && i < 6; i++, el = el.parentElement) {
    const style = getComputedStyle(el);
    const overflow = horizontal ? style.overflowX : style.overflowY;
    if (overflow !== "auto" && overflow !== "scroll") continue;
    const rolls = horizontal
      ? el.scrollWidth > el.clientWidth
      : el.scrollHeight > el.clientHeight;
    if (rolls) return true;
  }
  return false;
}

/**
 * Recuar por gesto, porque a app instalada no telemóvel não tem barra do
 * browser: arrastar do bordo esquerdo para a direita volta atrás — o mesmo
 * gesto em toda a app, incluindo no "Pôr em dia". O cartão do topo da pilha
 * ignora os primeiros 26px a partir do bordo (ver `SwipeCard`) para o
 * arrastar dele nunca competir com este.
 */
export default function BackGesture({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [offset, setOffset] = useState(0);
  const drag = useRef<{ id: number; x: number; y: number; live: boolean } | null>(null);

  const enabled = !ROOTS.has(pathname);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || e.pointerType === "mouse") return;
      if (e.clientX > EDGE) return;
      if (insideScroller(e.target, true)) return;
      drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, live: false };
    },
    [enabled],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;

    if (!d.live) {
      if (Math.abs(dx) < AXIS_LOCK) return;
      // desviou-se demasiado do eixo, ou foi para o lado errado: é scroll
      if (dx < 0 || Math.abs(dx) < Math.abs(dy) * 1.5) {
        drag.current = null;
        return;
      }
      d.live = true;
    }
    // resistência: puxar mais não desloca proporcionalmente
    setOffset(Math.min(dx * 0.7, 140));
  }, []);

  const endDrag = useCallback(() => {
    const d = drag.current;
    drag.current = null;
    if (!d?.live) return;
    const commit = offset > THRESHOLD;
    setOffset(0);
    if (!commit) return;
    if (window.history.length > 1) router.back();
    else router.push(parentOf(pathname));
  }, [offset, pathname, router]);

  const dragging = offset > 0;

  return (
    <div
      className="flex min-w-0 flex-1 flex-col"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {enabled && dragging && (
        <div
          aria-hidden
          className="pointer-events-none fixed left-3 top-1/2 z-50 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-panel text-ink shadow-lg"
          style={{
            opacity: Math.min(1, offset / THRESHOLD),
            transform: `translateY(-50%) scale(${0.8 + Math.min(1, offset / THRESHOLD) * 0.2})`,
          }}
        >
          ←
        </div>
      )}
      {/* o transform vive aqui dentro e só durante o gesto: permanente, tornaria
          este elemento o bloco de contenção de tudo o que é `fixed` lá dentro */}
      <div
        className="flex min-w-0 flex-1 flex-col"
        style={{
          transform: dragging ? `translateX(${offset}px)` : undefined,
          transition: dragging ? "none" : "transform 200ms ease-out",
        }}
      >
        {children}
      </div>
    </div>
  );
}
