"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  GRACE_MS,
  dismissAll,
  subscribeUndo,
  undoLast,
  type UndoEntry,
} from "@/lib/undo";

/** quanto dura a saída — tem de bater com `.undo-out` no CSS */
const SAIDA_MS = 160;

/**
 * O aviso de anular. Mostra sempre a ação mais recente; quando há várias
 * dentro da janela, diz quantas ficam por trás — anular repetidamente recua
 * pela ordem inversa, como um Cmd+Z.
 *
 * Sai pelo caminho por onde entrou, em vez de desaparecer de golpe (Ronda
 * 12, Fase 6): o último aviso fica o tempo de descer, já sem se poder tocar.
 */
export default function UndoToast() {
  const [entries, setEntries] = useState<UndoEntry[]>([]);
  const pathname = usePathname();

  useEffect(() => subscribeUndo(setEntries), []);

  // Mudar de ecrã fecha a janela: anular algo que já não está à vista seria
  // desfazer às cegas.
  useEffect(() => {
    dismissAll();
  }, [pathname]);

  const top = entries[entries.length - 1];
  const behind = entries.length - 1;

  // O último aviso mostrado, para o poder levar até ao fim da saída depois
  // de a lista já estar vazia. Acertado durante o render, como no SheetPanel.
  const [ultimo, setUltimo] = useState<UndoEntry | null>(null);
  const [aSair, setASair] = useState<UndoEntry | null>(null);
  if (top && top !== ultimo) setUltimo(top);
  if (top && aSair) setASair(null);
  if (!top && ultimo && aSair !== ultimo) setASair(ultimo);
  useEffect(() => {
    if (!aSair) return;
    const t = setTimeout(() => {
      setASair(null);
      setUltimo(null);
    }, SAIDA_MS);
    return () => clearTimeout(t);
  }, [aSair]);

  const mostrado = top ?? aSair;

  // A região existe sempre, vazia quando não há aviso: uma região que nasce
  // já com o texto lá dentro muitas vezes não é lida. Sem `role="status"`,
  // o VoiceOver não dizia que se tinha marcado ou removido nada (WCAG 4.1.3,
  // Ronda 12, Fase 4).
  return (
    <div
      role="status"
      aria-live="polite"
      // Logo acima da dock, pela mesma medida (`--dock-h` já traz a área
      // segura do iPhone). Estava a 64px do fundo, fosse qual fosse a dock:
      // sem área segura, entrava 10px nela (medido na Fase 6).
      className="pointer-events-none fixed inset-x-0 z-50 mx-auto max-w-2xl px-4"
      style={{ bottom: "calc(var(--dock-h) + 0.5rem)" }}
    >
      {mostrado && (
        <div
          // a chave reinicia a animação a cada ação nova, para a contagem
          // recomeçar em vez de continuar a do aviso anterior
          key={mostrado.id}
          className={`${top ? "undo-in pointer-events-auto" : "undo-out"} overflow-hidden rounded-2xl border border-line bg-raised shadow-lg shadow-black/50`}
          data-testid={top ? "undo-toast" : "undo-toast-a-sair"}
          // a sair já não se anula nada: nem toque, nem teclado
          inert={!top}
        >
          <div className="flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.9375rem] font-medium">
                {mostrado.label}
                {behind > 0 && (
                  <span className="ep-code ml-2 text-xs text-faint">+{behind}</span>
                )}
              </p>
              {mostrado.detail && (
                <p className="ep-code mt-0.5 truncate text-xs text-dim">{mostrado.detail}</p>
              )}
            </div>
            <button
              onClick={() => undoLast()}
              className="flex min-h-11 shrink-0 cursor-pointer items-center rounded-full bg-ink px-4 text-[0.9375rem] font-semibold text-tube transition hover:brightness-110 active:scale-95"
              data-testid="undo-button"
            >
              Anular
            </button>
          </div>
          <div
            className="undo-drain h-[3px] bg-ink/70"
            style={{ animationDuration: `${GRACE_MS}ms` }}
          />
        </div>
      )}
    </div>
  );
}
