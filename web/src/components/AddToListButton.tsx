"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bone } from "@/components/Skeleton";
import Acao from "@/components/mira/Acao";
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
  /** por omissão é a pílula discreta de sempre; o Detalhe de série 2b passa
   *  o visual das duas ações lado a lado (48px, translúcida, largura igual) */
  className?: string;
  label?: string;
  /** o botão em si pode ser `flex-1`, mas sem o invólucro acompanhar (que por
   *  omissão é só `inline-block`) o flex não tem o que esticar — ficava um
   *  círculo pequeno em vez de ocupar metade da linha */
  wrapperClassName?: string;
}

const TRIGGER_DEFAULT =
  "flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full bg-fill-strong px-5 text-[0.88rem] font-semibold text-label transition active:scale-[0.97]";

// Botão + painel para juntar esta série/filme a uma ou mais listas
// personalizadas — usado nas páginas de detalhe.
export default function AddToListButton({
  kind,
  refId,
  className = TRIGGER_DEFAULT,
  label = "+ Lista",
  wrapperClassName = "relative inline-block",
}: AddToListButtonProps) {
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
    <div ref={rootRef} className={wrapperClassName}>
      <button onClick={() => setOpen((v) => !v)} className={className}>
        {label}
      </button>
      {open && (
        <div className="page-enter vidro absolute left-0 top-full z-20 mt-2 w-72 max-w-full rounded-[22px] p-2">
          {lists === null ? (
            <Bone tone="raised" className="m-1 h-8 rounded-lg" />
          ) : lists.length === 0 ? (
            <p className="px-3 py-2 text-[0.88rem] text-label-2">Ainda não tens listas.</p>
          ) : (
            <ul className="flex max-h-56 flex-col overflow-y-auto">
              {lists.map((list) => (
                <li key={list.id}>
                  <button
                    role="menuitemcheckbox"
                    aria-checked={inList(list)}
                    onClick={() => void toggle(list)}
                    className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-2xl px-3 text-left text-base text-label transition-colors active:bg-fill"
                  >
                    <span
                      className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full ${
                        inList(list)
                          ? "bg-label text-on-label"
                          : "shadow-[inset_0_0_0_1.5px_var(--m-label-3)]"
                      }`}
                    >
                      {inList(list) && (
                        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" aria-hidden>
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
            className="mt-1 flex gap-2 border-t-[0.5px] border-separator p-1 pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              void handleCreate();
            }}
          >
            <input
              aria-label="Nome da nova lista"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nova lista…"
              className="min-h-11 w-0 flex-1 rounded-full bg-fill px-4 text-base text-label outline-none placeholder:text-label-2"
            />
            <Acao type="submit" tipo="secundaria" grande={false} disabled={!newName.trim()}>
              Criar
            </Acao>
          </form>
        </div>
      )}
    </div>
  );
}
