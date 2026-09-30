"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadAdvancedStats, type AdvancedStats } from "@/lib/advancedStats";
import { loadProfileStats, type ProfileStats } from "@/lib/stats";
import CabecalhoEcra from "@/components/CabecalhoEcra";
import { Contador, Recorde } from "@/components/mira/Widget";
import { Bone } from "@/components/Skeleton";
import { porExtenso, porMes } from "@/lib/datas";
import { plural } from "@/lib/graficos";
import { milhares } from "@/lib/numeros";
import Colunas from "@/components/Colunas";

/**
 * «Mais estatísticas» — o que o Perfil não mostra: o ritmo (dias ativos,
 * média), os episódios e as horas por ano, e os recordes (maratonas,
 * sequências). O mapa por mês, o dia da semana e as séries mais vistas ficam
 * no Perfil (B·5).
 */
export default function EstatisticasPage() {
  const [dados, setDados] = useState<{ avancadas: AdvancedStats; perfil: ProfileStats } | null>(null);

  useEffect(() => {
    void Promise.all([loadAdvancedStats(), loadProfileStats()]).then(([avancadas, perfil]) =>
      setDados({ avancadas, perfil }),
    );
  }, []);

  if (dados === null) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 pt-8 pb-6">
        <CabecalhoEcra titulo="Estatísticas" voltar="Voltar ao perfil" fallback="/profile" />
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <Bone key={i} className="h-[88px] rounded-[22px]" />
          ))}
        </div>
        <Bone className="mt-3 h-52 w-full rounded-[26px]" />
        <Bone className="mt-3 h-52 w-full rounded-[26px]" />
      </main>
    );
  }

  const { avancadas: stats, perfil } = dados;
  const totalMarcado = stats.perWeekday.reduce((n, w) => n + w.count, 0);

  /**
   * Sem um único episódio marcado não há estatística nenhuma — e o que se via
   * era só um gráfico de barras todas a zero, que se lê como avaria e não
   * como "ainda não há nada". Um ecrã vazio tem de oferecer o passo seguinte,
   * não encolher os ombros.
   */
  if (totalMarcado === 0) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 pt-8 pb-6">
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

  const media = stats.diasAtivos > 0 ? stats.episodiosComData / stats.diasAtivos : 0;
  const recordes = [
    stats.bestBinge && (
      <Recorde
        key="maratona"
        rotulo="Melhor maratona"
        valor={String(stats.bestBinge.count)}
        unidade={plural(stats.bestBinge.count, "episódio", "episódios")}
        detalhe={
          <>
            {porExtenso(stats.bestBinge.date)}
            {stats.bestBinge.topShow && (
              <span className="mt-0.5 block">
                A maior parte foi de {stats.bestBinge.topShow.name} ({stats.bestBinge.topShow.count})
              </span>
            )}
          </>
        }
      />
    ),
    stats.longestStreak && stats.longestStreak.days > 1 && (
      <Recorde
        key="sequencia"
        rotulo="Sequência mais longa"
        valor={String(stats.longestStreak.days)}
        unidade="dias seguidos"
        detalhe={`${porExtenso(stats.longestStreak.from)} → ${porExtenso(stats.longestStreak.to)}`}
      />
    ),
    stats.currentStreak > 1 && (
      <Recorde
        key="atual"
        rotulo="Sequência atual"
        valor={String(stats.currentStreak)}
        unidade="dias seguidos"
        detalhe="a ver algo"
      />
    ),
    stats.busiestMonth && (
      <Recorde
        key="mes"
        rotulo="Mês mais ativo de sempre"
        valor={String(stats.busiestMonth.count)}
        unidade={plural(stats.busiestMonth.count, "episódio", "episódios")}
        detalhe={<span className="first-letter:uppercase">{porMes(stats.busiestMonth.month)}</span>}
      />
    ),
    stats.distinctShowsWatchedInADay && stats.distinctShowsWatchedInADay.count > 1 && (
      <Recorde
        key="variado"
        rotulo="Mais variado"
        valor={String(stats.distinctShowsWatchedInADay.count)}
        unidade="séries no mesmo dia"
        detalhe={porExtenso(stats.distinctShowsWatchedInADay.date)}
      />
    ),
  ].filter(Boolean);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-8 pb-6">
      <CabecalhoEcra titulo="Estatísticas" voltar="Voltar ao perfil" fallback="/profile" />

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Contador valor={milhares(stats.diasAtivos)} rotulo={plural(stats.diasAtivos, "dia ativo", "dias ativos")} />
        <Contador
          valor={media.toFixed(1).replace(".", ",")}
          rotulo="episódios por dia ativo"
        />
        <Contador valor={String(perfil.perYear.length)} rotulo={plural(perfil.perYear.length, "ano a ver", "anos a ver")} />
      </div>

      {perfil.perYear.length > 1 && (
        <section className="mt-6">
          <h2 className="mb-2 px-1 text-base font-semibold text-label">Episódios por ano</h2>
          <div className="rounded-[26px] bg-group px-[18px] py-4">
            <Colunas
              titulo="Episódios por ano"
              destaque="ultima"
              colunaCabecalho="Ano"
              valorCabecalho="Episódios"
              dados={perfil.perYear.map((y) => ({
                chave: y.year,
                nome: String(y.year),
                rotulo: String(y.year).slice(2),
                valor: y.count,
                leitura: `${y.year} · ${y.count} ${plural(y.count, "episódio", "episódios")}`,
              }))}
            />
          </div>
        </section>
      )}

      {stats.horasAno.length > 1 && (
        <section className="mt-6">
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

      {recordes.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 px-1 text-base font-semibold text-label">Recordes</h2>
          <div className="grid grid-cols-2 gap-3">{recordes}</div>
        </section>
      )}
    </main>
  );
}
