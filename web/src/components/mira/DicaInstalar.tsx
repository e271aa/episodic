"use client";

import { useEffect, useState } from "react";
import { Share, X } from "lucide-react";

const DISMISS_KEY = "episodic-ios-install-dismissed";

/**
 * «Instala no iPhone» — no fluxo da página, nunca a flutuar.
 *
 * Vivia no layout, `fixed` a 64px do fundo, por cima de qualquer ecrã: com a
 * barra da Mira, mais alta, tapava as duas portas da casa vazia — o primeiro
 * contacto de um amigo que abre o convite no Safari (crítica da Fase 3,
 * medido a 430 e a 390). Agora é uma linha da casa, por baixo do que se faz:
 * não tapa nada, e dispensa-se de vez.
 *
 * Só no Safari do iPhone, fora da app instalada (onde não há prompt de
 * instalação do sistema).
 */
export default function DicaInstalar() {
  const [mostrar, setMostrar] = useState(false);

  useEffect(() => {
    // fora do corpo do efeito, para não encadear renders
    const raf = requestAnimationFrame(() => {
      const iOS = /ipad|iphone|ipod/.test(navigator.userAgent.toLowerCase());
      const instalada =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as unknown as { standalone?: boolean }).standalone === true;
      let dispensada = false;
      try {
        dispensada = localStorage.getItem(DISMISS_KEY) === "1";
      } catch {
        // sem armazenamento: mostra-se, e dispensa-se só nesta visita
      }
      if (iOS && !instalada && !dispensada) setMostrar(true);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!mostrar) return null;

  return (
    <div className="mt-6 flex items-center gap-3 rounded-[26px] bg-group py-3 pl-4 pr-2" data-testid="dica-instalar">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fill text-label">
        <Share aria-hidden className="h-[18px] w-[18px]" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-label">Instala no iPhone</p>
        <p className="text-[0.88rem] leading-snug text-label-2">
          Partilhar › Adicionar ao ecrã principal
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          try {
            localStorage.setItem(DISMISS_KEY, "1");
          } catch {
            // sem armazenamento: fica dispensada só até sair
          }
          setMostrar(false);
        }}
        aria-label="Dispensar"
        className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-label-2 active:scale-95"
      >
        <X aria-hidden className="h-5 w-5" strokeWidth={2} />
      </button>
    </div>
  );
}
