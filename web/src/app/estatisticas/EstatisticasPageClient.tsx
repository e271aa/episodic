"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadAdvancedStats, type AdvancedStats } from "@/lib/advancedStats";
import CabecalhoEcra from "@/components/CabecalhoEcra";
import { CardsBone, TitleBone } from "@/components/Skeleton";
import { porExtenso, porMes } from "@/lib/datas";
import { contarEpisodios } from "@/lib/buracos";
import { plural } from "@/lib/graficos";
import Colunas from "@/components/Colunas";
import MapaDeCalor from "@/components/MapaDeCalor";

export default function EstatisticasPage() {
  const [stats, setStats] = useState<AdvancedStats | null>(null);

  useEffect(() => {
    void loadAdvancedStats().then(setStats);
  }, []);

  if (stats === null) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 pt-8 pb-[calc(var(--dock-h)+2rem)]">
        <TitleBone />
        <CardsBone count={4} height="h-28" />
      </main>
    );
  }

  const totalMarcado = stats.perWeekday.reduce((n, w) => n + w.count, 0);

  /**
   * Sem um único episódio marcado não há estatística nenhuma — e o que se via
   * era só um gráfico de barras todas a zero, que se lê como avaria e não
   * como "ainda não há nada". Um ecrã vazio tem de oferecer o passo seguinte,
   * não encolher os ombros.
   */
  if (totalMarcado === 0) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 pt-8 pb-[calc(var(--dock-h)+2rem)]">
        <CabecalhoEcra titulo="Estatísticas" voltar="Voltar ao perfil" fallback="/profile" />
        <div className="mt-16 flex flex-col items-center px-6 text-center">
          <span className="bars mb-4 h-11 w-11 rounded-full opacity-40" aria-hidden />
          <p className="font-display font-semibold">Ainda não há nada para contar</p>
          <p className="mt-1 max-w-xs text-[0.9375rem] text-dim">
            Estas contas saem dos episódios que marcares — maratonas, sequências,
            o dia da semana em que vês mais.
          </p>
          <Link
            href="/series"
            className="mt-6 flex min-h-11 cursor-pointer items-center rounded-full bg-ink px-6 text-[0.9375rem] font-semibold text-tube transition hover:brightness-110"
          >
            Marcar o primeiro
          </Link>
        </div>
      </main>
    );
  }

  const DIAS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  const maisVista = stats.maisVistas[0]?.count ?? 1;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-8 pb-[calc(var(--dock-h)+2rem)]">
      <CabecalhoEcra titulo="Estatísticas" voltar="Voltar ao perfil" fallback="/profile" />

      {stats.mapa.anos.length > 0 && (
        <section className="ep-card mt-3 p-5">
          <h2 className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-dim [font-stretch:80%]">
            Quando viste
          </h2>
          <div className="mt-3">
            <MapaDeCalor mapa={stats.mapa} />
          </div>
        </section>
      )}

      {stats.maisVistas.length > 0 && (
        <section className="ep-card mt-3 p-5">
          <h2 className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-dim [font-stretch:80%]">
            As séries que mais viste
          </h2>
          <ol className="mt-2">
            {stats.maisVistas.map((s, i) => (
              <li key={s.uuid}>
                <Link
                  href={`/series/${s.uuid}`}
                  className="flex min-h-11 items-center gap-3 py-1"
                >
                  <span className="ep-code w-4 shrink-0 text-xs text-faint">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.9375rem] font-semibold text-ink">
                      {s.name}
                    </span>
                    <span
                      className={`mt-1 block h-2 rounded-r-[4px] ${i === 0 ? "bg-ink" : "bg-ink/35"}`}
                      style={{ width: `${Math.max(2, (s.count / maisVista) * 100)}%` }}
                      aria-hidden
                    />
                  </span>
                  <span className="ep-code w-10 shrink-0 text-right text-xs text-dim">
                    {s.count}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      {stats.horasAno.length > 1 && (
        <section className="ep-card mt-3 p-5">
          <h2 className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-dim [font-stretch:80%]">
            Horas por ano
          </h2>
          <p className="mt-1 text-xs text-faint">
            Estimadas: o TV Time só deu o total, repartido pelos episódios com data certa.
          </p>
          <div className="mt-3">
            <Colunas
              titulo="Horas por ano"
              destaque="maior"
              colunaCabecalho="Ano"
              valorCabecalho="Horas (≈)"
              dados={stats.horasAno.map((h) => ({
                chave: h.ano,
                nome: String(h.ano),
                rotulo: String(h.ano).slice(2),
                valor: h.horas,
                leitura: `${h.ano} · ≈ ${h.horas} ${plural(h.horas, "hora", "horas")}`,
              }))}
            />
          </div>
        </section>
      )}

      {stats.currentStreak > 1 && (
        <div className="ep-card mt-6 flex items-center gap-3 p-4">
          <span className="bars flex h-10 w-10 shrink-0 items-center justify-center rounded-full" />
          <div className="min-w-0 flex-1">
            <p className="font-display font-semibold text-ink">
              {stats.currentStreak} dias seguidos a ver algo
            </p>
            <p className="text-xs text-dim">Continua assim.</p>
          </div>
        </div>
      )}

      {stats.bestBinge && (
        <section className="ep-card mt-3 p-5">
          <h2 className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-dim [font-stretch:80%]">
            Melhor maratona
          </h2>
          <p className="ep-code mt-2 text-3xl font-bold text-ink">
            {stats.bestBinge.count}{" "}
            <span className="text-lg font-normal text-dim">
              {stats.bestBinge.count === 1 ? "episódio" : "episódios"}
            </span>
          </p>
          <p className="mt-1 text-[0.9375rem] text-dim">{porExtenso(stats.bestBinge.date)}</p>
          {stats.bestBinge.topShow && (
            <p className="mt-2 text-xs text-faint">
              A maior parte foi de{" "}
              <span className="text-dim">{stats.bestBinge.topShow.name}</span> (
              {stats.bestBinge.topShow.count})
            </p>
          )}
        </section>
      )}

      {stats.longestStreak && stats.longestStreak.days > 1 && (
        <section className="ep-card mt-3 p-5">
          <h2 className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-dim [font-stretch:80%]">
            Sequência mais longa
          </h2>
          <p className="ep-code mt-2 text-3xl font-bold text-ink">
            {stats.longestStreak.days}{" "}
            <span className="text-lg font-normal text-dim">dias seguidos</span>
          </p>
          <p className="mt-1 text-[0.9375rem] text-dim">
            {porExtenso(stats.longestStreak.from)} → {porExtenso(stats.longestStreak.to)}
          </p>
        </section>
      )}

      <section className="ep-card mt-3 p-5">
        <h2 className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-dim [font-stretch:80%]">
          Dia da semana preferido
        </h2>
        <div className="mt-3">
          <Colunas
            titulo="Episódios por dia da semana"
            destaque="maior"
            colunaCabecalho="Dia"
            valorCabecalho="Episódios"
            dados={stats.perWeekday.map((w) => ({
              chave: w.weekday,
              nome: DIAS[w.weekday],
              rotulo: w.label,
              valor: w.count,
              leitura: `${DIAS[w.weekday]} · ${w.count} ${plural(w.count, "episódio", "episódios")}`,
            }))}
          />
        </div>
      </section>

      {stats.busiestMonth && (
        <section className="ep-card mt-3 p-5">
          <h2 className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-dim [font-stretch:80%]">
            Mês mais ativo de sempre
          </h2>
          <p className="mt-2 font-display text-xl font-bold text-ink first-letter:uppercase">
            {porMes(stats.busiestMonth.month)}
          </p>
          <p className="text-[0.9375rem] text-dim">{contarEpisodios(stats.busiestMonth.count)}</p>
        </section>
      )}

      {stats.distinctShowsWatchedInADay && stats.distinctShowsWatchedInADay.count > 1 && (
        <section className="ep-card mt-3 p-5">
          <h2 className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-dim [font-stretch:80%]">
            Mais variado
          </h2>
          <p className="ep-code mt-2 text-3xl font-bold text-ink">
            {stats.distinctShowsWatchedInADay.count}{" "}
            <span className="text-lg font-normal text-dim">séries no mesmo dia</span>
          </p>
          <p className="mt-1 text-[0.9375rem] text-dim">
            {porExtenso(stats.distinctShowsWatchedInADay.date)}
          </p>
        </section>
      )}
    </main>
  );
}
