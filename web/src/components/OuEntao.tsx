import Link from "next/link";
import Poster from "@/components/Poster";

export interface Alternativa {
  href: string;
  titulo: string;
  /** porque aparece, em mono: "continuar", "retomar", "começar", "filme" */
  rotulo: string;
  posterPath: string | null;
}

/**
 * "Ou então" — as duas alternativas por baixo do herói da casa.
 *
 * O herói dava uma resposta só, escolhida pela última marcação: sem nada
 * visto há 30 dias, propunha a série largada mais recente (o Grey's, a 3 de
 * 460), e os filmes "para ver" nunca entravam na decisão (Ronda 12, Fase 4,
 * achado #7). Escolhido pelo Ruben a 27-09 (variante C): o herói fica, e por
 * baixo do "Marcar visto" aparecem outra série e um filme da lista.
 *
 * Propõe, não decide: tocar abre a página — não marca nada.
 */
export default function OuEntao({ alternativas }: { alternativas: Alternativa[] }) {
  if (alternativas.length === 0) return null;
  return (
    <div className="mt-4" data-testid="ou-entao">
      <p className="text-xs text-dim">Ou então</p>
      <div className="mt-2 flex gap-2">
        {alternativas.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-2xl border border-line bg-panel/80 p-2 backdrop-blur transition active:scale-[0.98]"
          >
            <div className="relative h-12 w-8 shrink-0 overflow-hidden rounded-md bg-raised">
              <Poster path={a.posterPath} alt="" size="w185" fill sizes="32px" className="object-cover" />
            </div>
            <span className="min-w-0">
              <span className="block truncate text-[0.9375rem] font-semibold text-ink">
                {a.titulo}
              </span>
              <span className="ep-code block truncate text-xs text-dim">{a.rotulo}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
