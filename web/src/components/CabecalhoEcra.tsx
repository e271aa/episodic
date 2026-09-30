import type { ReactNode } from "react";
import BotaoVoltar from "@/components/BotaoVoltar";
import { ChevronLeft } from "lucide-react";

/**
 * O cabeçalho de um ecrã que se abre a partir de outro: o círculo de recuar
 * à esquerda, o título ao lado.
 *
 * Havia quatro formas de recuar (Ronda 12, Fase 4, achado #10) — três delas
 * um texto no canto superior direito ("Perfil", "A seguir", "← Listas"),
 * longe do polegar e diferente de ecrã para ecrã. O DESIGN.md já dizia qual
 * era: um círculo de 44px com seta. O nome lê-se pelo `aria-label`.
 *
 * O círculo e o ‹ são os mesmos da série e do filme, sem o vidro (aqui não
 * há arte por baixo): `RECUAR` e `IconeRecuar` servem os ecrãs que não usam
 * este cabeçalho (Pôr em dia, Entrar). Até à Fase 12 havia três formas.
 *
 * `titulo` aceita um nó para o caso das listas, em que o título é um botão
 * de renomear (ou o próprio campo, a meio de renomear).
 */
export const RECUAR =
  "flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-fill text-label transition-transform duration-100 active:scale-[0.97]";

export function IconeRecuar() {
  return <ChevronLeft aria-hidden className="h-5 w-5" strokeWidth={2.4} />;
}

export default function CabecalhoEcra({
  titulo,
  voltar,
  fallback,
}: {
  titulo: ReactNode;
  /** o que o leitor de ecrã diz, ex. "Voltar ao perfil" */
  voltar: string;
  /** para onde ir se não houver histórico nenhum para desfazer */
  fallback: string;
}) {
  return (
    <div className="flex min-h-11 items-center gap-3">
      <BotaoVoltar
        label={voltar}
        fallback={fallback}
        className={RECUAR}
      >
        <IconeRecuar />
      </BotaoVoltar>
      {typeof titulo === "string" ? (
        <h1 className="min-w-0 text-[1.65rem] leading-[1.1] font-bold text-label">{titulo}</h1>
      ) : (
        titulo
      )}
    </div>
  );
}
