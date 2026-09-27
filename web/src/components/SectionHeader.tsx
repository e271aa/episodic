import type { ReactNode } from "react";

/**
 * A cor que marca uma secção. Uma das SMPTE, escolhida de forma estável a
 * partir do título — a mesma secção fica sempre com a mesma cor, entre
 * sessões e entre ecrãs.
 *
 * Só as 4 barras neutras (cinza, amarelo, vermelho, azul): verde, ciano e
 * magenta já têm significado próprio (em dia, buracos, terminada) e um
 * cabeçalho sorteado entre as sete contradizia a Bars Rule — medido na
 * Fase 4 da Ronda 12 (AUDITORIA.md), decidido pelo Ruben a 27-09.
 */
const BAR_COLORS = ["#c8c8c8", "#e6c832", "#e6483c", "#3c46e6"];

export function sectionColor(seed: string): string {
  let n = 0;
  for (let i = 0; i < seed.length; i++) n = (n + seed.charCodeAt(i)) % BAR_COLORS.length;
  return BAR_COLORS[n];
}

/**
 * O cabeçalho de secção, um só desenho em toda a app.
 *
 * Antes cada ecrã tinha a sua variação — tamanhos e espaçamentos ligeiramente
 * diferentes para a mesma ideia. E no Explorar o `reason` partilhava a linha
 * sem largura reservada, o que empurrava rótulos longos para quatro linhas.
 * Aqui o rótulo trunca e o motivo tem `shrink-0`: quem cede é o rótulo, que é
 * o que se pode adivinhar.
 */
export default function SectionHeader({
  label,
  meta,
  color,
  className = "",
}: {
  label: string;
  /** contagem ou motivo — à direita, em mono */
  meta?: ReactNode;
  /** cor da barra; por omissão sai do próprio rótulo */
  color?: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span
        aria-hidden
        className="h-[14px] w-[3px] shrink-0 rounded-full"
        style={{ background: color ?? sectionColor(label) }}
      />
      <h2 className="truncate font-display text-xs font-semibold uppercase tracking-[0.15em] text-dim [font-stretch:80%]">
        {label}
      </h2>
      {meta != null && (
        <span className="ep-code ml-auto shrink-0 text-[0.8125rem] text-faint">{meta}</span>
      )}
    </div>
  );
}
