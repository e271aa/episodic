"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  clearAllData,
  countWatched,
  getImportMeta,
  getMovies,
  getShows,
} from "@/lib/db";
import CloudAccount from "@/components/CloudAccount";

interface Stats {
  shows: number;
  following: number;
  episodes: number;
  movies: number;
  hours: number | null;
  importedAt: string | null;
}

// Mesmo formato do TV Time: "2 MESES 25 DIAS 7 HORAS"
function splitHours(totalHours: number) {
  const months = Math.floor(totalHours / 720);
  const days = Math.floor((totalHours % 720) / 24);
  const hours = Math.floor(totalHours % 24);
  return { months, days, hours };
}

async function loadStats(): Promise<Stats> {
  const [shows, episodes, movies, meta] = await Promise.all([
    getShows(),
    countWatched(),
    getMovies(),
    getImportMeta(),
  ]);
  return {
    shows: shows.length,
    following: shows.filter((s) => s.followed).length,
    episodes,
    movies: movies.length,
    hours: meta?.totalSeriesRuntimeSec
      ? Math.round(meta.totalSeriesRuntimeSec / 3600)
      : null,
    importedAt: meta?.importedAt ?? null,
  };
}

export default function ProfilePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    void loadStats().then(setStats);
  }, []);

  const handleClear = useCallback(async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    await clearAllData();
    setConfirmClear(false);
    setStats(await loadStats());
  }, [confirmClear]);

  if (stats === null) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <div className="h-8 w-32 animate-pulse rounded-lg bg-panel" />
      </main>
    );
  }

  const time = stats.hours !== null ? splitHours(stats.hours) : null;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="font-display text-2xl font-bold">Perfil</h1>

      <section className="mt-6">
        <h2 className="font-display text-lg font-semibold">Estatísticas</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-line bg-panel p-4">
            <p className="text-xs uppercase tracking-wide text-faint">
              Horas a ver TV
            </p>
            {time ? (
              <div className="mt-2 flex gap-4">
                {time.months > 0 && (
                  <div>
                    <p className="ep-code text-2xl font-bold">{time.months}</p>
                    <p className="text-xs uppercase text-faint">meses</p>
                  </div>
                )}
                <div>
                  <p className="ep-code text-2xl font-bold">{time.days}</p>
                  <p className="text-xs uppercase text-faint">dias</p>
                </div>
                <div>
                  <p className="ep-code text-2xl font-bold">{time.hours}</p>
                  <p className="text-xs uppercase text-faint">horas</p>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-dim">
                disponível após importares o TV Time
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-line bg-panel p-4">
            <p className="text-xs uppercase tracking-wide text-faint">
              Episódios vistos
            </p>
            <p className="ep-code mt-2 text-3xl font-bold text-signal" data-testid="stat-episodes">
              {stats.episodes.toLocaleString("pt-PT")}
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-panel p-4">
            <p className="text-xs uppercase tracking-wide text-faint">Séries</p>
            <p className="ep-code mt-2 text-3xl font-bold">{stats.shows}</p>
            <p className="text-xs text-dim">{stats.following} a seguir</p>
          </div>
          <div className="rounded-2xl border border-line bg-panel p-4">
            <p className="text-xs uppercase tracking-wide text-faint">Filmes</p>
            <p className="ep-code mt-2 text-3xl font-bold">{stats.movies}</p>
          </div>
        </div>
      </section>

      <CloudAccount onSynced={() => void loadStats().then(setStats)} />

      <section className="mt-8">
        <h2 className="font-display text-lg font-semibold">Dados</h2>
        <div className="mt-3 flex flex-col gap-2">
          <Link
            href="/import"
            className="cursor-pointer rounded-2xl border border-line bg-panel px-4 py-3 font-medium transition-colors hover:bg-raised"
          >
            Importar do TV Time
            {stats.importedAt && (
              <span className="ep-code block text-xs font-normal text-faint">
                última importação: {stats.importedAt.slice(0, 10)}
              </span>
            )}
          </Link>
          <button
            onClick={() => void handleClear()}
            className="cursor-pointer rounded-2xl border border-danger/40 px-4 py-3 text-left font-medium text-danger transition-colors hover:bg-danger/10"
          >
            {confirmClear
              ? "Tens a certeza? Clica outra vez para apagar tudo"
              : "Apagar dados locais"}
          </button>
        </div>
      </section>

      <p className="mt-8 text-center text-xs text-faint">
        Episodic · os teus dados vivem neste dispositivo e (se iniciares sessão) na cloud
        <br />
        Metadados por TVmaze (grátis, sem chave). Opcional: chave TMDB em{" "}
        <code className="ep-code">web/.env.local</code> para posters HD e sinopses em
        português.
      </p>
    </main>
  );
}
