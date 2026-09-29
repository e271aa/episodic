"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

/**
 * O filtro como o menu do iOS: uma cápsula «Em curso · 12 ▾» que abre uma
 * lista curta por cima do conteúdo, cada opção com a sua contagem e um ✓ na
 * escolhida. Substitui a fila de chips (seis botões à vista para uma só
 * escolha). `simples` dá a variante em texto, sem cápsula — a ordenação
 * («Última vista ▾»), que é secundária ao filtro.
 */
export default function MenuFiltro<T extends string>({
  opcoes,
  valor,
  onChange,
  rotulo,
  simples = false,
}: {
  opcoes: { valor: T; nome: string; contagem?: number }[];
  valor: T;
  onChange: (v: T) => void;
  /** o que o leitor de ecrã diz, ex. «Filtrar séries» */
  rotulo: string;
  simples?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const idLista = useId();
  const atual = opcoes.find((o) => o.valor === valor) ?? opcoes[0];

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", tecla);
    // o foco entra na opção escolhida, como num menu nativo
    raiz.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  return (
    <div ref={raiz} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={idLista}
        aria-label={`${rotulo}: ${atual.nome}`}
        onClick={() => setAberto((a) => !a)}
        className={`inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-[0.88rem] font-semibold text-label transition-transform active:scale-[0.97] ${
          simples ? "px-1 text-label-2" : "rounded-full bg-fill px-4"
        }`}
      >
        {atual.nome}
        {!simples && atual.contagem !== undefined && (
          <span className="ep-code font-medium text-label-2">· {atual.contagem}</span>
        )}
        <ChevronDown aria-hidden className="h-4 w-4 text-label-2" strokeWidth={2.4} />
      </button>
      {aberto && (
        <div
          id={idLista}
          role="menu"
          aria-label={rotulo}
          className="vidro menu-abre absolute left-0 top-full z-40 mt-2 min-w-56 overflow-hidden rounded-[14px] py-1"
        >
          {opcoes.map((o) => {
            const escolhida = o.valor === valor;
            return (
              <button
                key={o.valor}
                type="button"
                role="menuitemradio"
                aria-checked={escolhida}
                onClick={() => {
                  onChange(o.valor);
                  setAberto(false);
                }}
                className="flex min-h-11 w-full cursor-pointer items-center gap-3 px-4 text-left text-base text-label active:bg-fill"
              >
                <span className="w-4 shrink-0">
                  {escolhida && <Check aria-hidden className="h-4 w-4" strokeWidth={2.6} />}
                </span>
                <span className="flex-1">{o.nome}</span>
                {o.contagem !== undefined && (
                  <span className="ep-code text-[0.82rem] text-label-2">{o.contagem}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
