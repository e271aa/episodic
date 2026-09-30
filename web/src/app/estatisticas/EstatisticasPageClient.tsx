"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadAdvancedStats, type AdvancedStats } from "@/lib/advancedStats";
import CabecalhoEcra from "@/components/CabecalhoEcra";
import { Grupo, Linha } from "@/components/mira/Grupo";
import { Bone } from "@/components/Skeleton";
import { porExtenso, porMes } from "@/lib/datas";
import { contarEpisodios } from "@/lib/buracos";
import { plural } from "@/lib/graficos";
import Colunas from "@/components/Colunas";

/**
 * «Mais estatísticas» — o que o Perfil não mostra: as horas por ano e os
 * recordes (maratonas, sequências). O mapa por mês, o dia da semana e as
 * séries mais vistas ficaram no Perfil (B·5).
 */
export default function EstatisticasPage() {
  const [stats, setStats] = useState<AdvancedStats | null>(null);

  useEffect(() => {
    void loadAdvancedStats().then(setStats);
  }, []);

  if (stats === null) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 pt-8 pb-[calc(var(--dock-h)+2rem)]">
        <CabecalhoEcra titulo="Estatísticas" voltar="Voltar ao perfil" fallback="/profile" />
        <Bone className="mt-4 h-44 w-full rounded-[26px]" />
        <Bone className="mt-3 h-52 w-full rounded-[26px]" />
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
          <p className="text-[1.18rem] font-semibold text-label">Ainda não há nada para contar</p>
          <p className="mt-1 max-w-xs text-[0.88rem] text-label-2">
            Estas contas saem dos episódios que marcares — maratonas, sequências,
            o dia da semana em que vês mais.
          </p>
          <Link
            href="/series"
            className="mt-6 flex min-h-[52px] items-center rounded-full bg-acao px-6 text-base font-semibold text-on-label transition-transform duration-100 active:scale-[0.97]"
          >
            Marcar o primeiro
          </Link>
        </div>
      </main>
    );
  }

  const temRecordes =
    stats.currentStreak > 1 ||
    stats.bestBinge ||
    (stats.longestStreak && stats.longestStreak.days > 1) ||
    stats.busiestMonth ||
    (stats.distinctShowsWatchedInADay && stats.distinctShowsWatchedInADay.count > 1);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-8 pb-[calc(var(--dock-h)+2rem)]">
      <CabecalhoEcra titulo="Estatísticas" voltar="Voltar ao perfil" fallback="/profile" />

      {stats.horasAno.length > 1 && (
        <section className="mt-4">
          <h2 className="mb-2 px-1 text-base font-semibold text-label">Horas por ano</h2>
          <div className="rounded-[26px] bg-group px-[18px] py-4">
            <p className="text-[0.76rem] text-label-2">
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
          </div>
        </section>
      )}

      {temRecordes && (
        <Grupo titulo="Recordes" className="mt-6">
          {stats.currentStreak > 1 && (
            <Linha alta titulo="Sequência atual" depois={`${stats.currentStreak} dias seguidos a ver algo`} />
          )}
          {stats.bestBinge && (
            <Linha
              alta
              quebra
              titulo="Melhor maratona"
              subtitulo={
                <>
                  {porExtenso(stats.bestBinge.date)}
                  {stats.bestBinge.topShow && (
                    <span className="block">
                      A maior parte foi de {stats.bestBinge.topShow.name} ({stats.bestBinge.topShow.count})
                    </span>
                  )}
                </>
              }
              depois={contarEpisodios(stats.bestBinge.count)}
            />
          )}
          {stats.longestStreak && stats.longestStreak.days > 1 && (
            <Linha
              alta
              quebra
              titulo="Sequência mais longa"
              subtitulo={`${porExtenso(stats.longestStreak.from)} → ${porExtenso(stats.longestStreak.to)}`}
              depois={`${stats.longestStreak.days} dias seguidos`}
            />
          )}
          {stats.busiestMonth && (
            <Linha
              alta
              titulo="Mês mais ativo de sempre"
              subtitulo={<span className="first-letter:uppercase">{porMes(stats.busiestMonth.month)}</span>}
              depois={contarEpisodios(stats.busiestMonth.count)}
            />
          )}
          {stats.distinctShowsWatchedInADay && stats.distinctShowsWatchedInADay.count > 1 && (
            <Linha
              alta
              quebra
              titulo="Mais variado"
              subtitulo={porExtenso(stats.distinctShowsWatchedInADay.date)}
              depois={`${stats.distinctShowsWatchedInADay.count} séries no mesmo dia`}
            />
          )}
        </Grupo>
      )}
    </main>
  );
}
