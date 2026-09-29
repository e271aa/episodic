"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * O título grande do iOS: «A seguir», «Biblioteca», «Explorar», «Perfil» a
 * 34px no topo; quando sai do ecrã ao rolar, aparece em cima uma barra
 * compacta de vidro com o mesmo nome a 17px (e, se houver, um resumo —
 * «Todas · 138»). O título grande é o `<h1>`; a barra é só um eco visual.
 */
export default function TituloGrande({
  titulo,
  rotulo,
  resumo,
  direita,
}: {
  titulo: string;
  /** o rótulo por cima do título (ex. a data, «TERÇA, 29 DE SETEMBRO») */
  rotulo?: ReactNode;
  /** o que a barra compacta mostra por baixo do nome */
  resumo?: ReactNode;
  /** uma ação ao lado do título (ex. «Pôr em dia 4») */
  direita?: ReactNode;
}) {
  const ancora = useRef<HTMLHeadingElement>(null);
  const [recolhido, setRecolhido] = useState(false);

  useEffect(() => {
    const el = ancora.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setRecolhido(!e.isIntersecting), {
      // recolhe quando o título passa por baixo da área segura de cima
      rootMargin: "-44px 0px 0px 0px",
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <>
      <div
        aria-hidden
        className={`vidro fixed inset-x-0 top-0 z-30 flex flex-col items-center justify-end pb-2 pt-[max(12px,env(safe-area-inset-top))] transition-opacity duration-200 ${
          recolhido ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        style={{ borderRadius: 0 }}
      >
        <span className="text-base font-semibold text-label">{titulo}</span>
        {resumo && <span className="ep-code text-[0.7rem] text-label-2">{resumo}</span>}
      </div>
      {/* `flex-wrap`: com texto grande a ação do lado passa para baixo, em vez
          de espremer o título em duas linhas («A / seguir» a 320px e 150%) */}
      <header className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2 pt-2">
        <div className="min-w-0 max-w-full">
          {rotulo && (
            <p className="text-[0.76rem] font-semibold uppercase tracking-[0.02em] text-label-2">
              {rotulo}
            </p>
          )}
          <h1
            ref={ancora}
            className="text-[2rem] font-bold leading-[1.15] tracking-[0.01em] text-label"
          >
            {titulo}
          </h1>
        </div>
        {direita && <div className="shrink-0 pb-1">{direita}</div>}
      </header>
    </>
  );
}
