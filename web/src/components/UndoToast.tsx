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

/**
 * O aviso de anular. Mostra sempre a ação mais recente; quando há várias
 * dentro da janela, diz quantas ficam por trás — anular repetidamente recua
 * pela ordem inversa, como um Cmd+Z.
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
  if (!top) return null;

  const behind = entries.length - 1;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-16 z-50 mx-auto max-w-2xl px-4 pb-[env(safe-area-inset-bottom)]">
      <div
        // a chave reinicia a animação a cada ação nova, para a contagem
        // recomeçar em vez de continuar a do aviso anterior
        key={top.id}
        className="undo-in pointer-events-auto overflow-hidden rounded-2xl border border-line bg-raised shadow-lg shadow-black/50"
        data-testid="undo-toast"
      >
        <div className="flex items-center gap-3 p-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-medium">
              {top.label}
              {behind > 0 && (
                <span className="ep-code ml-2 text-xs text-faint">+{behind}</span>
              )}
            </p>
            {top.detail && (
              <p className="ep-code mt-0.5 truncate text-xs text-dim">{top.detail}</p>
            )}
          </div>
          <button
            onClick={() => undoLast()}
            className="shrink-0 cursor-pointer rounded-full bg-ink px-4 py-2 text-[15px] font-semibold text-tube transition hover:brightness-110 active:scale-95"
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
    </div>
  );
}
