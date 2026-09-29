"use client";

import { useCallback, useState } from "react";
import { createList } from "@/lib/db";
import { recursoListas, useListas } from "@/lib/cache";
import { ListVideo } from "lucide-react";
import { Grupo, Linha } from "@/components/mira/Grupo";
import Acao from "@/components/mira/Acao";
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
      <p className="text-[0.88rem] text-label-2">
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
          className="min-h-11 min-w-0 flex-1 rounded-[22px] bg-fill px-4 text-base text-label outline-none placeholder:text-label-2"
        />
        <Acao type="submit" tipo="secundaria" grande={false} disabled={creating || !name.trim()}>
          Criar
        </Acao>
      </form>

      {lists === null ? (
        <CardsBone count={3} height="h-16" />
      ) : lists.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center">
          <ListVideo aria-hidden className="h-12 w-12 text-label-3" strokeWidth={1.5} />
          <p className="mt-4 max-w-sm text-[1.18rem] font-semibold text-label">Ainda sem listas</p>
          <p className="mt-2 max-w-sm text-[0.88rem] text-label-2">
            Cria a primeira acima — depois adiciona séries e filmes a partir da
            página de cada um.
          </p>
        </div>
      ) : (
        <Grupo className="mt-6">
          {lists.map((list) => (
            <Linha
              key={list.id}
              href={`/listas/${list.id}`}
              titulo={list.name}
              depois={<span className="ep-code">{list.items.length}</span>}
            />
          ))}
        </Grupo>
      )}
    </div>
  );
}
