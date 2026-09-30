import Link from "next/link";
import type { ReactNode } from "react";

/**
 * O painel de linhas — a forma que o Perfil já usava para as estatísticas
 * (Fase V) e que passa a valer para tudo o que é definição e manutenção.
 *
 * A regra por trás: **um cartão por assunto, não um cartão por controlo**.
 * O Perfil tinha seis caixas com borda própria a competir entre si (conta,
 * import, verificação, apagar…), o que dava ao "Apagar dados locais" o
 * mesmo peso visual que ao "Tempo de antena". Aqui cada assunto é um
 * painel e cada controlo é uma linha lá dentro, separada por um traço —
 * peso igual entre pares, nunca contra o herói.
 */
export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`divide-y-[0.5px] divide-separator overflow-hidden rounded-[26px] bg-group ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Uma linha do painel. Vira `<a>`, `<button>` ou `<div>` conforme lhe deres
 * `href`, `onClick`, ou nenhum dos dois — o mesmo desenho nos três casos,
 * para uma linha que faz alguma coisa não se distinguir de uma que só
 * informa por acidente de marcação.
 */
export function PanelRow({
  titulo,
  detalhe,
  fim,
  href,
  onClick,
  perigo = false,
}: {
  titulo: ReactNode;
  detalhe?: ReactNode;
  /** o que fica à direita: uma seta, um valor, um botão */
  fim?: ReactNode;
  href?: string;
  onClick?: () => void;
  /** destrutivo: fica vermelho o **rótulo**, não a caixa toda — o vermelho
   *  é o único acento de perigo da app e não pode estar sempre aceso */
  perigo?: boolean;
}) {
  const interativa = href !== undefined || onClick !== undefined;
  const classe = `flex min-h-[60px] w-full items-center gap-4 px-5 py-3.5 text-left transition-colors ${
    interativa ? "cursor-pointer active:bg-fill" : ""
  }`;

  const conteudo = (
    <>
      <span className="min-w-0 flex-1">
        <span
          className={`block font-display text-[0.9375rem] font-semibold ${
            perigo ? "text-danger" : "text-ink"
          }`}
        >
          {titulo}
        </span>
        {detalhe != null && (
          <span className="mt-0.5 block text-xs text-dim">{detalhe}</span>
        )}
      </span>
      {fim != null && <span className="shrink-0 text-faint">{fim}</span>}
    </>
  );

  if (href !== undefined) {
    return (
      <Link href={href} className={classe}>
        {conteudo}
      </Link>
    );
  }
  if (onClick !== undefined) {
    return (
      <button type="button" onClick={onClick} className={classe}>
        {conteudo}
      </button>
    );
  }
  return <div className={classe}>{conteudo}</div>;
}
