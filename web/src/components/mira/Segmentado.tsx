"use client";

import type { ReactNode } from "react";

/**
 * O controlo segmentado do iOS: uma escolha entre poucas opções que mudam o
 * que se vê (Séries · Filmes · Listas; T1 · T2; Automático · Noite · Claro).
 *
 * É uma escolha, não uma ação: o escolhido é `segment` (cinza claro à noite,
 * branco com sombra de dia) — nunca a cápsula da ação (Regra da ação).
 * O desenho dá 34px ao segmento; o alvo de toque é 44px, porque o fundo tem
 * 3px de margem e cada segmento estica a área até lá.
 */
export default function Segmentado<T extends string>({
  opcoes,
  valor,
  onChange,
  rotulo,
  className = "",
}: {
  opcoes: { valor: T; nome: ReactNode; contagem?: number }[];
  valor: T;
  onChange: (v: T) => void;
  /** o que o leitor de ecrã diz do grupo, ex. «Tipo de biblioteca» */
  rotulo: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={rotulo}
      className={`flex min-h-11 rounded-[22px] bg-fill p-[3px] ${className}`}
    >
      {opcoes.map((o) => {
        const escolhido = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={escolhido}
            onClick={() => onChange(o.valor)}
            className={`flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[19px] px-2 text-[0.88rem] font-semibold transition-[background-color,box-shadow] duration-200 ${
              escolhido
                ? "bg-segment text-label shadow-[0_1px_4px_rgba(0,0,0,0.14)]"
                : "text-label-2"
            }`}
          >
            <span className="truncate">{o.nome}</span>
            {o.contagem !== undefined && (
              <span className="ep-code text-[0.76rem] font-medium text-label-2">{o.contagem}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
