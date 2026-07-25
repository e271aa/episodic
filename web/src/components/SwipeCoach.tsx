"use client";

import { useEffect, useState } from "react";
import { kvGet, kvSet } from "@/lib/db";

/** Guardado em kv: uma vez percebido, nunca mais aparece. */
export const COACH_KEY = "triagem:coach-visto";

/**
 * Instruções da primeira utilização: quem chega à triagem não tem como
 * adivinhar que o cartão se arrasta, nem para que lado. Aparecem por cima da
 * pilha, explicam os dois lados e desaparecem para sempre ao primeiro toque.
 *
 * Fica montado sempre (não condicionado por estado assíncrono): enquanto não
 * se sabe se já foi visto, não desenha nada — assim nunca pisca para quem já
 * conhece o gesto.
 */
export default function SwipeCoach() {
  const [show, setShow] = useState<boolean | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      void kvGet<boolean>(COACH_KEY).then((seen) => setShow(!seen));
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const dismiss = () => {
    setShow(false);
    void kvSet(COACH_KEY, true);
  };

  if (show !== true) return null;

  return (
    <div
      onClick={dismiss}
      className="page-enter absolute inset-0 z-30 flex cursor-pointer flex-col items-center justify-center rounded-3xl bg-tube/80 p-5 text-center backdrop-blur-sm"
      data-testid="swipe-coach"
    >
      <p className="font-display text-lg font-bold [font-stretch:105%]">
        Arrasta o cartão
      </p>
      <p className="mt-1 max-w-[15rem] text-sm text-dim">
        Cada cartão é o próximo episódio por ver de uma série.
      </p>

      <div className="mt-6 grid w-full max-w-xs grid-cols-2 gap-3">
        <div className="rounded-2xl border border-line bg-panel/80 p-3">
          <span className="text-2xl" aria-hidden>
            ←
          </span>
          <p className="mt-1 font-display text-sm font-bold uppercase [font-stretch:80%]">
            Ainda não
          </p>
          <p className="mt-0.5 text-xs text-dim">Passa à frente sem marcar</p>
        </div>
        <div className="rounded-2xl border border-line bg-panel/80 p-3">
          <span className="text-2xl" aria-hidden>
            →
          </span>
          <p className="mt-1 font-display text-sm font-bold uppercase [font-stretch:80%]">
            Visto
          </p>
          <p className="mt-0.5 text-xs text-dim">Marca o episódio como visto</p>
        </div>
      </div>

      <p className="mt-5 text-xs text-faint">
        Também dá pelos botões em baixo, ou pelas setas do teclado.
      </p>
      <span className="mt-5 rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-tube">
        Percebi
      </span>
    </div>
  );
}
