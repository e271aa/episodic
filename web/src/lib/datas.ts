/**
 * Um só sítio para escrever datas em pt-PT.
 *
 * A Fase 4 da Ronda 12 (AUDITORIA.md) mediu cinco formatos diferentes pela
 * app — dois deles eram datas ISO cruas ("2024-06-26") deixadas por
 * formatar. Os outros três servem contextos genuinamente diferentes (uma
 * data próxima, uma legenda compacta, um registo por extenso) e ficam; o
 * que sai daqui é o `new Date(...).toLocaleDateString("pt-PT", …)` que
 * estava repetido, à mão, em cada ficheiro.
 */

/** "24 de janeiro de 2024" — para um registo completo. */
export function porExtenso(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-PT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** "15 out" — para uma legenda compacta, junto a outros números. */
export function curta(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-PT", { day: "numeric", month: "short" });
}

/** "quinta-feira, 15 de outubro" — quando o dia da semana é o que interessa. */
export function comDiaDaSemana(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** "janeiro de 2024" — para agrupar por mês (o gráfico das Estatísticas). */
export function porMes(anoMes: string): string {
  const [ano, mes] = anoMes.split("-").map(Number);
  return new Date(ano, mes - 1, 1).toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
}
