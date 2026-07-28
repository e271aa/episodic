"use client";

import { useEffect, type ReactNode } from "react";
import { CloseIcon } from "@/components/icons";

/**
 * Painel que sobe de baixo. Serve o que saiu do cabeçalho da Biblioteca — os
 * filtros e a ordenação — sem os pôr de volta no fluxo.
 *
 * Sobe de baixo e não desce de cima porque é de baixo que vem o toque: o
 * botão que o abre está na barra flutuante, e o painel aparece a partir dela.
 */
export default function SheetPanel({
  titulo,
  aberto,
  onFechar,
  children,
}: {
  titulo: string;
  aberto: boolean;
  onFechar: () => void;
  children: ReactNode;
}) {
  // Fechar com Escape — quem tem teclado espera isto, e é a saída óbvia
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={titulo}>
      {/* O véu escurece o suficiente para o painel ser o assunto, e fecha ao
          toque — a saída não pode depender de acertar num botão pequeno. */}
      <button
        aria-label="Fechar"
        onClick={onFechar}
        className="absolute inset-0 cursor-default bg-tube/70 backdrop-blur-sm"
      />
      <div className="page-enter absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-3xl border-t border-line bg-panel pb-[calc(var(--dock-h)+1rem)]">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-panel px-5 py-4">
          <p className="font-display text-[17px] font-bold [font-stretch:105%]">{titulo}</p>
          <button
            onClick={onFechar}
            aria-label="Fechar"
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-dim transition hover:text-ink active:scale-95"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
