"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { clearAllData } from "@/lib/db";
import { imageUrl } from "@/lib/tmdb";
import { loadProfileStats, type ProfileStats } from "@/lib/stats";
import CloudAccount from "@/components/CloudAccount";

// Mesmo formato do TV Time: "2 meses · 25 dias · 7 horas"
function splitHours(totalHours: number) {
  return {
    months: Math.floor(totalHours / 720),
    days: Math.floor((totalHours % 720) / 24),
    hours: Math.floor(totalHours % 24),
  };
}

export default function ProfilePage() {
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    void loadProfileStats().then(setStats);
  }, []);

  const handleClear = useCallback(async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    await clearAllData();
    setConfirmClear(false);
    setStats(await loadProfileStats());
  }, [confirmClear]);

  if (stats === null) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <div className="h-40 animate-pulse rounded-3xl bg-panel" />
        <div className="mt-3 h-24 animate-pulse rounded-3xl bg-panel" />
      </main>
    );
  }

  const time = stats.hours !== null ? splitHours(stats.hours) : null;
  const topShowPoster = imageUrl(stats.topShow?.posterPath ?? null, "w185");
  const maxYear = Math.max(1, ...stats.perYear.map((y) => y.count));

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      {/* Herói — tempo de antena, o "cartão de estação" do utilizador */}
      <section className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-b from-panel to-tube p-6">
        <div className="bars absolute inset-x-0 top-0 h-[3px]" />
        <p className="font-display text-xs font-semibold uppercase tracking-[0.3em] text-dim [font-stretch:75%]">
          Tempo de antena
        </p>
        {time ? (
          <div className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-1">
            {time.months > 0 && (
              <span className="flex items-baseline gap-1.5">
                <span className="ep-code text-4xl font-bold text-ink">{time.months}</span>
                <span className="text-sm text-dim">meses</span>
              </span>
            )}
            <span className="flex items-baseline gap-1.5">
              <span className="ep-code text-4xl font-bold text-ink">{time.days}</span>
              <span className="text-sm text-dim">dias</span>
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="ep-code text-4xl font-bold text-ink">{time.hours}</span>
              <span className="text-sm text-dim">horas</span>
            </span>
          </div>
        ) : (
          <p className="mt-3 text-sm text-dim">
            Disponível depois de importares o TV Time.
          </p>
        )}
        <p className="ep-code mt-3 text-xs text-faint">
          {stats.episodes.toLocaleString("pt-PT")} episódios
          {stats.firstYear ? ` · no ar desde ${stats.firstYear}` : ""}
        </p>
      </section>

      {/* Espetro de géneros — a assinatura: o test card, mas o teu */}
      {stats.genres.length > 0 && (
        <section className="mt-3 rounded-3xl border border-line bg-panel p-5">
          <h2 className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-dim [font-stretch:80%]">
            O teu espetro
          </h2>
          <div className="mt-3 flex h-3 overflow-hidden rounded-full">
            {stats.genres.map((g) => (
              <div
                key={g.name}
                style={{ width: `${g.pct}%`, background: g.color }}
                title={`${g.name} · ${Math.round(g.pct)}%`}
              />
            ))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {stats.genres.map((g) => (
              <li key={g.name} className="flex items-center gap-1.5 text-sm">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ background: g.color }}
                  aria-hidden
                />
                <span className="text-dim">{g.name}</span>
                <span className="ep-code text-xs text-faint">{Math.round(g.pct)}%</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Contadores secundários */}
      <div className="mt-3 grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-line bg-panel p-4">
          <p className="ep-code text-3xl font-bold text-ink">{stats.shows}</p>
          <p className="text-xs text-dim">séries</p>
          <p className="text-xs text-faint">{stats.following} a seguir</p>
        </div>
        <div className="rounded-2xl border border-line bg-panel p-4">
          <p className="ep-code text-3xl font-bold text-ink">{stats.movies}</p>
          <p className="text-xs text-dim">filmes</p>
        </div>
        <Link
          href="/library"
          className="flex flex-col justify-center rounded-2xl border border-line bg-panel p-4 transition-colors hover:bg-raised"
        >
          <p className="font-display text-sm font-semibold text-ink">Biblioteca</p>
          <p className="text-xs text-faint">ver tudo →</p>
        </Link>
      </div>

      {/* Série-farol */}
      {stats.topShow && (
        <Link
          href={`/series/${stats.topShow.uuid}`}
          className="mt-3 flex items-center gap-4 rounded-2xl border border-line bg-panel p-4 transition-colors hover:bg-raised"
        >
          {topShowPoster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={topShowPoster}
              alt=""
              className="h-20 w-14 shrink-0 rounded-lg object-cover shadow-md shadow-black/40"
            />
          ) : (
            <div className="h-20 w-14 shrink-0 rounded-lg bg-raised" />
          )}
          <div className="min-w-0">
            <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-dim [font-stretch:80%]">
              A tua série
            </p>
            <p className="mt-1 truncate font-display text-lg font-bold text-ink">
              {stats.topShow.name}
            </p>
            <p className="ep-code text-sm text-faint">
              {stats.topShow.count} episódios vistos
            </p>
          </div>
        </Link>
      )}

      {/* Atividade por ano */}
      {stats.perYear.length > 1 && (
        <section className="mt-3 rounded-3xl border border-line bg-panel p-5">
          <h2 className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-dim [font-stretch:80%]">
            Por ano
          </h2>
          <div className="mt-4 flex items-end justify-between gap-1.5">
            {stats.perYear.map((y) => (
              <div key={y.year} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="ep-code text-[10px] text-faint">{y.count}</span>
                <div
                  className="w-full rounded-t-sm bg-ink/80"
                  style={{ height: `${Math.max(4, (y.count / maxYear) * 72)}px` }}
                  title={`${y.year}: ${y.count} episódios`}
                />
                <span className="ep-code text-[10px] text-faint">
                  {String(y.year).slice(2)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <Link
        href="/estatisticas"
        className="mt-3 flex items-center justify-between rounded-2xl border border-line bg-panel px-5 py-4 transition-colors hover:bg-raised"
      >
        <span className="font-display font-semibold text-ink">
          Estatísticas completas
        </span>
        <span className="text-faint">→</span>
      </Link>

      <CloudAccount onSynced={() => void loadProfileStats().then(setStats)} />

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
        Metadados por TVmaze e TMDB.
      </p>
    </main>
  );
}
