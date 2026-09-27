"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { createList } from "@/lib/db";
import { recursoListas, useListas } from "@/lib/cache";
import { LibraryIcon } from "@/components/icons";
import { CardsBone } from "@/components/Skeleton";

/**
 * As listas: criar uma e ver as que há. É o terceiro separador da
 * Biblioteca (Séries · Filmes · Listas) — escolhido pelo Ruben a 27-09 (Ronda
 * 12, Fase 5b.3). Antes só se chegava aqui pela folha de ordenar, em
 * "Coleções", um sítio que ninguém ia procurar.
 */
export default function ListasConteudo() {
  const lists = useListas();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      await createList(trimmed);
      setName("");
      await recursoListas.revalidar();
    } finally {
      setCreating(false);
    }
  }, [name]);

  return (
    <div className="flex flex-1 flex-col">
      <p className="text-[0.9375rem] text-dim">
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
          aria-label="Nome da nova lista"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome da nova lista…"
          className="min-h-11 min-w-0 flex-1 rounded-full border border-line bg-panel px-5 text-base outline-none transition-colors focus:border-ink"
        />
        <button
          type="submit"
          disabled={creating || !name.trim()}
          className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-ink px-5 text-[0.9375rem] font-semibold text-tube transition hover:brightness-110 active:scale-95 disabled:opacity-50"
        >
          Criar
        </button>
      </form>

      {lists === null ? (
        <CardsBone count={3} height="h-16" />
      ) : lists.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center">
          <LibraryIcon className="h-12 w-12 text-faint" />
          <p className="mt-4 max-w-sm font-display font-semibold">Ainda sem listas</p>
          <p className="mt-2 max-w-sm text-[0.9375rem] text-dim">
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
                <span className="block font-display font-semibold text-ink">{list.name}</span>
                <span className="ep-code block text-xs text-dim">
                  {list.items.length} {list.items.length === 1 ? "item" : "itens"}
                </span>
              </span>
              <span className="text-faint">→</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
