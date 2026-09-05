"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Sem histórico da app para desfazer (link direto, PWA aberta de raiz nesta
 * página), sobe-se um nível na rota em vez de ficar preso ou de cair sempre
 * na página inicial.
 */
export function parentOf(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  return parts.length > 1 ? `/${parts.slice(0, -1).join("/")}` : "/series";
}

/**
 * Quantas entradas o histórico já tinha quando a app abriu. Só há para onde
 * recuar **dentro da app** se ele tiver crescido desde então.
 *
 * `window.history.length > 1` — o que o gesto usava antes, e que eu ia
 * herdando — não serve: um separador acabado de abrir já vem com 2 (a
 * página em branco de onde veio conta), e medido, o "voltar" de uma página
 * aberta por link direto atirava para **fora** da app.
 */
let pisoDoHistorico: number | null = null;

/** Chamado uma vez, no arranque da app (ver `BackGesture`). */
export function marcarPisoDoHistorico(): void {
  if (pisoDoHistorico === null) pisoDoHistorico = window.history.length;
}

function haParaOndeRecuar(): boolean {
  return pisoDoHistorico !== null && window.history.length > pisoDoHistorico;
}

/**
 * O único sítio da app que decide o que "recuar" quer dizer.
 *
 * Antes disto, cada botão de voltar era um `<Link href>` fixo para um
 * destino escrito à mão — o que parecia "voltar" era sempre "ir para aqui",
 * e cada toque empurrava uma entrada NOVA para o histórico em vez de
 * desfazer a última. Dois efeitos, os dois medidos: a ordenação e a posição
 * do scroll de onde vieste perdiam-se sempre (o Next só as restaura sobre um
 * recuo a sério, nunca sobre uma navegação nova para a frente), e o gesto de
 * recuar do telemóvel passava a reabrir a página que acabaste de fechar, em
 * vez de continuar para trás.
 *
 * `router.back()` desfaz a navegação de verdade quando há alguma para
 * desfazer; `fallback` (ou `parentOf` da rota atual) só entra quando não há
 * mesmo nada — o caso de abrir a página direto por um link.
 */
export function useVoltar(fallback?: string): () => void {
  const router = useRouter();
  const pathname = usePathname();

  return useCallback(() => {
    if (haParaOndeRecuar()) router.back();
    else router.push(fallback ?? parentOf(pathname));
  }, [router, pathname, fallback]);
}
