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
      className="page-enter absolute inset-0 z-30 flex cursor-pointer flex-col items-center justify-center rounded-[28px] bg-bg/80 p-5 text-center backdrop-blur-sm"
      data-testid="swipe-coach"
    >
      <p className="text-[1.18rem] font-semibold text-label">{titulo}</p>
      <p className="mt-1 max-w-[15rem] text-[0.88rem] text-label-2">{detalhe}</p>

      <div className="mt-6 grid w-full max-w-xs grid-cols-2 gap-3">
        {[esquerda, direita].map((lado) => (
          <div key={lado.seta} className="rounded-[22px] bg-group p-3">
            <span className="text-2xl" aria-hidden>
              {lado.seta}
            </span>
            <p className="mt-1 text-base font-semibold text-label">
              {lado.titulo}
            </p>
            <p className="mt-0.5 text-[0.76rem] text-label-2">{lado.detalhe}</p>
          </div>
        ))}
      </div>

      <p className="mt-5 text-[0.76rem] text-label-2">
        Também dá pelos botões em baixo, ou pelas setas do teclado.
      </p>
      <span className="mt-5 inline-flex min-h-[52px] items-center rounded-full bg-acao px-6 font-semibold text-on-label">
        Percebi
      </span>
    </div>
  );
}
