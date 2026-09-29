import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Os botões da Mira.
 *
 * **Regra da ação** (README da Mira): uma só cápsula preenchida por ecrã —
 * branca à noite, preta de dia (`label` com texto `on-label`), e trocam
 * sozinhas com o tema. As escolhas e as ações secundárias usam `fill`, e o
 * que já está feito («✓ Na lista») usa só contorno. Nunca a cor da ação numa
 * escolha, nunca cor de estado num botão.
 */
type Tipo = "principal" | "secundaria" | "contorno";

const TIPOS: Record<Tipo, string> = {
  principal: "bg-label text-on-label",
  secundaria: "bg-fill-strong text-label",
  contorno: "bg-transparent text-label shadow-[inset_0_0_0_1.5px_var(--m-label-3)]",
};

export default function Acao({
  tipo = "principal",
  icone,
  children,
  className = "",
  grande = true,
  ...resto
}: {
  tipo?: Tipo;
  icone?: ReactNode;
  children: ReactNode;
  /** 52px (a ação de um ecrã) ou 44px (ações dentro de um grupo) */
  grande?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...resto}
      // `min-h` e não `h`: com o texto a 150% a cápsula cresce em vez de cortar
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-full px-5 font-semibold transition-[transform,opacity] duration-100 active:scale-[0.97] disabled:cursor-default disabled:opacity-40 ${
        grande ? "min-h-[52px] text-base" : "min-h-11 text-[0.88rem]"
      } ${TIPOS[tipo]} ${className}`}
    >
      {icone}
      {children}
    </button>
  );
}
