"use client";

import type { ShowWithProgress } from "@/lib/shows";
import Cartaz from "@/components/mira/Cartaz";

/**
 * Ponte entre uma série da Biblioteca e o `Cartaz`. A linha em mono diz a
 * coisa mais útil que se sabe: «completa», o próximo código (`S02·E07`, se a
 * fila do «A seguir» já o calculou) ou, na falta dele, a contagem.
 */
export default function ShowPoster({
  show,
  index,
  proximo,
}: {
  show: ShowWithProgress;
  index: number;
  /** o próximo episódio por ver, já formatado (`S02·E07`) */
  proximo?: string | null;
}) {
  const completa = show.totalEpisodes != null && show.watchedCount >= show.totalEpisodes;
  const legenda = completa
    ? "completa"
    : (proximo ??
      (show.totalEpisodes
        ? `${show.watchedCount}/${show.totalEpisodes}`
        : `${show.watchedCount} vistos`));
  return (
    <Cartaz
      href={`/series/${show.uuid}`}
      nome={show.name}
      capa={show.posterPath}
      indice={index}
      progresso={{ visto: show.watchedCount, total: show.totalEpisodes, estado: show.status }}
      legenda={legenda}
    />
  );
}
