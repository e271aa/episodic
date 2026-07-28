"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bone } from "@/components/Skeleton";
import {
  addToList,
  createList,
  getLists,
  removeFromList,
  type CustomList,
} from "@/lib/db";

export interface AddToListButtonProps {
  kind: "show" | "movie";
  refId: string;
}

// Botão + painel para juntar esta série/filme a uma ou mais listas
// personalizadas — usado nas páginas de detalhe.
export default function AddToListButton({ kind, refId }: AddToListButtonProps) {
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<CustomList[] | null>(null);
  const [newName, setNewName] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const reload = useCallback(async () => {
    setLists(await getLists());
  }, []);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => void reload());
    return () => cancelAnimationFrame(raf);
  }, [open, reload]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const inList = useCallback(
    (list: CustomList) => list.items.some((i) => i.kind === kind && i.refId === refId),
    [kind, refId],
  );

  const toggle = useCallback(
    async (list: CustomList) => {
      if (inList(list)) await removeFromList(list.id, kind, refId);
      else await addToList(list.id, kind, refId);
      await reload();
    },
    [kind, refId, reload, inList],
  );

  const handleCreate = useCallback(async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const list = await createList(trimmed);
    await addToList(list.id, kind, refId);
    setNewName("");
    await reload();
  }, [newName, kind, refId, reload]);

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-line px-4 text-[15px] font-medium text-dim transition hover:bg-raised hover:text-ink"
      >
        + Lista
      </button>
      {open && (
        <div className="page-enter absolute left-0 top-full z-20 mt-2 w-64 rounded-2xl border border-line bg-panel p-3 shadow-lg">
          {lists === null ? (
            <Bone tone="raised" className="h-8 rounded-lg" />
          ) : lists.length === 0 ? (
            <p className="px-1 py-1 text-xs text-dim">Ainda não tens listas.</p>
          ) : (
            <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
              {lists.map((list) => (
                <li key={list.id}>
                  <button
                    onClick={() => void toggle(list)}
                    className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg px-2 text-left text-[15px] hover:bg-raised"
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        inList(list) ? "border-ink bg-ink" : "border-line"
                      }`}
                    >
                      {inList(list) && (
                        <svg viewBox="0 0 24 24" className="h-3 w-3 text-tube" fill="none">
                          <path
                            d="M20 6 9 17l-5-5"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </span>
                    <span className="truncate">{list.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form
            className="mt-2 flex gap-1.5 border-t border-line pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              void handleCreate();
            }}
          >
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nova lista…"
              className="min-h-11 flex-1 rounded-full border border-line bg-tube px-3 text-xs outline-none focus:border-ink"
            />
            <button
              type="submit"
              disabled={!newName.trim()}
              className="min-h-11 shrink-0 cursor-pointer rounded-full bg-ink px-3 text-xs font-semibold text-tube disabled:opacity-50"
            >
              Criar
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
