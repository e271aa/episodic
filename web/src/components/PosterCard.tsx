"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import Poster from "@/components/Poster";

/**
 * "grelha" = cartaz em pé, para ver a arte. "lista" = uma linha por item,
 * para **procurar** — numa biblioteca de 136 séries e 239 filmes, ler
 * nomes seguidos é mais rápido do que reconhecer capas.
 */
export type VarianteCartaz = "grelha" | "lista";

/**
 * Selo + botão sobre o cartaz — hoje só o "Para ver" dos filmes o usa, mas
 * é o que faz o `MovieCard` deixar de duplicar o cartaz inteiro só para
 * acrescentar um botão. O clique nunca deve deixar o `<Link>` navegar —
 * quem o define trata do `preventDefault`/`stopPropagation`.
 */
export interface PosterCardAcao {
  /** selo no canto, só na grelha — ex. "Para ver" */
  selo?: string;
  aria: string;
  onClick: (e: React.MouseEvent) => void;
  icon: ReactNode;
}

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
  acao?: PosterCardAcao;
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
  return ENDED_STATUSES.has(status ?? "") ? "var(--color-smpte-magenta)" : "var(--color-smpte-green)";
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
  acao,
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
          <p className="truncate text-[0.9375rem] font-semibold">{name}</p>
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
        {acao && (
          <button
            onClick={acao.onClick}
            aria-label={acao.aria}
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line text-dim transition hover:border-ink hover:text-ink active:scale-90"
          >
            {acao.icon}
          </button>
        )}
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
            compacta ? "text-xs" : "text-[0.9375rem]"
          }`}
        >
          {name}
        </div>
        {/* As primeiras 2 decidem o LCP da página — sem prioridade, carregavam
            em `lazy` como todas as outras (Ronda 12, Fase 4, achado #16). */}
        <Poster
          path={posterPath}
          alt={name}
          fill
          sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, 20vw"
          className="object-cover transition duration-300 group-hover:scale-105"
          priority={index !== undefined && index < 2}
        />
        {progress !== null && (
          <>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-1 bg-black/50">
              {/* Sem brilho: a cor já tem significado (Bars Rule), o halo à
                  volta dela é só decoração a mais (Ronda 12, Fase 5b). */}
              <div
                className="h-full transition-[width] duration-[240ms] ease-out"
                style={{ width: `${progress}%`, background: barColor ?? undefined }}
              />
            </div>
          </>
        )}
        {acao && (
          <>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/70 to-transparent" />
            {acao.selo && (
              <span className="ep-code absolute left-1.5 top-1.5 rounded-md bg-tube/60 px-1.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-ink backdrop-blur">
                {acao.selo}
              </span>
            )}
            <button
              onClick={acao.onClick}
              aria-label={acao.aria}
              // o vidro escuro do recuar sobre a arte, não a pílula branca:
              // um ✓ em cada cartaz era a ação principal repetida por toda a
              // grelha (escolhido pelo Ruben, Ronda 12, 5d)
              className="tap-44 absolute bottom-1.5 right-1.5 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-ink/25 bg-tube/60 text-ink backdrop-blur transition active:scale-90"
            >
              {acao.icon}
            </button>
          </>
        )}
      </div>
      {/* Era compacta:15px / normal:17px — o 17px caiu na rampa do DESIGN
          (Ronda 12, Fase 5b.2), ficando igual ao das duas densidades. */}
      <p className="mt-1.5 truncate text-[0.9375rem] font-semibold">
        {name}
      </p>
      {legenda && <p className="ep-code truncate text-xs text-dim">{legenda}</p>}
    </Link>
  );
}
