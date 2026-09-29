"use client";

import { useCallback } from "react";
import { putMovie, type StoredMovie } from "@/lib/db";
import { pushUndo } from "@/lib/undo";
import Cartaz from "@/components/mira/Cartaz";
import { CheckIcon } from "@/components/icons";

/**
 * O cartaz de um filme da Biblioteca: o `Cartaz` com uma `acao`. A única coisa
 * que um filme tem que uma série não tem é essa ação (marcar como visto).
 */
export default function MovieCard({
  movie,
  index,
  onChanged,
}: {
  movie: StoredMovie;
  index: number;
  onChanged: () => void;
}) {
  const year = movie.releaseDate?.slice(0, 4);
  const paraVer = !movie.watchedAt;

  const markWatched = useCallback(
    async (e: React.MouseEvent) => {
      // o botão vive dentro do Link do Cartaz — não pode navegar para o detalhe
      e.preventDefault();
      e.stopPropagation();
      await putMovie({ ...movie, watchedAt: new Date().toISOString() });
      onChanged();
      pushUndo({
        label: "Filme marcado como visto",
        detail: movie.name,
        undo: async () => {
          await putMovie({ ...movie, watchedAt: null });
          onChanged();
        },
      });
    },
    [movie, onChanged],
  );

  return (
    <Cartaz
      href={`/movies/${movie.key}`}
      nome={movie.name}
      capa={movie.posterPath ?? null}
      indice={index}
      legenda={year ?? movie.watchedAt?.slice(0, 4) ?? ""}
      acao={
        paraVer
          ? {
              selo: "Para ver",
              aria: `Marcar ${movie.name} como visto`,
              onClick: (e) => void markWatched(e),
              icon: <CheckIcon className="h-4 w-4" />,
            }
          : undefined
      }
    />
  );
}
