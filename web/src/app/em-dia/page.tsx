"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { markWatched, unmarkWatched } from "@/lib/db";
import { loadShows, type ShowWithProgress } from "@/lib/shows";
import { classifyQueue, loadCachedNextUp, type NextUpMap } from "@/lib/queue";
import { formatEpCode } from "@/lib/watchnext";
import { pushUndo } from "@/lib/undo";
import type { MetaEpisode } from "@/lib/metadata";
import SwipeCard from "@/components/SwipeCard";
import SwipeCoach from "@/components/SwipeCoach";
import { CheckIcon } from "@/components/icons";

type Filter = "continuar" | "retomar" | "comecar" | "todas";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "continuar", label: "Continuar" },
  { id: "retomar", label: "Retomar" },
  { id: "comecar", label: "Por começar" },
  { id: "todas", label: "Todas" },
];

interface StackItem {
  showUuid: string;
  showName: string;
  posterPath: string | null;
  backdropPath: string | null;
  episode: MetaEpisode;
  watchedCount: number;
  totalEpisodes: number | null;
}

export default function EmDiaPage() {
  const [shows, setShows] = useState<ShowWithProgress[] | null>(null);
  const [nextUp, setNextUp] = useState<NextUpMap | null>(null);
  const [filter, setFilter] = useState<Filter>("continuar");
  const [cursor, setCursor] = useState(0);
  const [decided, setDecided] = useState(0);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    void (async () => {
      const [list, cached] = await Promise.all([loadShows(), loadCachedNextUp()]);
      setShows(list);
      setNextUp(cached ?? new Map());
    })();
  }, []);

  const buckets = useMemo(() => {
    if (!shows || !nextUp) return null;
    return classifyQueue(shows, nextUp, now);
  }, [shows, nextUp, now]);

  const stack: StackItem[] = useMemo(() => {
    if (!buckets || !nextUp) return [];
    const list =
      filter === "continuar"
        ? buckets.active
        : filter === "retomar"
          ? buckets.stale
          : filter === "comecar"
            ? buckets.notStarted
            : [...buckets.active, ...buckets.stale, ...buckets.notStarted];
    return list.map((s) => ({
      showUuid: s.uuid,
      showName: s.name,
      posterPath: s.posterPath,
      backdropPath: s.backdropPath,
      episode: nextUp.get(s.uuid)!.episode,
      watchedCount: s.watchedCount,
      totalEpisodes: s.totalEpisodes,
    }));
  }, [buckets, nextUp, filter]);

  // Muda de filtro → recomeça a pilha desse filtro do início
  const changeFilter = (f: Filter) => {
    setFilter(f);
    setCursor(0);
    setDecided(0);
  };

  const handleDecide = (item: StackItem, watched: boolean) => {
    const { season, episode } = item.episode;
    if (watched) {
      void markWatched(item.showUuid, season, episode);
    }
    setDecided((n) => n + 1);
    setCursor((c) => c + 1);
    // Um swipe é rápido de mais para não ter volta: anular desfaz a marcação
    // e devolve o cartão ao topo da pilha.
    pushUndo({
      label: watched ? "Marcado como visto" : "Deixado para depois",
      detail: `${item.showName} · ${formatEpCode(season, episode)}`,
      undo: async () => {
        if (watched) await unmarkWatched(item.showUuid, season, episode);
        setDecided((n) => Math.max(0, n - 1));
        setCursor((c) => Math.max(0, c - 1));
      },
    });
  };

  // Alternativa por teclado — o gesto de arrastar nunca é a única forma de decidir
  useEffect(() => {
    const top = stack[cursor];
    if (!top) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") handleDecide(top, true);
      else if (e.key === "ArrowLeft") handleDecide(top, false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stack, cursor]);

  if (shows === null || nextUp === null || buckets === null) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-8">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-panel" />
        <div className="relative mt-6 aspect-3/4 animate-pulse rounded-3xl bg-panel" />
      </main>
    );
  }

  const remaining = stack.slice(cursor, cursor + 3);
  const total = stack.length;
  const finished = cursor >= total && total > 0;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold [font-stretch:110%]">Pôr em dia</h1>
        <Link href="/series" className="text-sm text-dim hover:text-ink hover:underline">
          Sair
        </Link>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => {
          const count =
            f.id === "continuar"
              ? buckets.active.length
              : f.id === "retomar"
                ? buckets.stale.length
                : f.id === "comecar"
                  ? buckets.notStarted.length
                  : buckets.active.length + buckets.stale.length + buckets.notStarted.length;
          const isActive = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => changeFilter(f.id)}
              className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition active:scale-95 ${
                isActive
                  ? "border-ink bg-ink text-tube"
                  : "border-line text-dim hover:border-ink hover:text-ink"
              }`}
            >
              {f.label}
              <span className={`ep-code text-xs ${isActive ? "opacity-70" : "text-faint"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {total === 0 ? (
        <div className="mt-16 flex flex-1 flex-col items-center justify-center text-center">
          <CheckIcon className="h-10 w-10 text-faint" />
          <p className="mt-4 font-display font-semibold">Nada para pôr em dia aqui</p>
          <p className="mt-1 max-w-xs text-sm text-dim">
            Este filtro está vazio — experimenta outro acima.
          </p>
        </div>
      ) : finished ? (
        <div className="mt-16 flex flex-1 flex-col items-center justify-center text-center">
          <CheckIcon className="h-10 w-10 text-faint" />
          <p className="mt-4 font-display font-semibold">Passaste tudo em revista</p>
          <p className="mt-1 max-w-xs text-sm text-dim">
            {decided} episódios revistos neste filtro.
          </p>
          <button
            onClick={() => changeFilter(filter)}
            className="mt-6 cursor-pointer rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-tube transition hover:brightness-110 active:scale-95"
          >
            Rever outra vez
          </button>
        </div>
      ) : (
        <>
          <p className="ep-code mt-4 text-center text-xs text-faint">
            {cursor + 1} de {total}
          </p>
          <div className="relative mt-3 aspect-3/4 flex-1" data-swipe-stack>
            {remaining.map((item, i) => (
              <SwipeCard
                key={item.showUuid}
                showName={item.showName}
                posterPath={item.posterPath}
                backdropPath={item.backdropPath}
                episode={item.episode}
                watchedCount={item.watchedCount}
                totalEpisodes={item.totalEpisodes}
                active={i === 0}
                depth={i}
                onDecide={(watched) => handleDecide(item, watched)}
              />
            ))}
            <SwipeCoach />
          </div>

          <div className="mt-5 flex items-center justify-center gap-6">
            <button
              onClick={() => handleDecide(remaining[0], false)}
              aria-label="Saltar — ainda não vi"
              className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border-2 border-line text-faint transition hover:border-ink hover:text-ink active:scale-90"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <button
              onClick={() => handleDecide(remaining[0], true)}
              aria-label="Marcar como visto"
              className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-full bg-ink text-tube transition hover:brightness-110 active:scale-90"
            >
              <CheckIcon className="h-7 w-7" />
            </button>
          </div>
        </>
      )}
    </main>
  );
}
