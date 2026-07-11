"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  getAllWatched,
  getShows,
  getWatchedForShow,
  markWatched,
  migrateLegacyImport,
  updateShow,
  type StoredShow,
} from "@/lib/db";
import { enrichShow, type MetaEpisode } from "@/lib/metadata";
import { findNextUnwatched } from "@/lib/watchnext";
import PosterCard from "@/components/PosterCard";
import WatchNextCard from "@/components/WatchNextCard";

interface ShowWithProgress extends StoredShow {
  watchedCount: number;
}

async function loadShows(): Promise<ShowWithProgress[]> {
  await migrateLegacyImport();
  const [stored, watched] = await Promise.all([getShows(), getAllWatched()]);
  const counts = new Map<string, number>();
  for (const ep of watched) {
    counts.set(ep.showUuid, (counts.get(ep.showUuid) ?? 0) + 1);
  }
  return stored
    .map((s) => ({ ...s, watchedCount: counts.get(s.uuid) ?? 0 }))
    .sort((a, b) => b.watchedCount - a.watchedCount);
}

type NextUpMap = Map<string, MetaEpisode>;

export default function SeriesPage() {
  const [shows, setShows] = useState<ShowWithProgress[] | null>(null);
  const [nextUp, setNextUp] = useState<NextUpMap | null>(null);
  const enriching = useRef(false);

  // Passo 2 do arranque: com os metadados no lugar, calcula o próximo
  // episódio por ver de cada série seguida (a fila "A seguir")
  const computeNextUp = useCallback(async (list: ShowWithProgress[]) => {
    const map: NextUpMap = new Map();
    for (const show of list) {
      if (!show.followed || show.archived) continue;
      const watched = await getWatchedForShow(show.uuid);
      const next = await findNextUnwatched(show, watched);
      if (next) map.set(show.uuid, next.episode);
    }
    setNextUp(map);
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
    void loadShows().then((list) => {
      setShows(list);
      void enrich(list);
    });
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
        if (next) map.set(showUuid, next.episode);
        else map.delete(showUuid);
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
    return (
      <main className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <p className="ep-code text-sm tracking-[0.3em] text-signal">EPISODIC</p>
        <h1 className="mt-3 font-display text-3xl font-bold">
          Tudo o que vês, num só sítio
        </h1>
        <p className="mt-3 text-dim">
          Traz o teu histórico do TV Time, ou começa a seguir séries do zero.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/import"
            className="cursor-pointer rounded-full bg-signal px-6 py-3 font-semibold text-on-signal transition hover:brightness-110"
          >
            Importar do TV Time
          </Link>
          <Link
            href="/explore"
            className="cursor-pointer rounded-full border border-line px-6 py-3 font-semibold text-ink transition hover:bg-raised"
          >
            Explorar séries
          </Link>
        </div>
      </main>
    );
  }

  const watching = shows.filter((s) => s.followed && !s.archived);
  const watchlist = shows.filter((s) => s.inWatchlist && !s.followed);
  const stopped = shows.filter((s) => !s.followed && !s.inWatchlist);
  const archived = shows.filter((s) => s.followed && s.archived);
  const queue = watching.filter((s) => nextUp?.has(s.uuid));

  const grid = (list: ShowWithProgress[]) => (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
      {list.map((s) => (
        <PosterCard
          key={s.uuid}
          href={`/series/${s.uuid}`}
          name={s.name}
          posterPath={s.posterPath}
          watched={s.watchedCount}
          total={s.totalEpisodes}
        />
      ))}
    </div>
  );

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <p className="ep-code text-xs tracking-[0.3em] text-signal">EPISODIC</p>
      <h1 className="mt-1 font-display text-3xl font-bold">Séries</h1>

      <section className="mt-6">
        <h2 className="font-display text-lg font-semibold">A seguir</h2>
        {nextUp === null ? (
          <div className="mt-3 space-y-3">
            {watching.slice(0, 3).map((s) => (
              <div key={s.uuid} className="h-[104px] animate-pulse rounded-2xl bg-panel" />
            ))}
          </div>
        ) : queue.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-line bg-panel p-4 text-sm text-dim">
            Estás em dia com todas as séries que segues. 🎉
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {queue.map((show) => (
              <WatchNextCard
                key={show.uuid}
                showUuid={show.uuid}
                showName={show.name}
                posterPath={show.posterPath}
                episode={nextUp.get(show.uuid)!}
                onCheck={(season, episode) => handleCheck(show.uuid, season, episode)}
              />
            ))}
          </div>
        )}
      </section>

      {watching.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-lg font-semibold">As minhas séries</h2>
          <div className="mt-3">{grid(watching)}</div>
        </section>
      )}
      {watchlist.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-lg font-semibold">Para ver</h2>
          <div className="mt-3">{grid(watchlist)}</div>
        </section>
      )}
      {stopped.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-lg font-semibold text-dim">Já não sigo</h2>
          <div className="mt-3">{grid(stopped)}</div>
        </section>
      )}
      {archived.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-lg font-semibold text-dim">Arquivadas</h2>
          <div className="mt-3">{grid(archived)}</div>
        </section>
      )}
    </main>
  );
}
