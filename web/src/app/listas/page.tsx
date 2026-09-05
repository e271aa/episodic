"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createList, getLists, type CustomList } from "@/lib/db";
import BotaoVoltar from "@/components/BotaoVoltar";
import { LibraryIcon } from "@/components/icons";
import { CardsBone } from "@/components/Skeleton";

export default function ListasPage() {
  const [lists, setLists] = useState<CustomList[] | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const reload = useCallback(async () => {
    setLists(await getLists());
  }, []);

  useEffect(() => {
    const raf = requestAnimationFrame(() => void reload());
    return () => cancelAnimationFrame(raf);
  }, [reload]);

  const handleCreate = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      await createList(trimmed);
      setName("");
      await reload();
    } finally {
      setCreating(false);
    }
  }, [name, reload]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pt-8 pb-[calc(var(--dock-h)+2rem)]">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold [font-stretch:110%]">Listas</h1>
        <BotaoVoltar
          label="Voltar à biblioteca"
          fallback="/library"
          className="-mr-2 inline-flex min-h-11 items-center px-2 text-[15px] text-dim hover:text-ink hover:underline"
        >
          Biblioteca
        </BotaoVoltar>
      </div>
      <p className="mt-1 text-[15px] text-dim">
        Junta séries e filmes como quiseres — maratonas, favoritos, o que for.
      </p>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void handleCreate();
        }}
      >
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome da nova lista…"
          className="min-h-11 flex-1 rounded-full border border-line bg-panel px-5 text-base outline-none transition-colors focus:border-ink"
        />
        <button
          type="submit"
          disabled={creating || !name.trim()}
          className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-ink px-5 text-[15px] font-semibold text-tube transition hover:brightness-110 active:scale-95 disabled:opacity-50"
        >
          Criar
        </button>
      </form>

      {lists === null ? (
        <CardsBone count={3} height="h-16" />
      ) : lists.length === 0 ? (
        // Centrado no espaço que sobra, não a 16 fixos do topo — um vazio a
        // meio do ecrã lê-se como "não há nada"; um vazio encostado ao topo,
        // com 600px de nada por baixo, lê-se como "isto está partido".
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <LibraryIcon className="h-12 w-12 text-faint" />
          <p className="mt-4 max-w-sm font-display font-semibold">Ainda sem listas</p>
          <p className="mt-2 max-w-sm text-[15px] text-dim">
            Cria a primeira acima — depois adiciona séries e filmes a partir da
            página de cada um.
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-2">
          {lists.map((list) => (
            <Link
              key={list.id}
              href={`/listas/${list.id}`}
              className="ep-card ep-card-hover flex items-center gap-3 p-4"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-display font-semibold text-ink">
                  {list.name}
                </span>
                <span className="ep-code block text-xs text-dim">
                  {list.items.length}{" "}
                  {list.items.length === 1 ? "item" : "itens"}
                </span>
              </span>
              <span className="text-faint">→</span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
