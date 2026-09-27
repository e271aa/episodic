"use client";

import { useEffect, useState } from "react";
import { kvGet, kvSet } from "@/lib/db";

export const EM_DIA_COACH_KEY = "em-dia:coach-visto";
export const EXPLORAR_COACH_KEY = "explorar:coach-visto";

interface Lado {
  seta: "←" | "→";
  titulo: string;
  detalhe: string;
}

/**
 * Instruções da primeira utilização de um cartão arrastável: quem chega não
 * tem como adivinhar que se arrasta, nem para que lado faz o quê. Aparecem
 * por cima da pilha, explicam os dois lados e desaparecem para sempre ao
 * primeiro toque — cada ecrã que arrasta cartões guarda a sua própria chave
 * em kv, para o "Pôr em dia" já visto não dispensar o do Explorar.
 *
 * Fica montado sempre (não condicionado por estado assíncrono): enquanto não
 * se sabe se já foi visto, não desenha nada — assim nunca pisca para quem já
 * conhece o gesto.
 */
export default function SwipeCoach({
  kvKey,
  titulo,
  detalhe,
  esquerda,
  direita,
}: {
  kvKey: string;
  titulo: string;
  detalhe: string;
  esquerda: Lado;
  direita: Lado;
}) {
  const [show, setShow] = useState<boolean | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      void kvGet<boolean>(kvKey).then((seen) => setShow(!seen));
    });
    return () => cancelAnimationFrame(raf);
  }, [kvKey]);

  const dismiss = () => {
    setShow(false);
    void kvSet(kvKey, true);
  };

  if (show !== true) return null;

  return (
    <div
      onClick={dismiss}
      className="page-enter absolute inset-0 z-30 flex cursor-pointer flex-col items-center justify-center rounded-3xl bg-tube/80 p-5 text-center backdrop-blur-sm"
      data-testid="swipe-coach"
    >
      <p className="font-display text-lg font-bold [font-stretch:105%]">{titulo}</p>
      <p className="mt-1 max-w-[15rem] text-[0.9375rem] text-dim">{detalhe}</p>

      <div className="mt-6 grid w-full max-w-xs grid-cols-2 gap-3">
        {[esquerda, direita].map((lado) => (
          <div key={lado.seta} className="rounded-2xl border border-line bg-panel/80 p-3">
            <span className="text-2xl" aria-hidden>
              {lado.seta}
            </span>
            <p className="mt-1 font-display text-[0.9375rem] font-bold uppercase [font-stretch:80%]">
              {lado.titulo}
            </p>
            <p className="mt-0.5 text-xs text-dim">{lado.detalhe}</p>
          </div>
        ))}
      </div>

      <p className="mt-5 text-xs text-faint">
        Também dá pelos botões em baixo, ou pelas setas do teclado.
      </p>
      <span className="mt-5 rounded-full bg-ink px-6 py-2.5 text-[0.9375rem] font-semibold text-tube">
        Percebi
      </span>
    </div>
  );
}
