"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { markWatched, unmarkWatched } from "@/lib/db";
import { useSeries } from "@/lib/cache";
import { classifyQueue, loadCachedNextUp, type NextUpMap } from "@/lib/queue";
import { formatEpCode } from "@/lib/watchnext";
import { pushUndo } from "@/lib/undo";
import type { MetaEpisode } from "@/lib/metadata";
import SwipeCard from "@/components/SwipeCard";
import SwipeCoach, { EM_DIA_COACH_KEY } from "@/components/SwipeCoach";
import BotaoVoltar from "@/components/BotaoVoltar";
import { ArrowLeftIcon, CheckIcon } from "@/components/icons";
import { Bone, TitleBone } from "@/components/Skeleton";

type Filter = "continuar" | "retomar" | "comecar" | "todas";
const FILTER_IDS = new Set<Filter>(["continuar", "retomar", "comecar", "todas"]);

/**
 * Sem filtro no URL, abre no primeiro que tem alguma coisa. Abria sempre em
 * "Continuar" — e quem só tinha séries paradas tocava em "Pôr em dia" para
 * ver "Nada para pôr em dia aqui" com um visto (Ronda 12, Fase 4).
 */
function primeiroComConteudo(b: { active: unknown[]; stale: unknown[]; notStarted: unknown[] }): Filter {
  if (b.active.length > 0) return "continuar";
  if (b.stale.length > 0) return "retomar";
  if (b.notStarted.length > 0) return "comecar";
  return "continuar";
}

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

