import Poster from "@/components/Poster";
import BotaoVoltar from "@/components/BotaoVoltar";
import { ArrowLeftIcon } from "@/components/icons";
import { translateGenre } from "@/lib/stats";
import type { StoredShow } from "@/lib/db";
import { stateLabel } from "./serie";
import type { Serie } from "./useSerie";

/** O herói do detalhe: a arte, o estado, o título e os metadados. */
export default function CabecalhoSerie({
  show,
  serie,
  showComplete,
  accent,
}: {
  show: StoredShow;
  serie: Serie;
  showComplete: boolean;
  accent: string;
}) {
  const { watchedCount, buracos, backdropPath, percent } = serie;
  const year = show.firstAired?.slice(0, 4);
  const genreBits = show.genres
    ?.slice(0, 2)
    .map(translateGenre)
    .join(" · ")
    .toUpperCase();
  const remaining = show.totalEpisodes != null ? show.totalEpisodes - watchedCount : 0;
  /**
   * "22 por ver" era a mesma frase para duas coisas diferentes: episódios que
   * faltam mesmo ver, e episódios que já foram vistos e ficaram por marcar.
   * Quem tem 22 buracos atrás não tem 22 por ver — tem 22 por arrumar.
   */
  const porVerAFrente = Math.max(0, remaining - buracos.total);
  const label =
    buracos.total > 0
      ? porVerAFrente > 0
        ? `${porVerAFrente} por ver · ${buracos.total} por marcar`
        : `${buracos.total} por marcar`
      : stateLabel(showComplete, remaining, show.status);
  const metaLine = [
    year,
    genreBits,
    show.totalEpisodes != null
      ? `${watchedCount}/${show.totalEpisodes} EP`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      {/* O backdrop É a identidade — sem cartaz sobreposto. O título vive no
          terço de baixo, por cima do gradiente, tal como no herói do "A
          seguir": a arte respira em cima, o texto lê-se em baixo. */}
      {/* Sem `-mx-4`: o `<main>` acima não tem padding horizontal, por isso a
          margem negativa não tinha nada para cancelar — esticava o herói 16px
          para fora e a página inteira rolava de lado. Medido: documento a
          406px num ecrã de 390. Os blocos a seguir trazem o seu próprio
          `px-4`; este é de bordo a bordo por natureza. */}
      {/* A altura era 420px fixos, e num ecrã de 664px isso é 63% de arte
          antes de uma única informação — medido. `min(52vh, 420px)` mantém
          os 420 nos telemóveis grandes e encolhe nos pequenos, que é onde
          o problema existia. */}
      <div className="relative h-[min(52vh,420px)] overflow-hidden bg-panel">
        {backdropPath ? (
          <Poster
            path={backdropPath}
            alt=""
            size="w780"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-raised to-panel" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-tube via-tube/75 via-45% to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-tube/70 to-transparent" />
        {/* Barra de estado e de progresso, na fronteira entre a arte e o
            conteúdo. Estava no topo, encostada ao entalhe e por cima da
            parte mais clara do backdrop, onde não se via; e dizia só "como
            está esta série" (a cor), nunca "onde vou nela". Agora a cor
            continua a dizer o estado e o **preenchimento** diz o progresso:
            198/220 lia-se em texto mono de 13px e mais nada. */}
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-line">
          <div
            className="h-full transition-[width] duration-[320ms] ease-out"
            style={{ width: `${percent ?? 0}%`, background: accent }}
            data-testid="heroi-progresso"
          />
        </div>

        <BotaoVoltar
          label="Voltar às séries"
          fallback="/series"
          className="absolute left-4 top-4 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-tube/60 text-ink backdrop-blur transition active:scale-90"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </BotaoVoltar>

        <div className="absolute inset-x-4 bottom-5">
          <div className="flex items-center gap-2.5">
            {/* Com buracos para trás, o traço é o ciano dos buracos — o
                rótulo diz "por marcar", e a cor tem de dizer o mesmo. */}
            <span
              aria-hidden
              data-testid="heroi-traco"
              className="h-[14px] w-[3px] shrink-0 rounded-full"
              style={{ background: buracos.total > 0 ? "var(--color-smpte-cyan)" : accent }}
            />
            <p className="ep-code text-[0.8125rem] text-dim">{label}</p>
          </div>
          <h1 className="mt-1.5 font-display text-[2.25rem] font-bold leading-[1] text-ink [font-stretch:110%]">
            {show.name}
          </h1>
          {metaLine && <p className="ep-code mt-2 text-sm text-dim">{metaLine}</p>}
        </div>
      </div>
    </>
  );
}
