"use client";

import { useCallback } from "react";
import { putMovie, type StoredMovie } from "@/lib/db";
import { pushUndo } from "@/lib/undo";
import PosterCard, { type VarianteCartaz } from "@/components/PosterCard";
import { CheckIcon } from "@/components/icons";

/**
 * O cartaz de um filme da Biblioteca. Era um cartão inteiro à parte (as
 * mesmas ~115 linhas do `PosterCard`, com "Para ver" e um botão de marcar
 * visto por cima) — agora é só o `PosterCard` com uma `acao`. A única coisa
 * que um filme tem que uma série não tem é essa ação.
 */
export default function MovieCard({
  movie,
  index,
  onChanged,
  densidade,
}: {
  movie: StoredMovie;
  index: number;
  onChanged: () => void;
  densidade: "grande" | "compacta" | "lista";
}) {
  const year = movie.releaseDate?.slice(0, 4);
  const paraVer = !movie.watchedAt;
  const variante: VarianteCartaz = densidade === "lista" ? "lista" : "grelha";

  const markWatched = useCallback(
    async (e: React.MouseEvent) => {
      // o botão vive dentro do Link do PosterCard — não pode navegar para o detalhe
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
    <PosterCard
      href={`/movies/${movie.key}`}
      name={movie.name}
      posterPath={movie.posterPath ?? null}
      index={index}
      subtitle={
        variante === "lista"
          ? `${year ?? movie.watchedAt?.slice(0, 4) ?? ""}${paraVer ? " · para ver" : ""}`
          : (year ?? movie.watchedAt?.slice(0, 4) ?? "")
      }
      variante={variante}
      compacta={densidade === "compacta"}
      acao={
        paraVer
          ? {
              selo: variante === "grelha" ? "Para ver" : undefined,
              aria: `Marcar ${movie.name} como visto`,
              onClick: (e) => void markWatched(e),
              icon: <CheckIcon className="h-4 w-4" />,
            }
          : undefined
      }
    />
  );
}
