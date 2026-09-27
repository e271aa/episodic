"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "@/components/icons";

/**
 * Painel que sobe de baixo. Serve o que saiu do cabeçalho da Biblioteca — os
 * filtros e a ordenação — sem os pôr de volta no fluxo.
 *
 * Sobe de baixo e não desce de cima porque é de baixo que vem o toque: o
 * botão que o abre está na barra flutuante, e o painel aparece a partir dela.
 *
 * Vai por portal para o `body` pela mesma razão que o `LibraryControls`: o
 * `PageTransition` envolve as páginas num elemento com `transform`, e um
 * transform — mesmo identidade — torna-se o bloco de referência de qualquer
 * descendente `position: fixed`. Sem o portal, o painel assentava no fundo
 * do **documento** em vez do fundo do ecrã, e era preciso rolar a página
 * inteira para lá chegar.
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

  const painelRef = useRef<HTMLDivElement>(null);
  const antesDeAbrir = useRef<HTMLElement | null>(null);

  // Gestão de foco: sem isto, um teclado ou o VoiceOver ficava no botão por
  // trás do véu, e fechar não devolvia o foco a lado nenhum (Ronda 12, Fase
  // 4, achado #13). Guarda quem tinha o foco, move-o para o painel ao abrir,
  // devolve-o ao fechar.
  useEffect(() => {
    if (!aberto) return;
    antesDeAbrir.current = document.activeElement as HTMLElement | null;
    painelRef.current?.focus();
    return () => antesDeAbrir.current?.focus();
  }, [aberto]);

  // Tab não sai do painel enquanto ele está aberto — o resto da página está
  // atrás de um véu que fecha ao toque, não é um sítio para onde navegar.
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !painelRef.current) return;
      const focaveis = painelRef.current.querySelectorAll<HTMLElement>(
        'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focaveis.length === 0) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto]);

  // O portal só pode montar no cliente: no servidor não há `document`.
  const noCliente = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!aberto || !noCliente) return null;

  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={titulo}>
      {/* O véu escurece o suficiente para o painel ser o assunto, e fecha ao
          toque — a saída não pode depender de acertar num botão pequeno. */}
      <button
        aria-label="Fechar"
        onClick={onFechar}
        className="absolute inset-0 cursor-default bg-tube/70 backdrop-blur-sm"
      />
      <div
        ref={painelRef}
        tabIndex={-1}
        className="page-enter absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-3xl border-t border-line bg-panel pb-[calc(var(--dock-h)+1rem)] outline-none"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-panel px-5 py-4">
          <p className="font-display text-[0.9375rem] font-bold [font-stretch:105%]">{titulo}</p>
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
    </div>,
    document.body,
  );
}