function EmDiaContent() {
  const router = useRouter();
  const params = useSearchParams();
  // Partilhável e reversível → URL, a mesma regra da Biblioteca: recuar de
  // um episódio marcado devolve ao filtro onde se estava, não sempre a
  // "Continuar". Medido antes da correção: filtro em memória perdia-se a
  // cada visita nova à página.
  const rawFilter = params.get("filtro");
  const pedido: Filter | null =
    rawFilter && FILTER_IDS.has(rawFilter as Filter) ? (rawFilter as Filter) : null;

  const shows = useSeries();
  const [nextUp, setNextUp] = useState<NextUpMap | null>(null);
  const [cursor, setCursor] = useState(0);
  const [decided, setDecided] = useState(0);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    void loadCachedNextUp().then((cached) => setNextUp(cached ?? new Map()));
  }, []);

  const buckets = useMemo(() => {
    if (!shows || !nextUp) return null;
    return classifyQueue(shows, nextUp, now);
  }, [shows, nextUp, now]);

  // Decidido uma vez, quando a fila chega: se a série marcada mudasse de
  // grupo a meio, o filtro por omissão não pode mudar debaixo do cursor.
  const [porOmissao, setPorOmissao] = useState<Filter | null>(null);
  if (porOmissao === null && buckets) setPorOmissao(primeiroComConteudo(buckets));
  const filter: Filter = pedido ?? porOmissao ?? "continuar";

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
    // Sempre no URL, "Continuar" incluído: sem filtro, o ecrã escolhe o
    // primeiro com conteúdo, e isso não é necessariamente o que se tocou.
    const next = new URLSearchParams(params);
    next.set("filtro", f);
    router.replace(`/em-dia?${next}`, { scroll: false });
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
        <TitleBone />
        <Bone className="mt-4 h-9 w-full rounded-full" />
        <Bone className="mt-6 aspect-3/4 w-full rounded-3xl" />
      </main>
    );
  }

  const remaining = stack.slice(cursor, cursor + 3);
  const total = stack.length;
  const todosVazios =
    buckets.active.length === 0 &&
    buckets.stale.length === 0 &&
    buckets.notStarted.length === 0;
  const finished = cursor >= total && total > 0;
  const contar = (f: Filter) =>
    f === "continuar"
      ? buckets.active.length
      : f === "retomar"
        ? buckets.stale.length
        : f === "comecar"
          ? buckets.notStarted.length
          : buckets.active.length + buckets.stale.length + buckets.notStarted.length;
  const saida = primeiroComConteudo(buckets);

  return (
    <main className="tela-cheia mx-auto flex w-full max-w-md flex-col overflow-hidden px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <div className="flex shrink-0 items-center gap-2">
        <BotaoVoltar
          label="Voltar às séries"
          fallback="/series"
          className="-ml-2 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-dim transition hover:text-ink active:scale-90"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </BotaoVoltar>
        <h1 className="font-display text-2xl font-bold [font-stretch:110%]">Pôr em dia</h1>
      </div>

      <div className="mt-4 flex shrink-0 gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => {
          const count = contar(f.id);
          const isActive = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => changeFilter(f.id)}
              aria-pressed={isActive}
              className={`flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-[15px] font-medium transition active:scale-95 ${
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
        todosVazios ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <CheckIcon className="h-10 w-10 text-faint" />
            <p className="mt-4 font-display font-semibold">Estás em dia com tudo</p>
            <p className="mt-1 max-w-xs text-[15px] text-dim">
              Não há episódios à espera em nenhuma das séries que segues.
            </p>
          </div>
        ) : (
          // Um filtro vazio não é "estar em dia": sem o visto, e com a saída
          // à mão — mandava "experimentar outro acima", fora do polegar.
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="font-display font-semibold">Nada para pôr em dia aqui</p>
            <button
              onClick={() => changeFilter(saida)}
              className="mt-6 min-h-11 cursor-pointer rounded-full bg-ink px-6 text-[15px] font-semibold text-tube transition hover:brightness-110 active:scale-95"
            >
              Ver {FILTERS.find((f) => f.id === saida)!.label} · {contar(saida)}
            </button>
          </div>
        )
      ) : finished ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <CheckIcon className="h-10 w-10 text-faint" />
          <p className="mt-4 font-display font-semibold">Passaste tudo em revista</p>
          <p className="mt-1 max-w-xs text-[15px] text-dim">
            {decided} episódios revistos neste filtro.
          </p>
          <button
            onClick={() => changeFilter(filter)}
            className="mt-6 cursor-pointer rounded-full bg-ink px-6 py-2.5 text-[15px] font-semibold text-tube transition hover:brightness-110 active:scale-95"
          >
            Rever outra vez
          </button>
        </div>
      ) : (
        <>
          <p className="ep-code mt-3 shrink-0 text-center text-xs text-faint">
            {cursor + 1} de {total}
          </p>
          {/* min-h-0: sem isto, o cartão empurraria as ações para debaixo da
              dock em ecrãs mais baixos — a mesma avaria que a Fase Q
              corrigiu no Explorar. Aqui a pilha ocupa o que sobra do ecrã,
              nunca mais do que isso. */}
          <div className="relative mt-3 min-h-0 flex-1 pb-4" data-swipe-stack>
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
            <SwipeCoach
              kvKey={EM_DIA_COACH_KEY}
              titulo="Arrasta o cartão"
              detalhe="Cada cartão é o próximo episódio por ver de uma série."
              esquerda={{ seta: "←", titulo: "Ainda não", detalhe: "Passa à frente sem marcar" }}
              direita={{ seta: "→", titulo: "Visto", detalhe: "Marca o episódio como visto" }}
            />

            {/* As ações flutuam sobre o cartaz, acima da dock — nunca por
                baixo dela, que era a avaria (o degradê da dock apagava-as). */}
            <div className="pointer-events-none absolute inset-x-0 bottom-[calc(var(--dock-h)+2.25rem)] z-20 flex items-center justify-center gap-6">
              <button
                onClick={() => handleDecide(remaining[0], false)}
                aria-label="Saltar — ainda não vi"
                className="pointer-events-auto flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border border-ink/20 bg-tube/70 text-ink backdrop-blur-md transition active:scale-90"
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
                className="pointer-events-auto flex h-16 w-16 cursor-pointer items-center justify-center rounded-full bg-ink text-tube transition hover:brightness-110 active:scale-90"
              >
                <CheckIcon className="h-7 w-7" />
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}

// useSearchParams exige uma fronteira de Suspense para a rota poder ser
// pré-renderizada; sem ela o build falha.
export default function EmDiaPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-8">
          <TitleBone />
          <Bone className="mt-4 h-9 w-full rounded-full" />
          <Bone className="mt-6 aspect-3/4 w-full rounded-3xl" />
        </main>
      }
    >
      <EmDiaContent />
    </Suspense>
  );
}
