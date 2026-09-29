import type { ReactNode } from "react";
import Poster from "@/components/Poster";
import { Grupo, Linha } from "@/components/mira/Grupo";

export interface Alternativa {
  href: string;
  titulo: string;
  /** o porquê e o quê: «Continuar · S03·E04» (o código em mono), «Para ver · filme de 2024» */
  subtitulo: ReactNode;
  posterPath: string | null;
}

/**
 * "Ou então" — as alternativas por baixo do cartão da casa.
 *
 * O cartão dava uma resposta só, escolhida pela última marcação, e os filmes
 * "para ver" nunca entravam na decisão (Ronda 12, Fase 4, achado #7).
 * Escolhido pelo Ruben a 27-09: por baixo aparecem outra série e um filme da
 * lista. Na Mira é uma lista agrupada, com o código do episódio à vista.
 *
 * Propõe, não decide: tocar abre a página — não marca nada.
 */
export default function OuEntao({ alternativas }: { alternativas: Alternativa[] }) {
  if (alternativas.length === 0) return null;
  return (
    <div data-testid="ou-entao">
      <Grupo titulo="Ou então" className="mt-6">
        {alternativas.map((a) => (
          <Linha
            key={a.href}
            href={a.href}
            alta
            titulo={a.titulo}
            subtitulo={a.subtitulo}
            antes={
              <span className="relative block h-[52px] w-9 overflow-hidden rounded-[8px] bg-elevated">
                <Poster path={a.posterPath} alt="" size="w185" fill sizes="36px" className="object-cover" />
              </span>
            }
          />
        ))}
      </Grupo>
    </div>
  );
}
