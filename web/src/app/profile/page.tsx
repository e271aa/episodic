"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { clearAllData } from "@/lib/db";
import { loadProfileStats, type ProfileStats } from "@/lib/stats";
import CloudAccount from "@/components/CloudAccount";
import ProfileCard from "@/components/ProfileCard";
import Poster from "@/components/Poster";
import SectionHeader from "@/components/SectionHeader";
import { Panel, PanelRow } from "@/components/Panel";
import { Bone } from "@/components/Skeleton";
import IntegrityCheck from "@/components/IntegrityCheck";
import { porExtenso } from "@/lib/datas";

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

  // A confirmação é agora um estado do painel, não um segundo clique no mesmo
  // botão: "clica outra vez" obrigava a ler o botão que se acabou de premir.
  const handleClear = useCallback(async () => {
    await clearAllData();
    setConfirmClear(false);
    setStats(await loadProfileStats());
  }, []);

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
      <h1 className="sr-only">Perfil</h1>
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
                <span className="text-[0.9375rem] text-dim">meses</span>
              </span>
            )}
            <span className="flex items-baseline gap-1.5">
              <span className="ep-code text-5xl font-bold text-ink">{time.days}</span>
              <span className="text-[0.9375rem] text-dim">dias</span>
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="ep-code text-5xl font-bold text-ink">{time.hours}</span>
              <span className="text-[0.9375rem] text-dim">horas</span>
            </span>
          </div>
        ) : (
          <p className="mt-3 text-[0.9375rem] text-dim">
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
            <SectionHeader label="O teu espetro" />
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
                <li key={g.name} className="flex items-center gap-1.5 text-[0.9375rem]">
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
            <p className="text-xs text-dim">
              séries · {stats.following} {stats.following === 1 ? "seguida" : "seguidas"}
            </p>
          </div>
          <div className="w-px shrink-0 bg-line" aria-hidden />
          <div className="flex-1 pl-5">
            <p className="ep-code text-2xl font-bold text-ink">{stats.movies}</p>
            <p className="text-xs text-dim">filmes</p>
          </div>
          <div className="w-px shrink-0 bg-line" aria-hidden />
          <Link href="/library" className="flex flex-1 flex-col justify-center pl-5">
            <p className="font-display text-[0.9375rem] font-semibold text-ink hover:underline">
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
              <p className="mt-0.5 truncate font-display text-[0.9375rem] font-semibold text-ink">
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
            <SectionHeader label="Por ano" meta={`${stats.perYear.length} anos`} />
            <div className="mt-4 flex items-end justify-between gap-1.5">
              {stats.perYear.map((y) => (
                <div key={y.year} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="ep-code text-[0.6875rem] text-faint">{y.count}</span>
                  <div
                    className="w-full rounded-t-sm bg-ink/80"
                    style={{ height: `${Math.max(4, (y.count / maxYear) * 72)}px` }}
                    title={`${y.year}: ${y.count} episódios`}
                  />
                  <span className="ep-code text-[0.6875rem] text-faint">
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
        {/* Cor fixada à mão: a que sai do rótulo "Dados" calhava no vermelho
            SMPTE, ao lado do "Apagar dados locais". Ter o mesmo vermelho a
            marcar uma secção e a assinalar perigo tira o significado ao
            segundo — e o significado é a única razão de haver cor nesta app. */}
        <SectionHeader label="Dados" color="#3c46e6" />
        <Panel className="mt-3">
          <PanelRow
            titulo="Importar do TV Time"
            detalhe={
              stats.importedAt
                ? `Última importação a ${porExtenso(stats.importedAt)}`
                : "Traz o histórico do export GDPR"
            }
            href="/import"
            fim="→"
          />
          {/* Duas coisas diferentes, de propósito em linhas separadas: o que
              só tu sabes (se viste uma série) e o que a app sabe que está
              mal (repetidos, episódios contados duas vezes). */}
          <PanelRow
            titulo="Rever a biblioteca"
            detalhe="Séries atrás do que já estreou — só tu sabes se as viste"
            href="/rever"
            fim="→"
          />
          <IntegrityCheck />
          {/* O vermelho só acende quando a destruição está mesmo a um toque.
              Em repouso é uma linha como as outras — a app tem um único
              acento de perigo e não pode estar sempre ligado, ou deixa de
              querer dizer alguma coisa. */}
          {confirmClear ? (
            <div className="px-5 py-4">
              <p className="font-display text-[0.9375rem] font-semibold text-danger">
                Apagar tudo o que está neste dispositivo?
              </p>
              <p className="mt-0.5 text-xs text-dim">
                Séries, filmes, episódios marcados e listas. Não há como voltar
                atrás{" "}
                {stats.importedAt
                  ? "— terias de importar o TV Time outra vez."
                  : "daqui."}
              </p>
              <div className="mt-3 flex gap-2">
                {/* text-tube e não text-ink: branco sobre o vermelho dá 3,3:1,
                    abaixo do mínimo para 15px. Escuro sobre cor é, além
                    disso, o que os botões primários da app já fazem. */}
                <button
                  onClick={() => void handleClear()}
                  className="min-h-11 flex-1 cursor-pointer rounded-full bg-danger px-4 text-[0.9375rem] font-semibold text-tube transition hover:brightness-110 active:scale-95"
                >
                  Apagar tudo
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="min-h-11 flex-1 cursor-pointer rounded-full border border-line px-4 text-[0.9375rem] font-semibold text-dim transition hover:border-ink hover:text-ink"
                >
                  Manter
                </button>
              </div>
            </div>
          ) : (
            // Sem `perigo`: em repouso é uma linha como as outras — o
            // vermelho só acende no painel de confirmação, acima
            // (Ronda 12, Fase 4, achado #17).
            <PanelRow
              titulo="Apagar dados locais"
              detalhe="Limpa esta cópia — a da cloud, se tiveres sessão, fica"
              onClick={() => setConfirmClear(true)}
            />
          )}
        </Panel>
      </section>

      <p className="mt-10 text-center text-xs leading-relaxed text-faint">
        Episodic — os teus dados vivem neste dispositivo
        <br />e na cloud, se iniciares sessão.
        <br />
        Metadados por TVmaze e TMDB.
      </p>
    </main>
  );
}
