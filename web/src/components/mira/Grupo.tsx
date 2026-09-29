import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

/**
 * A lista agrupada da Mira: um bloco de `group` com raio 26, linhas separadas
 * por um fio de 0.5px que começa depois do conteúdo à esquerda (como no iOS),
 * sem sombra — no fluxo, a profundidade é só tom.
 */
export function Grupo({
  children,
  className = "",
  titulo,
}: {
  children: ReactNode;
  className?: string;
  /** o cabeçalho da secção, por cima do grupo (Título 2 ou Cabeçalho) */
  titulo?: ReactNode;
}) {
  return (
    <section className={className}>
      {titulo && <h2 className="mb-2 px-1 text-base font-semibold text-label">{titulo}</h2>}
      <div className="overflow-hidden rounded-[26px] bg-group">{children}</div>
    </section>
  );
}

/**
 * Uma linha de um grupo. Leva a algum lado (`href`), faz alguma coisa
 * (`onClick`) ou só mostra. O conteúdo à esquerda (`antes`: capa, ícone,
 * avatar) empurra o início do fio, como no iOS.
 */
export function Linha({
  titulo,
  subtitulo,
  antes,
  depois,
  href,
  onClick,
  chevron = Boolean(href),
  alta = false,
}: {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  antes?: ReactNode;
  depois?: ReactNode;
  href?: string;
  onClick?: () => void;
  chevron?: boolean;
  /** 64px em vez de 50 — para linhas com capa ou duas linhas de texto */
  alta?: boolean;
}) {
  const corpo = (
    <>
      {antes && <span className="shrink-0">{antes}</span>}
      <span className="flex min-w-0 flex-1 items-center gap-3 self-stretch border-b-[0.5px] border-separator py-2.5 pr-4 group-last/linha:border-b-0">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base text-label">{titulo}</span>
          {subtitulo && (
            <span className="mt-0.5 block truncate text-[0.88rem] text-label-2">{subtitulo}</span>
          )}
        </span>
        {depois && <span className="shrink-0 text-[0.88rem] text-label-2">{depois}</span>}
        {chevron && <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-label-3" strokeWidth={2.4} />}
      </span>
    </>
  );
  const classe = `group/linha flex w-full items-center gap-3 pl-4 text-left transition-colors active:bg-fill ${
    alta ? "min-h-16" : "min-h-[50px]"
  }`;
  if (href)
    return (
      <Link href={href} className={classe}>
        {corpo}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={`${classe} cursor-pointer`}>
        {corpo}
      </button>
    );
  return <div className={classe}>{corpo}</div>;
}
