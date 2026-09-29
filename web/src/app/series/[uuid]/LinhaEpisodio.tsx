import type { MetaEpisode } from "@/lib/metadata";
import { porExtenso } from "@/lib/datas";

/**
 * Uma linha de episódio, repetida em dois sítios: sozinha na lista, e dentro
 * de uma corrida aberta. Visto e por ver distinguem-se sem depender só do
 * círculo de 26px — a linha toda de um episódio visto fica mais apagada, a
 * de um por ver fica a negrito. Antes as duas liam-se igual a um metro de
 * distância, numa lista de 51 linhas quase idênticas.
 */
export default function LinhaEpisodio({
  season,
  epNumber,
  metaEp,
  isSeen,
  isPulsing,
  accent,
  onToggle,
}: {
  season: number;
  epNumber: number;
  metaEp: MetaEpisode | undefined;
  isSeen: boolean;
  isPulsing: boolean;
  accent: string;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      data-testid={`ep-${season}-${epNumber}`}
      className={`flex h-[52px] w-full cursor-pointer items-center gap-3 rounded-lg px-2 text-left transition-colors hover:bg-raised ${
        isSeen ? "opacity-60" : ""
      }`}
    >
      <span className="ep-code w-[34px] shrink-0 text-[0.8125rem] text-faint">
        E{String(epNumber).padStart(2, "0")}
      </span>
      <span
        aria-hidden
        className={`relative flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
          isPulsing ? "check-pop check-ring" : ""
        }`}
        style={
          isSeen
            ? { borderColor: accent, background: accent, color: "var(--color-tube)" }
            : { borderColor: "var(--color-line)", color: "transparent" }
        }
      >
        ✓
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-base ${isSeen ? "text-dim" : "font-medium text-ink"}`}
        >
          {metaEp?.name ?? `Episódio ${epNumber}`}
        </span>
        {metaEp?.airDate && (
          <span className="ep-code block text-xs text-faint">{porExtenso(metaEp.airDate)}</span>
        )}
      </span>
    </button>
  );
}
