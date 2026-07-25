"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  deleteList,
  getList,
  getShow,
  getMovie,
  removeFromList,
  renameList,
  type CustomList,
  type StoredShow,
  type StoredMovie,
} from "@/lib/db";
import Poster from "@/components/Poster";

interface ResolvedItem {
  kind: "show" | "movie";
  refId: string;
  href: string;
  name: string;
  posterPath: string | null;
}

export default function ListaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [list, setList] = useState<CustomList | null | undefined>(undefined);
  const [items, setItems] = useState<ResolvedItem[]>([]);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    const stored = await getList(id);
    setList(stored ?? null);
    if (!stored) return;
    setName(stored.name);
    const resolved = await Promise.all(
      stored.items.map(async (item): Promise<ResolvedItem | null> => {
        if (item.kind === "show") {
          const show: StoredShow | null = await getShow(item.refId);
          if (!show) return null;
          return {
            kind: "show",
            refId: item.refId,
            href: `/series/${item.refId}`,
            name: show.name,
            posterPath: show.posterPath,
          };
        }
        const movie: StoredMovie | null = await getMovie(item.refId);
        if (!movie) return null;
        return {
          kind: "movie",
          refId: item.refId,
          href: `/movies/${item.refId}`,
          name: movie.name,
          posterPath: movie.posterPath ?? null,
        };
      }),
    );
    setItems(resolved.filter((i): i is ResolvedItem => i !== null));
  }, [id]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => void load());
    return () => cancelAnimationFrame(raf);
  }, [load]);

  const handleRename = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed || !list) return;
    await renameList(list.id, trimmed);
    setEditingName(false);
    await load();
  }, [name, list, load]);

  const handleDelete = useCallback(async () => {
    if (!list) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await deleteList(list.id);
    router.push("/listas");
  }, [list, confirmDelete, router]);

  const handleRemoveItem = useCallback(
    async (item: ResolvedItem) => {
      if (!list) return;
      await removeFromList(list.id, item.kind, item.refId);
      await load();
    },
    [list, load],
  );

  if (list === undefined) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-panel" />
      </main>
    );
  }

  if (list === null) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-dim">Lista não encontrada.</p>
        <Link href="/listas" className="mt-4 inline-block cursor-pointer text-ink underline">
          Voltar às listas
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link href="/listas" className="text-sm text-dim hover:text-ink hover:underline">
        ← Listas
      </Link>

      <div className="mt-2 flex items-center justify-between gap-3">
        {editingName ? (
          <form
            className="flex flex-1 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void handleRename();
            }}
          >
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-h-11 flex-1 rounded-full border border-line bg-panel px-4 text-lg font-bold outline-none focus:border-ink"
            />
            <button
              type="submit"
              className="min-h-11 cursor-pointer rounded-full bg-ink px-4 text-sm font-semibold text-tube"
            >
              Guardar
            </button>
          </form>
        ) : (
          <h1
            onClick={() => setEditingName(true)}
            className="cursor-pointer font-display text-2xl font-bold [font-stretch:110%]"
            title="Toca para renomear"
          >
            {list.name}
          </h1>
        )}
      </div>
      <p className="ep-code mt-1 text-xs text-dim">
        {items.length} {items.length === 1 ? "item" : "itens"}
      </p>

      {items.length === 0 ? (
        <p className="mt-10 text-center text-sm text-dim">
          Sem itens ainda — adiciona séries e filmes a partir da página de cada um.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {items.map((item) => {
            return (
              <div key={`${item.kind}-${item.refId}`} className="group relative">
                <Link href={item.href} className="block cursor-pointer active:scale-[0.97]">
                  <div className="relative aspect-2/3 overflow-hidden rounded-2xl bg-panel shadow-md shadow-black/30">
                    {item.posterPath ? (
                      <Poster
                        path={item.posterPath}
                        alt={item.name}
                        fill
                        sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, 20vw"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-raised p-2 text-center font-display text-sm font-bold text-dim">
                        {item.name}
                      </div>
                    )}
                  </div>
                  <p className="mt-1.5 truncate text-sm font-medium">{item.name}</p>
                </Link>
                <button
                  onClick={() => void handleRemoveItem(item)}
                  aria-label={`Remover ${item.name} da lista`}
                  className="absolute right-1.5 top-1.5 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white opacity-0 backdrop-blur transition-opacity active:scale-90 group-hover:opacity-100"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
                    <path
                      d="M6 6l12 12M18 6L6 18"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={() => void handleDelete()}
        className="mt-10 cursor-pointer rounded-2xl border border-danger/40 px-4 py-3 text-sm font-medium text-danger transition-colors hover:bg-danger/10"
      >
        {confirmDelete ? "Tens a certeza? Toca outra vez para apagar" : "Apagar lista"}
      </button>
    </main>
  );
}
