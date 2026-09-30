"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { loadProfileStats, type ProfileStats } from "@/lib/stats";
import { loadAdvancedStats, type AdvancedStats } from "@/lib/advancedStats";
import { isCloudConfigured } from "@/lib/supabase";
import { useIdentidade } from "@/components/ProfileCard";
import TituloGrande from "@/components/mira/TituloGrande";
import { Grupo, Linha } from "@/components/mira/Grupo";
import { Contador, Destaque } from "@/components/mira/Widget";
import TempoDeAntena from "@/components/mira/TempoDeAntena";
import { Bone } from "@/components/Skeleton";
import Colunas from "@/components/Colunas";
import MapaDeCalor from "@/components/MapaDeCalor";
import { plural } from "@/lib/graficos";
import { milhares } from "@/lib/numeros";

const DIAS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

export default function ProfilePage() {
  const [dados, setDados] = useState<{ stats: ProfileStats; avancadas: AdvancedStats } | null>(null);
  const { perfil } = useIdentidade();

  useEffect(() => {
    void Promise.all([loadProfileStats(), loadAdvancedStats()]).then(([stats, avancadas]) =>
      setDados({ stats, avancadas }),
    );
  }, []);

  if (dados === null) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 pt-8 pb-[calc(var(--dock-h)+2rem)]">
        <TituloGrande titulo="Perfil" />
        {/* a sombra do que vem: identidade, tempo de antena, os três
            contadores e o mapa */}
        <Bone className="mt-4 h-[72px] w-full rounded-[26px]" />
        <Bone className="mt-3 h-36 w-full rounded-[26px]" />
        <div className="mt-3 grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <Bone key={i} className="h-[88px] rounded-[22px]" />
          ))}
        </div>
        <Bone className="mt-3 h-44 w-full rounded-[26px]" />
      </main>
    );
  }

  const { stats, avancadas } = dados;
  const nome = perfil?.displayName?.trim() || (isCloudConfigured() ? "Sem nome" : "Neste aparelho");
  const desde = [
    stats.firstYear ? `Desde ${stats.firstYear}` : null,
    stats.importedAt ? "importado do TV Time" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // sem um único episódio marcado não há gráficos: um mapa todo vazio lê-se
  // como avaria, e o Tempo de antena já diz quando começa a contar
  const marcados = avancadas.perWeekday.reduce((n, w) => n + w.count, 0);
  const diaPreferido = avancadas.perWeekday.reduce((m, w) => (w.count > m.count ? w : m), avancadas.perWeekday[0]);
  const maisVista = avancadas.maisVistas[0];
  const maisNaLista = avancadas.maisVistas[0]?.count ?? 1;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-8 pb-[calc(var(--dock-h)+2rem)]">
      <TituloGrande titulo="Perfil" />

      <Grupo className="mt-4">
        <Linha
          href="/profile/definicoes"
          alta
          antes={<Avatar nome={nome} url={perfil?.avatarUrl ?? null} />}
          titulo={<span className="text-base font-semibold">{nome}</span>}
          subtitulo={desde || "Os teus dados vivem neste aparelho"}
        />
      </Grupo>

      <TempoDeAntena
        horas={stats.hours}
        porAno={avancadas.horasAno.map((h) => ({ ano: h.ano, horas: h.horas }))}
      />

      <div className="mt-3 grid grid-cols-3 gap-3">
        <Contador
          valor={milhares(stats.shows)}
          rotulo={plural(stats.shows, "série", "séries")}
          sub={`${stats.following} ${stats.following === 1 ? "seguida" : "seguidas"}`}
          href="/library"
        />
        <Contador valor={milhares(stats.episodes)} rotulo={plural(stats.episodes, "episódio", "episódios")} />
        <Contador
          valor={milhares(stats.movies)}
          rotulo={plural(stats.movies, "filme", "filmes")}
          href="/library?tipo=filmes"
        />
      </div>

      {marcados > 0 && (
        <>
          {avancadas.mapa.anos.length > 0 && (
            <section className="mt-3 rounded-[26px] bg-group px-[18px] py-4">
              <MapaDeCalor mapa={avancadas.mapa} titulo="Por mês" />
            </section>
          )}

          <div className="mt-3 grid grid-cols-2 gap-3">
            <Destaque rotulo="Dia preferido" valor={DIAS[diaPreferido.weekday]} />
            {maisVista && <Destaque rotulo="Mais vista" valor={maisVista.name} href={`/series/${maisVista.uuid}`} />}
          </div>

          {avancadas.maisVistas.length > 0 && (
            <Grupo titulo="Mais vistas" className="mt-6">
              <ol className="px-4 py-1.5">
                {avancadas.maisVistas.map((s, i) => (
                  <li key={s.uuid}>
                    <Link href={`/series/${s.uuid}`} className="flex min-h-11 items-center gap-3 py-1">
                      <span className="ep-code w-4 shrink-0 text-xs text-faint">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-semibold text-label">{s.name}</span>
                        <span
                          className={`mt-1 block h-2 rounded-r-[4px] ${i === 0 ? "bg-label" : "bg-label/35"}`}
                          style={{ width: `${Math.max(2, (s.count / maisNaLista) * 100)}%` }}
                          aria-hidden
                        />
                      </span>
                      <span className="ep-code w-10 shrink-0 text-right text-xs text-label-2">{s.count}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </Grupo>
          )}

          <section className="mt-6">
            <h2 className="mb-2 px-1 text-base font-semibold text-label">Dia da semana</h2>
            <div className="rounded-[26px] bg-group px-[18px] py-4">
              <Colunas
                titulo="Episódios por dia da semana"
                destaque="maior"
                colunaCabecalho="Dia"
                valorCabecalho="Episódios"
                dados={avancadas.perWeekday.map((w) => ({
                  chave: w.weekday,
                  nome: DIAS[w.weekday],
                  rotulo: w.label,
                  valor: w.count,
                  leitura: `${DIAS[w.weekday]} · ${w.count} ${plural(w.count, "episódio", "episódios")}`,
                }))}
              />
            </div>
          </section>
        </>
      )}

      {stats.genres.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 px-1 text-base font-semibold text-label">O teu espetro</h2>
          <div className="rounded-[26px] bg-group px-[18px] py-4">
            <div className="flex h-3 overflow-hidden rounded-full">
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
                <li key={g.name} className="flex items-center gap-1.5 text-[0.88rem]">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: g.color }} aria-hidden />
                  <span className="text-label-2">{g.name}</span>
                  <span className="ep-code text-xs text-faint">{Math.round(g.pct)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <Grupo className="mt-6">
        <Linha href="/estatisticas" titulo="Mais estatísticas" subtitulo="Horas por ano, maratonas e sequências" alta />
      </Grupo>
    </main>
  );
}

/** O avatar de 48px: a foto, ou a inicial do nome em SF Rounded. */
function Avatar({ nome, url }: { nome: string; url: string | null }) {
  return (
    <span className="relative mr-1 flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-chip">
      {url ? (
        <Image src={url} alt="" fill sizes="48px" className="object-cover" />
      ) : (
        <span aria-hidden className="font-rounded text-xl font-semibold text-label">
          {nome.trim()[0]?.toUpperCase() ?? "?"}
        </span>
      )}
    </span>
  );
}
