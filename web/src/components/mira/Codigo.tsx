import type { ReactNode } from "react";

/**
 * A letra da televisão: códigos de episódio (`S02·E07`), contagens (`6/10`)
 * e datas — **e mais nada**. É um dos portadores da assinatura: atravessa
 * todos os ecrãs e diz «isto é uma app de TV» sem uma cor.
 *
 * Nunca para nomes (de séries, de episódios, de pessoas): em mono, um nome lê-
 * -se como máquina de escrever (crítica da Fase 3, no aviso de anular).
 * Tabular, para os números não mexerem a largura quando mudam.
 */
export default function Codigo({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={`ep-code ${className}`}>{children}</span>;
}
