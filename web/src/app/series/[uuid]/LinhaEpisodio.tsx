import type { MetaEpisode } from "@/lib/metadata";
import { porExtenso } from "@/lib/datas";
import Codigo from "@/components/mira/Codigo";

/**
 * Uma linha de episódio na lista agrupada (Mira, B·2a/2b). O círculo diz o
 * estado sem cor de enfeite:
 *  · o **próximo** — nome a negrito, anel de 2px em `label`;
 *  · **por marcar** (um buraco) — anel tracejado na cor «por marcar»;
 *  · **visto** — círculo cheio com ✓, e a linha toda a 55%;
 *  · os outros por ver — anel fino em `label-3`.
 * O círculo tem 44px de alvo; a linha inteira é o botão.
 */
export default function LinhaEpisodio({
  season,
  epNumber,
  metaEp,
  isSeen,
  isNext,
  isBuraco,
  isPulsing,
  onToggle,
}: {
  season: number;
  epNumber: number;
  metaEp: MetaEpisode | undefined;
  isSeen: boolean;
  isNext: boolean;
  isBuraco: boolean;
  isPulsing: boolean;
  onToggle: () => void;
}) {
  const circulo = isSeen
    ? "bg-label text-bg"
    : isNext
      ? "shadow-[inset_0_0_0_2px_var(--color-label)] text-transparent"
      : isBuraco
        ? "border-2 border-dashed border-por-marcar text-transparent"
        : "shadow-[inset_0_0_0_1.5px_var(--color-label-3)] text-transparent";
  return (
    <button
      type="button"
      onClick={onToggle}
      data-testid={`ep-${season}-${epNumber}`}
      aria-pressed={isSeen}
      className={`flex min-h-[54px] w-full cursor-pointer items-center gap-3 border-b-[0.5px] border-separator py-1.5 pr-1.5 pl-4 text-left transition-[opacity,background-color] duration-100 last:border-b-0 active:bg-fill ${
        isSeen ? "opacity-55" : ""
      }`}
    >
      <Codigo
        className={`w-[62px] shrink-0 text-[0.76rem] ${
          isNext ? "font-semibold text-label" : "font-medium text-label-2"
        }`}
      >
        E{String(epNumber).padStart(2, "0")}
      </Codigo>
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-base text-label ${isNext ? "font-semibold" : ""}`}
        >
          {metaEp?.name ?? `Episódio ${epNumber}`}
        </span>
        {metaEp?.airDate && (
          <Codigo className="block text-[0.7rem] text-label-2">{porExtenso(metaEp.airDate)}</Codigo>
        )}
      </span>
      <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center">
        <span
          className={`relative flex h-[26px] w-[26px] items-center justify-center rounded-full text-[0.8rem] font-bold transition-colors ${circulo} ${
            isPulsing ? "check-pop check-ring" : ""
          }`}
        >
          ✓
        </span>
      </span>
    </button>
  );
}
