"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { imageUrl } from "@/lib/tmdb";
import { formatEpCode } from "@/lib/watchnext";
import { buildUpcomingCalendar, type UpcomingEntry } from "@/lib/upcoming";
import { loadShows } from "@/lib/shows";
import { ClapperboardIcon } from "@/components/icons";

function relativeDay(airDate: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const diffDays = Math.round(
    (Date.parse(airDate) - Date.parse(today)) / (24 * 60 * 60 * 1000),
  );
  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Amanhã";
  if (diffDays < 7) return `Em ${diffDays} dias`;
  return new Date(airDate).toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function EstrearPage() {
  const [entries, setEntries] = useState<UpcomingEntry[] | null>(null);

  useEffect(() => {
    void (async () => {
      const shows = await loadShows();
      setEntries(await buildUpcomingCalendar(shows));
    })();
  }, []);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold [font-stretch:110%]">A estrear</h1>
        <Link href="/series" className="text-sm text-dim hover:text-ink hover:underline">
          A seguir
        </Link>
      </div>
      <p className="mt-1 text-sm text-dim">
        O calendário dos próximos episódios das séries que segues.
      </p>

      {entries === null ? (
        <div className="mt-6 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-panel" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center">
          <ClapperboardIcon className="h-12 w-12 text-faint" />
          <p className="mt-4 max-w-sm font-display font-semibold">Nada agendado</p>
          <p className="mt-2 max-w-sm text-sm text-dim">
            Nenhuma das tuas séries tem estreia confirmada nos próximos tempos —
            ou já estão todas terminadas.
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-2">
          {entries.map(({ show, episode }) => {
            const poster = imageUrl(show.posterPath, "w185");
            return (
              <Link
                key={show.uuid}
                href={`/series/${show.uuid}`}
                className="ep-card ep-card-hover flex items-center gap-3 p-3"
              >
                {poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={poster}
                    alt=""
                    className="h-16 w-11 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-16 w-11 shrink-0 rounded-lg bg-raised" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{show.name}</p>
                  <p className="ep-code truncate text-sm text-dim">
                    {formatEpCode(episode.season, episode.episode)}
                    {episode.name ? ` · ${episode.name}` : ""}
                  </p>
                </div>
                <p className="ep-code shrink-0 text-right text-xs text-faint first-letter:uppercase">
                  {relativeDay(episode.airDate as string)}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
