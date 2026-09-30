import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Os widgets do Perfil (B·5): blocos pequenos de raio 22, cada um com uma só
 * coisa a dizer — de tamanhos diferentes, não cartões iguais. `Contador` é um
 * número em SF Rounded com o nome por baixo; `Destaque` é o nome por cima e o
 * valor (texto) por baixo. Com `href` o widget inteiro é uma ligação.
 */
const CAIXA =
  "flex min-w-0 flex-col justify-between gap-1 rounded-[22px] bg-group px-3.5 py-3.5 transition-transform duration-100 ease-out";

function Caixa({ href, children }: { href?: string; children: ReactNode }) {
  if (href)
    return (
      <Link href={href} className={`${CAIXA} active:scale-[0.98]`}>
        {children}
      </Link>
    );
  return <div className={CAIXA}>{children}</div>;
}

export function Contador({
  valor,
  rotulo,
  sub,
  href,
}: {
  valor: string;
  rotulo: string;
  /** uma segunda linha discreta («3 seguidas») */
  sub?: string;
  href?: string;
}) {
  return (
    <Caixa href={href}>
      <span className="font-rounded text-[1.4rem] font-bold leading-tight tabular-nums text-label">{valor}</span>{" "}
      <span className="block">
        <span className="block text-[0.76rem] leading-snug text-label-2">{rotulo}</span>
        {sub && <span className="block text-[0.76rem] leading-snug text-label-2">{sub}</span>}
      </span>
    </Caixa>
  );
}

export function Destaque({ rotulo, valor, href }: { rotulo: string; valor: string; href?: string }) {
  return (
    <Caixa href={href}>
      <span className="block text-[0.76rem] leading-snug text-label-2">{rotulo}</span>
      <span className="line-clamp-2 text-base font-semibold leading-snug text-label">{valor}</span>
    </Caixa>
  );
}

/**
 * Um recorde (Estatísticas): o nome por cima, o número em SF Rounded, a unidade
 * e o detalhe (uma data, uma série) por baixo — o detalhe pode ocupar várias
 * linhas, ao contrário dos outros widgets.
 */
export function Recorde({
  rotulo,
  valor,
  unidade,
  detalhe,
}: {
  rotulo: string;
  valor: string;
  unidade: string;
  detalhe?: ReactNode;
}) {
  return (
    <div className={`${CAIXA} justify-start gap-0.5`}>
      <span className="block text-[0.76rem] leading-snug text-label-2">{rotulo}</span>{" "}
      <span className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
        <span className="font-rounded text-[1.65rem] font-bold leading-tight tabular-nums text-label">{valor}</span>{" "}
        <span className="text-[0.88rem] text-label-2">{unidade}</span>
      </span>
      {detalhe && (
        <>
          {" "}
          <span className="mt-1 block text-[0.76rem] leading-snug text-label-2">{detalhe}</span>
        </>
      )}
    </div>
  );
}
