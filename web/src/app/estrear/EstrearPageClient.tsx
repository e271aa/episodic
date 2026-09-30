"use client";

import { useEffect, useState } from "react";
import { formatEpCode } from "@/lib/watchnext";
import { buildUpcomingCalendar, type UpcomingEntry } from "@/lib/upcoming";
import { useSeries } from "@/lib/cache";
import { ClapperboardIcon } from "@/components/icons";
import { Grupo, Linha } from "@/components/mira/Grupo";
import Codigo from "@/components/mira/Codigo";
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
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pt-8 pb-6">
      <CabecalhoEcra titulo="A estrear" voltar="Voltar a A seguir" fallback="/series" />
      <p className="mt-1 text-[0.88rem] text-label-2">
        O calendário dos próximos episódios das séries que segues.
      </p>

      {entries === null ? (
        <ListRowsBone />
      ) : entries.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <ClapperboardIcon className="h-12 w-12 text-label-3" />
          <p className="mt-4 max-w-sm text-[1.18rem] font-semibold text-label">Nada agendado</p>
          <p className="mt-2 max-w-sm text-[0.88rem] text-label-2">
            Nenhuma das tuas séries tem estreia confirmada nos próximos tempos —
            ou já estão todas terminadas.
          </p>
        </div>
      ) : (
        <Grupo className="mt-6">
          {entries.map(({ show, episode }) => (
            <Linha
              key={show.uuid}
              href={`/series/${show.uuid}`}
              alta
              quebra
              antes={
                <span className="relative my-2 mr-0.5 block h-[52px] w-9 overflow-hidden rounded-lg bg-fill">
                  {show.posterPath && (
                    <Poster path={show.posterPath} alt="" size="w185" fill sizes="36px" className="object-cover" />
                  )}
                </span>
              }
              // O nome inteiro, a quebrar linha: é o que se procura, e cortado
              // deixava de se saber de que série era (Ronda 12, Fecho).
              titulo={<span className="block whitespace-normal break-words leading-snug">{show.name}</span>}
              subtitulo={
                <>
                  <Codigo>{formatEpCode(episode.season, episode.episode)}</Codigo>
                  {episode.name && <> · {episode.name}</>}
                  <br />
                  <span className="inline-block first-letter:uppercase">{relativeDay(episode.airDate as string)}</span>
                </>
              }
            />
          ))}
        </Grupo>
      )}
    </main>
  );
}
