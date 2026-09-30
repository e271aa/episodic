import { plural } from "@/lib/graficos";

/** «2 781», com espaço fixo — o pt-PT do browser só agrupa a partir de cinco algarismos. */
export function milhares(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** «115 dias e 21 horas» — o tempo de antena por extenso, a partir das horas. */
export function diasEHoras(horas: number): string {
  const total = Math.floor(horas);
  const dias = Math.floor(total / 24);
  const resto = total % 24;
  return `${dias} ${plural(dias, "dia", "dias")} e ${resto} ${plural(resto, "hora", "horas")}`;
}
