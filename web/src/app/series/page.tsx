"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  getWatchedForShow,
  kvGet,
  kvSet,
  markWatched,
  updateShow,
} from "@/lib/db";
import { loadShows, type ShowWithProgress } from "@/lib/shows";
import { enrichShow, type MetaEpisode } from "@/lib/metadata";
import { findNextUnwatched } from "@/lib/watchnext";
import WatchNextCard from "@/components/WatchNextCard";
import TonightHero from "@/components/TonightHero";
import { CheckIcon } from "@/components/icons";

// Cada entrada da fila guarda também quando o utilizador viu o último
// episódio dessa série — é isso que separa "A seguir" de "Retomar".
interface QueueEntry {
  episode: MetaEpisode;
  lastWatchedAt: string | null;
}

type NextUpMap = Map<string, QueueEntry>;

// Série sem episódios vistos há mais de 30 dias sai da fila principal
const STALE_MS = 30 * 24 * 60 * 60 * 1000;

// A fila calculada persiste entre visitas: mostra-se logo a última versão
// conhecida e recalcula-se em segundo plano (stale-while-revalidate).
const NEXTUP_CACHE_KEY = "nextup-cache";

function persistNextUp(map: NextUpMap): void {
  void kvSet(NEXTUP_CACHE_KEY, Object.fromEntries(map));
}

// A cache antiga guardava só o episódio (MetaEpisode, onde `episode` é um
// número); no formato novo `episode` é um objeto. Converte sem perder a fila.
function reviveQueueEntry(value: QueueEntry | MetaEpisode): QueueEntry {
  return typeof value.episode === "object"
    ? (value as QueueEntry)
    : { episode: value as MetaEpisode, lastWatchedAt: null };
}

function lastWatchDate(watched: { watchedAt: string }[]): string | null {
  let max: string | null = null;
  for (const w of watched) {
    if (max === null || w.watchedAt > max) max = w.watchedAt;
  }
  return max;
}

