export interface SeasonView {
  /** posição na lista (1, 2, 3…) — a numeração que o TV Time assume e que
   * guardamos localmente; nunca o número literal do fornecedor (ver nota em
   * watchnext.ts sobre animes longos indexados por ano de emissão) */
  number: number;
  /** número real a pedir ao fornecedor (TMDB/TVmaze) — só para buscar dados */
  providerNumber: number;
  name: string;
  /**
   * Os que já estrearam. Contava os anunciados também, e uma série em dia
   * passava a "10 por ver" no dia em que a temporada seguinte era anunciada.
   * Tudo neste ecrã que diz "completa", "por ver" ou "marcar temporada" lê
   * daqui (Ronda 12).
   */
  episodeCount: number;
  /** anunciados, ainda por estrear — mostram-se, não se contam */
  anunciados: number;
  fromProvider: boolean;
}

export const STATUS_PT: Record<string, string> = {
  Running: "Em emissão",
  Ended: "Terminada",
  Canceled: "Cancelada",
  Cancelled: "Cancelada",
  "In Development": "Em desenvolvimento",
  "To Be Determined": "Por determinar",
  "Returning Series": "Em emissão",
};

const ENDED_STATUSES = new Set(["Ended", "Canceled", "Cancelled"]);

// Mesma semântica de cor das capas: verde = em dia e ainda vem mais,
// roxo = em dia mas terminou, branco = a meio.
export function stateColor(complete: boolean, status: string | null | undefined): string {
  if (!complete) return "var(--color-ink)";
  return ENDED_STATUSES.has(status ?? "") ? "var(--color-smpte-magenta)" : "var(--color-smpte-green)";
}

/** O rótulo que acompanha a barra de cor no cabeçalho — diz em palavras o
 *  que a cor já diz em cor, para quem não distingue as duas ao relance. */
export function stateLabel(
  complete: boolean,
  remaining: number,
  status: string | null | undefined,
): string {
  if (!complete) return `${remaining} por ver`;
  return ENDED_STATUSES.has(status ?? "") ? "Em dia · terminada" : "Em dia";
}
