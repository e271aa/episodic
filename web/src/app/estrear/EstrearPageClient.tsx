"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatEpCode } from "@/lib/watchnext";
import { buildUpcomingCalendar, type UpcomingEntry } from "@/lib/upcoming";
import { useSeries } from "@/lib/cache";
import { ClapperboardIcon } from "@/components/icons";
import Poster from "@/components/Poster";
import CabecalhoEcra from "@/components/CabecalhoEcra";
import { ListRowsBone } from "@/components/Skeleton";
import { comDiaDaSemana } from "@/lib/datas";

function relativeDay(airDate: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const diffDays = Math.round(
    (Date.parse(airDate) - Date.parse(today)) / (24 * 60 * 60 * 1000),
  );
  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Amanhã";
  if (diffDays < 7) return `Em ${diffDays} dias`;
  return comDiaDaSemana(airDate);
}

export default function EstrearPage() {
  // A cache partilhada poupa a releitura da biblioteca a cada visita — só o
  // calendário em si (que pede temporadas/episódios por série) continua a
  // recalcular-se, e já tem a sua própria cache de 24h em lib/metadata.ts.
  const shows = useSeries();
  const [entries, setEntries] = useState<UpcomingEntry[] | null>(null);

  useEffect(() => {
    if (!shows) return;
    let vivo = true;
    void buildUpcomingCalendar(shows).then((e) => {
      if (vivo) setEntries(e);
    });
    return () => {
      vivo = false;
    };
  }, [shows]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pt-8 pb-[calc(var(--dock-h)+2rem)]">
      <CabecalhoEcra titulo="A estrear" voltar="Voltar a A seguir" fallback="/series" />
      <p className="mt-1 text-[0.9375rem] text-dim">
        O calendário dos próximos episódios das séries que segues.
      </p>

      {entries === null ? (
        <ListRowsBone />
      ) : entries.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <ClapperboardIcon className="h-12 w-12 text-faint" />
          <p className="mt-4 max-w-sm font-display font-semibold">Nada agendado</p>
          <p className="mt-2 max-w-sm text-[0.9375rem] text-dim">
            Nenhuma das tuas séries tem estreia confirmada nos próximos tempos —
            ou já estão todas terminadas.
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-2">
          {entries.map(({ show, episode }) => {
            return (
              <Link
                key={show.uuid}
                href={`/series/${show.uuid}`}
                className="ep-card ep-card-hover flex items-center gap-3 p-3"
              >
                {show.posterPath ? (
                  <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-lg">
                    <Poster path={show.posterPath} alt="" size="w185" fill sizes="44px" className="object-cover" />
                  </div>
                ) : (
                  <div className="h-16 w-11 shrink-0 rounded-lg bg-raised" />
                )}
                {/* Tudo numa coluna (Ronda 12, Fecho): a data por extenso à
                    direita, com `shrink-0`, comia a linha — o nome ficava com
                    57px a 390px ("Grey's / Anato / my") e 0px a 320px. */}
                <div className="min-w-0 flex-1">
                  {/* o nome inteiro, a quebrar linha: é o que se procura, e
                      cortado deixava de se saber de que série era */}
                  <p className="font-semibold leading-snug break-words">{show.name}</p>
                  <p className="ep-code flex min-w-0 gap-1 text-sm text-dim">
                    <span className="shrink-0">{formatEpCode(episode.season, episode.episode)}</span>
                    {episode.name && <span className="truncate">· {episode.name}</span>}
                  </p>
                  <p className="ep-code mt-0.5 text-xs text-faint first-letter:uppercase">
                    {relativeDay(episode.airDate as string)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