export default function SeriesPage() {
  const [shows, setShows] = useState<ShowWithProgress[] | null>(null);
  const [nextUp, setNextUp] = useState<NextUpMap | null>(null);
  // Secções secundárias da fila (como no TV Time): fechadas por omissão
  const [showStale, setShowStale] = useState(false);
  const [showNotStarted, setShowNotStarted] = useState(false);
  // instante de referência para o corte de 30 dias, fixado ao montar
  const [now] = useState(() => Date.now());
  const enriching = useRef(false);
  const hadCache = useRef(false);

  // Passo 2 do arranque: com os metadados no lugar, calcula o próximo
  // episódio por ver de cada série seguida (a fila "A seguir").
  // 4 séries em paralelo: sequencial era demasiado lento com dezenas de
  // séries; mais que isto esbarra no rate limit da TVmaze (20 req/10s).
  const computeNextUp = useCallback(async (list: ShowWithProgress[]) => {
    const map: NextUpMap = new Map();
    const queue = list.filter((s) => s.followed && !s.archived);
    let cursor = 0;
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        for (let i = cursor++; i < queue.length; i = cursor++) {
          const show = queue[i];
          const watched = await getWatchedForShow(show.uuid);
          const next = await findNextUnwatched(show, watched);
          if (next) {
            map.set(show.uuid, {
              episode: next.episode,
              lastWatchedAt: lastWatchDate(watched),
            });
            // Sem cache prévia, cada cartão aparece assim que fica pronto —
            // melhor ver a fila a crescer do que um spinner parado
            if (!hadCache.current) setNextUp(new Map(map));
          }
        }
      }),
    );
    setNextUp(map);
    persistNextUp(map);
  }, []);

  // Completa séries com poster/sinopse/nº de episódios (TVmaze por defeito,
  // TMDB com chave). Persiste — nas visitas seguintes já está em cache.
  const enrich = useCallback(
    async (list: ShowWithProgress[]) => {
      if (enriching.current) return;
      enriching.current = true;
      try {
        let changed = false;
        for (const show of list) {
          if (show.posterPath && show.totalEpisodes) continue;
          const patch = await enrichShow(show);
          if (patch) {
            await updateShow(show.uuid, patch);
            changed = true;
          }
        }
        const fresh = changed ? await loadShows() : list;
        if (changed) setShows(fresh);
        await computeNextUp(fresh);
      } finally {
        enriching.current = false;
      }
    },
    [computeNextUp],
  );

  useEffect(() => {
    void (async () => {
      // Fila da última visita aparece de imediato; a versão fresca substitui-a
      // quando o recálculo em segundo plano terminar
      const cached =
        await kvGet<Record<string, QueueEntry | MetaEpisode>>(NEXTUP_CACHE_KEY);
      if (cached && Object.keys(cached).length > 0) {
        hadCache.current = true;
        setNextUp(
          new Map(
            Object.entries(cached).map(([uuid, value]) => [
              uuid,
              reviveQueueEntry(value),
            ]),
          ),
        );
      }
      const list = await loadShows();
      setShows(list);
      void enrich(list);
    })();
  }, [enrich]);

  // Check no Watch Next: grava, avança o cartão para o episódio seguinte
  // e atualiza a contagem — tudo sem recarregar a página
  const handleCheck = useCallback(
    async (showUuid: string, season: number, episode: number) => {
      await markWatched(showUuid, season, episode);
      setShows(
        (current) =>
          current?.map((s) =>
            s.uuid === showUuid ? { ...s, watchedCount: s.watchedCount + 1 } : s,
          ) ?? null,
      );
      const show = shows?.find((s) => s.uuid === showUuid);
      if (!show) return;
      const watched = await getWatchedForShow(showUuid);
      const next = await findNextUnwatched(show, watched);
      setNextUp((current) => {
        const map = new Map(current);
        // acabou de ver um episódio → a série volta (ou mantém-se) ativa
        if (next) {
          map.set(showUuid, {
            episode: next.episode,
            lastWatchedAt: new Date().toISOString(),
          });
        } else {
          map.delete(showUuid);
        }
        persistNextUp(map);
        return map;
      });
    },
    [shows],
  );

  if (shows === null) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-panel" />
        <div className="mt-6 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[104px] animate-pulse rounded-2xl bg-panel" />
          ))}
        </div>
      </main>
    );
  }

  if (shows.length === 0) {
    // Primeira utilização — o ecrã vazio é o onboarding.
    const steps = [
      {
        n: "01",
        title: "Traz o teu histórico",
        text: "Importa o ZIP do TV Time — ou salta este passo e começa do zero.",
      },
      {
        n: "02",
        title: "Segue as tuas séries",
        text: "Pesquisa no Explorar e segue o que andas a ver.",
      },
      {
        n: "03",
        title: "Marca à medida que vês",
        text: "A fila “A seguir” diz-te sempre qual é o próximo episódio.",
      },
    ];
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-16">
        <div className="text-center">
          <p className="ep-code ep-wordmark text-sm tracking-[0.3em]">EPISODIC</p>
          <h1 className="mt-3 font-display text-3xl font-bold">
            Tudo o que vês, num só sítio
          </h1>
          <p className="mt-3 text-dim">
            O teu registo de séries: o que viste, o que falta, o que vem a seguir.
          </p>
        </div>

        <ol className="mt-10 space-y-4">
          {steps.map((step) => (
            <li key={step.n} className="flex items-start gap-4">
              <span className="ep-code mt-0.5 shrink-0 text-lg font-bold text-signal">
                {step.n}
              </span>
              <div>
                <p className="font-display font-semibold">{step.title}</p>
                <p className="mt-0.5 text-sm text-dim">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/import"
            className="cursor-pointer rounded-full bg-signal px-6 py-3 font-semibold text-on-signal transition hover:brightness-110 active:scale-95"
          >
            Importar do TV Time
          </Link>
          <Link
            href="/library"
            className="cursor-pointer rounded-full border border-line px-6 py-3 font-semibold text-ink transition hover:bg-raised active:scale-95"
          >
            Explorar séries
          </Link>
        </div>
      </main>
    );
  }

  const watching = shows.filter((s) => s.followed && !s.archived);
  const queue = watching.filter((s) => nextUp?.has(s.uuid));

  // Divide a fila como o TV Time: ativas no topo; paradas há 30+ dias em
  // "Retomar"; seguidas mas nunca começadas em "Por começar"
  const activeQueue: ShowWithProgress[] = [];
  const staleQueue: ShowWithProgress[] = [];
  const notStartedQueue: ShowWithProgress[] = [];
  for (const show of queue) {
    const entry = nextUp?.get(show.uuid);
    if (!entry) continue;
    if (show.watchedCount === 0) {
      notStartedQueue.push(show);
    } else if (
      entry.lastWatchedAt &&
      now - Date.parse(entry.lastWatchedAt) > STALE_MS
    ) {
      staleQueue.push(show);
    } else {
      activeQueue.push(show);
    }
  }
  // mais recentemente vistas primeiro — o que anda a ver fica no topo
  const byLastWatchedDesc = (a: ShowWithProgress, b: ShowWithProgress) =>
    (nextUp?.get(b.uuid)?.lastWatchedAt ?? "").localeCompare(
      nextUp?.get(a.uuid)?.lastWatchedAt ?? "",
    );
  activeQueue.sort(byLastWatchedDesc);
  staleQueue.sort(byLastWatchedDesc);

  const queueCards = (list: ShowWithProgress[]) => (
    <div className="mt-3 space-y-3">
      {list.map((show) => (
        <WatchNextCard
          key={show.uuid}
          showUuid={show.uuid}
          showName={show.name}
          posterPath={show.posterPath}
          episode={nextUp!.get(show.uuid)!.episode}
          onCheck={(season, episode) => handleCheck(show.uuid, season, episode)}
        />
      ))}
    </div>
  );

  const sectionToggle = (
    title: string,
    hint: string,
    count: number,
    open: boolean,
    onToggle: () => void,
  ) => (
    <button
      onClick={onToggle}
      aria-expanded={open}
      className="flex min-h-11 w-full cursor-pointer items-center gap-2 text-left"
    >
      <h2 className="font-display text-lg font-semibold text-dim">{title}</h2>
      <span className="ep-code rounded-full bg-panel px-2 py-0.5 text-xs text-faint">
        {count}
      </span>
      <span className="flex-1 truncate text-xs text-faint">{hint}</span>
      <svg
        viewBox="0 0 24 24"
        className={`h-4 w-4 shrink-0 text-faint transition-transform ${open ? "rotate-180" : ""}`}
        aria-hidden
      >
        <path
          d="M6 9l6 6 6-6"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );

  const [heroShow, ...restActive] = activeQueue;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      {nextUp === null ? (
        <>
          <p className="ep-code ep-wordmark text-xs tracking-[0.3em]">EPISODIC</p>
          <h1 className="mt-1 font-display text-3xl font-bold">Séries</h1>
          <div className="mt-6 space-y-3">
            {watching.slice(0, 3).map((s) => (
              <div key={s.uuid} className="h-[104px] animate-pulse rounded-2xl bg-panel" />
            ))}
          </div>
        </>
      ) : queue.length === 0 ? (
        <>
          <p className="ep-code ep-wordmark text-xs tracking-[0.3em]">EPISODIC</p>
          <h1 className="mt-1 font-display text-3xl font-bold">Séries</h1>
          <div className="ep-card mt-6 flex items-center gap-3 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-raised text-ink">
              <CheckIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Estás em dia</p>
              <p className="text-xs text-dim">
                Nenhum episódio por ver nas séries que segues.
              </p>
            </div>
            <Link
              href="/library"
              className="shrink-0 cursor-pointer text-sm font-semibold text-ink hover:underline"
            >
              Biblioteca
            </Link>
          </div>
        </>
      ) : heroShow ? (
        <>
          <TonightHero
            key={heroShow.uuid}
            showUuid={heroShow.uuid}
            showName={heroShow.name}
            backdropPath={heroShow.backdropPath}
            posterPath={heroShow.posterPath}
            episode={nextUp.get(heroShow.uuid)!.episode}
            onCheck={(season, episode) => handleCheck(heroShow.uuid, season, episode)}
          />
          {restActive.length > 0 && (
            <section className="mt-6">
              <h2 className="font-display text-sm font-semibold uppercase tracking-[0.15em] text-dim [font-stretch:80%]">
                Continuar
              </h2>
              {queueCards(restActive)}
            </section>
          )}
        </>
      ) : (
        <>
          <p className="ep-code ep-wordmark text-xs tracking-[0.3em]">EPISODIC</p>
          <h1 className="mt-1 font-display text-3xl font-bold">Séries</h1>
          <p className="mt-6 text-sm text-dim">
            Nada ativo neste momento — retoma uma série parada ou começa uma
            nova, aqui em baixo.
          </p>
        </>
      )}

      {staleQueue.length > 0 && (
        <section className="mt-8">
          {sectionToggle(
            "Retomar",
            "paradas há mais de 30 dias",
            staleQueue.length,
            showStale,
            () => setShowStale((v) => !v),
          )}
          {showStale && queueCards(staleQueue)}
        </section>
      )}

      {notStartedQueue.length > 0 && (
        <section className="mt-8">
          {sectionToggle(
            "Por começar",
            "segues, mas ainda não viste nenhum episódio",
            notStartedQueue.length,
            showNotStarted,
            () => setShowNotStarted((v) => !v),
          )}
          {showNotStarted && queueCards(notStartedQueue)}
        </section>
      )}

      <p className="mt-10 text-center">
        <Link
          href="/library"
          className="cursor-pointer text-sm font-semibold text-dim hover:text-ink hover:underline"
        >
          Ver toda a biblioteca ({shows.length}) →
        </Link>
      </p>
    </main>
  );
}
