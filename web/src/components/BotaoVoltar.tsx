"use client";

import type { ReactNode } from "react";
import { useVoltar } from "@/lib/useVoltar";

/**
 * O mecanismo de "voltar", um só sítio — o desenho continua a ser de cada
 * ecrã (círculo com seta sobre um cartaz, pílula de texto num cabeçalho
 * simples), por isso `className`/`children` ficam livres. O que muda é só
 * a ação: nunca mais um `<Link href>` fixo, sempre `useVoltar()`.
 */
export default function BotaoVoltar({
  label,
  fallback,
  className,
  children,
}: {
  /** aria-label do botão — o que se lê a quem usa leitor de ecrã */
  label: string;
  /** para onde ir se não houver histórico nenhum para desfazer */
  fallback?: string;
  className: string;
  children: ReactNode;
}) {
  const voltar = useVoltar(fallback);
  return (
    <button type="button" onClick={voltar} aria-label={label} className={className}>
      {children}
    </button>
  );
}
