"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { clearAllData } from "@/lib/db";
import { loadProfileStats, type ProfileStats } from "@/lib/stats";
import CloudAccount from "@/components/CloudAccount";
import ProfileCard from "@/components/ProfileCard";
import Poster from "@/components/Poster";
import { Bone } from "@/components/Skeleton";
import IntegrityCheck from "@/components/IntegrityCheck";

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
      <main className="mx-auto w-full max-w-2xl px-4 pt-8 pb-[calc(var(--dock-h)+2rem)]">
        {/* a sombra do que vem: cartão de identidade, tempo de antena,
            os três contadores e a série-farol */}
        <Bone className="h-52 w-full rounded-3xl" />
        <Bone className="mt-3 h-36 w-full rounded-3xl" />
        <div className="mt-3 grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <Bone key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Bone className="mt-3 h-28 w-full rounded-2xl" />
      </main>
    );
  }

  const time = stats.hours !== null ? splitHours(stats.hours) : null;
  const topShowPosterPath = stats.topShow?.posterPath ?? null;
  const maxYear = Math.max(1, ...stats.perYear.map((y) => y.count));

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-8 pb-[calc(var(--dock-h)+2rem)]">
      {/* Quem és — antes de quanto viste */}
      <ProfileCard />

      {/* Herói — tempo de antena, o "cartão de estação" do utilizador. É o
          único número de que a pessoa se orgulha ao abrir esta página, e
          tinha de ser o maior; o resto abaixo já não compete com ele por
          cartões do mesmo peso, são linhas dentro do mesmo painel. */}
      <section className="relative mt-3 overflow-hidden rounded-3xl border border-line bg-gradient-to-b from-panel to-tube p-6">
        <div className="bars absolute inset-x-0 top-0 h-[3px]" />
        <p className="font-display text-xs font-semibold uppercase tracking-[0.3em] text-dim [font-stretch:75%]">
          Tempo de antena
        </p>
        {time ? (
          <div className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-1">
            {time.months > 0 && (
              <span className="flex items-baseline gap-1.5">
                <span className="ep-code text-5xl font-bold text-ink">{time.months}</span>
                <span className="text-[15px] text-dim">meses</span>
              </span>
            )}
            <span className="flex items-baseline gap-1.5">
              <span className="ep-code text-5xl font-bold text-ink">{time.days}</span>
              <span className="text-[15px] text-dim">dias</span>
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="ep-code text-5xl font-bold text-ink">{time.hours}</span>
              <span className="text-[15px] text-dim">horas</span>
            </span>
          </div>
        ) : (
          <p className="mt-3 text-[15px] text-dim">
            Disponível depois de importares o TV Time.
          </p>
        )}
        <p className="ep-code mt-3 text-xs text-faint">
          {stats.episodes.toLocaleString("pt-PT")} episódios
          {stats.firstYear ? ` · no ar desde ${stats.firstYear}` : ""}
        </p>
      </section>

      {/* Tudo o resto — um painel só, secções separadas por linha, não por
          cartão. Nenhuma delas precisa de competir visualmente com o tempo
          de antena, precisam só de estar arrumadas. */}
      <section className="mt-3 divide-y divide-line rounded-3xl border border-line bg-panel">
        {stats.genres.length > 0 && (
          <div className="p-5">
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
                <li key={g.name} className="flex items-center gap-1.5 text-[15px]">
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
          </div>
        )}

        {/* Contadores — números lado a lado, não três caixas com borda própria */}
        <div className="flex items-stretch p-5">
          <div className="flex-1">
            <p className="ep-code text-2xl font-bold text-ink">{stats.shows}</p>
            <p className="text-xs text-dim">séries · {stats.following} a seguir</p>
          </div>
          <div className="w-px shrink-0 bg-line" aria-hidden />
          <div className="flex-1 pl-5">
            <p className="ep-code text-2xl font-bold text-ink">{stats.movies}</p>
            <p className="text-xs text-dim">filmes</p>
          </div>
          <div className="w-px shrink-0 bg-line" aria-hidden />
          <Link href="/library" className="flex flex-1 flex-col justify-center pl-5">
            <p className="font-display text-[15px] font-semibold text-ink hover:underline">
              Biblioteca
            </p>
            <p className="text-xs text-faint">ver tudo →</p>
          </Link>
        </div>

        {stats.topShow && (
          <Link
            href={`/series/${stats.topShow.uuid}`}
            className="flex items-center gap-4 p-5 transition-colors hover:bg-raised"
          >
            {topShowPosterPath ? (
              <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-lg shadow-md shadow-black/40">
                <Poster path={topShowPosterPath} alt="" size="w185" fill className="object-cover" />
              </div>
            ) : (
              <div className="h-16 w-11 shrink-0 rounded-lg bg-raised" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-[0.15em] text-faint">A tua série</p>
              <p className="mt-0.5 truncate font-display text-[15px] font-semibold text-ink">
                {stats.topShow.name}
              </p>
            </div>
            <p className="ep-code shrink-0 text-xs text-faint">
              {stats.topShow.count} EP
            </p>
          </Link>
        )}

        {stats.perYear.length > 1 && (
          <div className="p-5">
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
          </div>
        )}

        <Link
          href="/estatisticas"
          className="flex items-center justify-between p-5 transition-colors hover:bg-raised"
        >
          <span className="font-display font-semibold text-ink">
            Estatísticas completas
          </span>
          <span className="text-faint">→</span>
        </Link>
      </section>

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
          <IntegrityCheck />
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
