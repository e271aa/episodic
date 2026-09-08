"use client";

import type { ShowWithProgress } from "@/lib/shows";
import PosterCard from "@/components/PosterCard";

/** Ponte entre uma série da Biblioteca e o `PosterCard` genérico. */
export default function ShowPoster({
  show,
  index,
  densidade,
}: {
  show: ShowWithProgress;
  index: number;
  densidade: "grande" | "compacta" | "lista";
}) {
  return (
    <PosterCard
      href={`/series/${show.uuid}`}
      name={show.name}
      posterPath={show.posterPath}
      index={index}
      watched={show.watchedCount}
      total={show.totalEpisodes}
      status={show.status}
      variante={densidade === "lista" ? "lista" : "grelha"}
      compacta={densidade === "compacta"}
    />
  );
}
