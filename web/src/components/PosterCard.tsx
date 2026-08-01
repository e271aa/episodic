"use client";

import Link from "next/link";
import Poster from "@/components/Poster";

/**
 * "grelha" = cartaz em pé, para ver a arte. "lista" = uma linha por item,
 * para **procurar** — numa biblioteca de 136 séries e 239 filmes, ler
 * nomes seguidos é mais rápido do que reconhecer capas.
 */
export type VarianteCartaz = "grelha" | "lista";

export interface PosterCardProps {
  href: string;
  name: string;
  posterPath: string | null;
  /** posição na grelha, para a entrada escalonada */
  index?: number;
  /** episódios vistos / total (total pode ser desconhecido antes dos metadados) */
  watched?: number;
  total?: number | null;
  subtitle?: string;
  /** estado da série no fornecedor (TMDB/TVmaze) — dita a cor da barra quando em dia */
  status?: string | null;
  variante?: VarianteCartaz;
  /** cantos e nome mais pequenos quando cabem 3+ por linha */
  compacta?: boolean;
}

// A série acabou de vez — sem isto, "em dia" fica sempre verde (o valor
// por omissão é assumir que ainda pode vir mais, nunca o contrário)
const ENDED_STATUSES = new Set(["Ended", "Canceled", "Cancelled"]);

/**
 * Cor da barra de progresso, com significado (como o TV Time tinha):
 *  - a meio de ver: branco — neutro, é só progresso
 *  - em dia e a série ainda pode ter mais temporadas: verde
 *  - em dia mas a série já terminou, não vem mais nada: roxo
 * As cores vêm da paleta das barras SMPTE, não são novas.
 */
function progressBarColor(
  watched: number,
  total: number,
  status: string | null | undefined,
): string {
  if (watched < total) return "var(--color-ink)";
  return ENDED_STATUSES.has(status ?? "") ? "#d24bd2" : "#37c837";
}

export default function PosterCard({
  href,
  name,
  posterPath,
  index,
  watched,
  total,
  subtitle,
  status,
  variante = "grelha",
  compacta = false,
}: PosterCardProps) {
  const progress =
    watched !== undefined && total ? Math.min(100, (watched / total) * 100) : null;
  const barColor =
    watched !== undefined && total ? progressBarColor(watched, total, status) : null;
  const legenda =
    watched !== undefined || subtitle
      ? (subtitle ?? (total ? `${watched}/${total}` : `${watched} vistos`))
      : null;
  // entrada escalonada: a grelha monta-se em cascata, não toda de uma vez
  const entrada =
    index !== undefined ? { animationDelay: `${Math.min(index, 11) * 35}ms` } : undefined;

  if (variante === "lista") {
    return (
      <Link
        href={href}
        className="poster-in group flex min-h-[72px] cursor-pointer items-center gap-3 border-b border-line py-2 transition active:scale-[0.99]"
        style={entrada}
      >
        <div className="relative h-14 w-[38px] shrink-0 overflow-hidden rounded-lg bg-raised shadow-sm shadow-black/30">
          <Poster
            path={posterPath}
            alt=""
            size="w185"
            fill
            sizes="38px"
            className="object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-semibold">{name}</p>
          {legenda && <p className="ep-code truncate text-xs text-dim">{legenda}</p>}
          {progress !== null && (
            <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-raised">
              <div
                className="h-full transition-[width] duration-[240ms] ease-out"
                style={{ width: `${progress}%`, background: barColor ?? undefined }}
              />
            </div>
          )}
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className="poster-in group block cursor-pointer transition active:scale-[0.97]"
      style={entrada}
    >
      <div
        className={`relative aspect-2/3 overflow-hidden bg-panel shadow-md shadow-black/30 transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lg group-hover:ring-2 group-hover:ring-ink/60 ${
          compacta ? "rounded-xl" : "rounded-2xl"
        }`}
      >
        {/* O nome fica sempre por baixo: enquanto a capa não chega (ou se
            faltar de todo), a caixa lê-se como um cartaz sem arte em vez de
            um buraco preto que parece avariado. */}
        <div
          className={`absolute inset-0 flex items-center justify-center bg-raised p-2 text-center font-display font-bold text-dim ${
            compacta ? "text-xs" : "text-[15px]"
          }`}
        >
          {name}
        </div>
        <Poster
          path={posterPath}
          alt={name}
          fill
          sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, 20vw"
          className="object-cover transition duration-300 group-hover:scale-105"
        />
        {progress !== null && (
          <>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-1 bg-black/50">
              <div
                className="h-full transition-[width] duration-[240ms] ease-out"
                style={{
                  width: `${progress}%`,
                  background: barColor ?? undefined,
                  boxShadow: barColor ? `0 0 6px ${barColor}b3` : undefined,
                }}
              />
            </div>
          </>
        )}
      </div>
      <p
        className={`mt-1.5 truncate font-semibold ${compacta ? "text-[15px]" : "text-[17px]"}`}
      >
        {name}
      </p>
      {legenda && <p className="ep-code truncate text-xs text-dim">{legenda}</p>}
    </Link>
  );
}
