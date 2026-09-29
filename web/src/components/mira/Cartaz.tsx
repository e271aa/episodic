"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Tv } from "lucide-react";
import Poster from "@/components/Poster";

/**
 * Uma ação sobre o cartaz — hoje só o «Marcar como visto» dos filmes «para
 * ver». O clique nunca deve deixar o `<Link>` navegar: quem a define trata do
 * `preventDefault`/`stopPropagation`.
 */
export interface CartazAcao {
  /** selo no canto — ex. «Para ver» */
  selo?: string;
  aria: string;
  onClick: (e: React.MouseEvent) => void;
  icon: ReactNode;
}

// A série acabou de vez — sem isto, «em dia» fica sempre verde (o valor por
// omissão é assumir que ainda pode vir mais, nunca o contrário)
const TERMINADAS = new Set(["Ended", "Canceled", "Cancelled"]);

/**
 * A cor da barra é o estado da série (DESIGN, «Regra da mira»): a meio de
 * ver, `label` (neutro, é só progresso); em dia e a série continua, verde;
 * em dia e já terminou, magenta.
 */
function corDaBarra(visto: number, total: number, estado: string | null | undefined): string {
  if (visto < total) return "var(--color-label)";
  return TERMINADAS.has(estado ?? "") ? "var(--color-terminada)" : "var(--color-em-dia)";
}

/**
 * O cartaz da Biblioteca (B·3): capa 2:3 com raio 12, a barra de 3px **por
 * baixo** (não por cima da arte: a arte fica limpa), o nome a 13/600 em duas
 * linhas no máximo e, por baixo, uma linha em mono — o próximo código, a
 * contagem, o ano. Sem capa, o próprio cartaz diz o nome (B·E4): um cartaz
 * sem arte que se lê como um cartaz, não como um buraco avariado.
 */
export default function Cartaz({
  href,
  nome,
  capa,
  indice,
  progresso,
  legenda,
  acao,
  grande = false,
  fluida = false,
  rodape,
  onAbrir,
}: {
  /** sem `href` o cartaz não leva a lado nenhum (no Explorar, a capa ainda não tem detalhe) */
  href?: string;
  nome: string;
  capa: string | null | undefined;
  /** posição na grelha, para a entrada escalonada */
  indice?: number;
  /** episódios vistos / total (o total pode ser desconhecido antes dos metadados) */
  progresso?: { visto: number; total: number | null; estado?: string | null };
  /** a linha em mono por baixo do nome: `S02·E07`, `6/10`, `2021`, «completa» */
  legenda?: ReactNode;
  acao?: CartazAcao;
  /** a capa grande do Explorar (B·4): 150px, raio 14, nome a 15/600, legenda a 13 */
  grande?: boolean;
  /** numa grelha o cartaz enche a coluna; numa faixa tem a largura da capa */
  fluida?: boolean;
  /** a ação por baixo (fora da ligação): uma só por cartaz no Explorar */
  rodape?: ReactNode;
  /** sem `href`, tocar na capa faz isto (no Explorar, abre a ficha) */
  onAbrir?: () => void;
}) {
  const barra =
    progresso?.total
      ? {
          largura: Math.min(100, (progresso.visto / progresso.total) * 100),
          cor: corDaBarra(progresso.visto, progresso.total, progresso.estado),
        }
      : null;

  const corpo = (
    <>
      <div
        className={`relative aspect-2/3 overflow-hidden bg-group shadow-[inset_0_0_0_0.5px_var(--m-separator)] ${
          grande ? "rounded-[14px]" : "rounded-xl"
        }`}
      >
        {/* O plano B fica **por baixo** da imagem: enquanto a capa não chega,
            ou se faltar de todo, lê-se o nome. */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-2 text-center">
          <Tv aria-hidden className="h-[22px] w-[22px] text-label-3" strokeWidth={1.8} />
          <span className="line-clamp-4 text-xs font-semibold leading-tight text-label-2">
            {nome}
          </span>
        </div>
        {/* As primeiras 2 decidem o LCP da página (Ronda 12, Fase 4, #16) */}
        <Poster
          path={capa}
          alt={nome}
          fill
          sizes={grande ? "150px" : "(max-width: 640px) 33vw, (max-width: 768px) 25vw, 20vw"}
          className="object-cover"
          priority={indice !== undefined && indice < 2}
        />
        {acao && (
          <>
            {acao.selo && (
              <span className="vidro ep-code absolute left-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-label">
                {acao.selo}
              </span>
            )}
            <button
              onClick={acao.onClick}
              aria-label={acao.aria}
              // vidro sobre a arte, não a cápsula da ação: um ✓ em cada cartaz
              // era a ação principal repetida por toda a grelha (Ronda 12, 5d)
              className="vidro tap-44 absolute bottom-1.5 right-1.5 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-label transition-transform active:scale-90"
            >
              {acao.icon}
            </button>
          </>
        )}
      </div>
      {barra && (
        <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-label/[0.14]" aria-hidden>
          <div
            className="h-full rounded-full transition-[width] duration-[240ms] ease-out"
            style={{ width: `${barra.largura}%`, background: barra.cor }}
          />
        </div>
      )}
      <p
        className={`line-clamp-2 font-semibold leading-snug text-label ${
          grande ? "text-[0.9375rem]" : "text-[0.76rem]"
        } ${barra ? "mt-1.5" : "mt-2"}`}
      >
        {nome}
      </p>
      {legenda && (
        <p
          className={`ep-code mt-0.5 truncate text-label-2 ${grande ? "text-[0.8125rem]" : "text-[0.7rem]"}`}
        >
          {legenda}
        </p>
      )}
    </>
  );

  return (
    <div
      className={`poster-in ${grande && !fluida ? "w-[150px] shrink-0" : ""}`}
      style={
        indice !== undefined ? { animationDelay: `${Math.min(indice, 11) * 35}ms` } : undefined
      }
    >
      {href ? (
        <Link href={href} className="group block cursor-pointer transition-transform active:scale-[0.97]">
          {corpo}
        </Link>
      ) : onAbrir ? (
        <button
          type="button"
          onClick={onAbrir}
          aria-label={`Abrir ${nome}`}
          className="block w-full cursor-pointer text-left transition-transform active:scale-[0.97]"
        >
          {corpo}
        </button>
      ) : (
        <div>{corpo}</div>
      )}
      {rodape}
    </div>
  );
}
