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
 * browser: arrastar do bordo esquerdo para a direita volta atrás.
 *
 * Na triagem o eixo horizontal é dos cartões, por isso aí recua-se de cima
 * para baixo — e nunca a partir da própria pilha, que tem o gesto dela.
 */
export default function BackGesture({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [offset, setOffset] = useState(0);
  const drag = useRef<{ id: number; x: number; y: number; live: boolean } | null>(null);

  const vertical = pathname === "/triagem";
  const enabled = !ROOTS.has(pathname);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || e.pointerType === "mouse") return;
      if (vertical) {
        // a pilha de cartões trata do gesto dela; e só do topo da página,
        // para não roubar o arrastar a quem está a percorrer a lista
        if ((e.target as Element).closest?.("[data-swipe-stack]")) return;
        if (window.scrollY > 0) return;
      } else if (e.clientX > EDGE) {
        return;
      }
      if (insideScroller(e.target, !vertical)) return;
      drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, live: false };
    },
    [enabled, vertical],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      const along = vertical ? dy : dx;
      const across = vertical ? dx : dy;

      if (!d.live) {
        if (Math.abs(along) < AXIS_LOCK) return;
        // desviou-se demasiado do eixo, ou foi para o lado errado: é scroll
        if (along < 0 || Math.abs(along) < Math.abs(across) * 1.5) {
          drag.current = null;
          return;
        }
        d.live = true;
      }
      // resistência: puxar mais não desloca proporcionalmente
      setOffset(Math.min(along * 0.7, 140));
    },
    [vertical],
  );

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
      className="flex flex-1 flex-col"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {enabled && dragging && (
        <div
          aria-hidden
          className={`pointer-events-none fixed z-50 flex h-11 w-11 items-center justify-center rounded-full bg-panel text-ink shadow-lg ${
            vertical
              ? "left-1/2 top-3 -translate-x-1/2"
              : "left-3 top-1/2 -translate-y-1/2"
          }`}
          style={{
            opacity: Math.min(1, offset / THRESHOLD),
            transform: `${vertical ? "translateX(-50%)" : "translateY(-50%)"} scale(${
              0.8 + Math.min(1, offset / THRESHOLD) * 0.2
            })`,
          }}
        >
          {vertical ? "↓" : "←"}
        </div>
      )}
      {/* o transform vive aqui dentro e só durante o gesto: permanente, tornaria
          este elemento o bloco de contenção de tudo o que é `fixed` lá dentro */}
      <div
        className="flex flex-1 flex-col"
        style={{
          transform: dragging
            ? `translate${vertical ? "Y" : "X"}(${offset}px)`
            : undefined,
          transition: dragging ? "none" : "transform 200ms ease-out",
        }}
      >
        {children}
      </div>
    </div>
  );
}
