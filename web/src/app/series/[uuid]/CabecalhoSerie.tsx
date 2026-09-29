import { ChevronLeft, Ellipsis } from "lucide-react";
import Poster from "@/components/Poster";
import BotaoVoltar from "@/components/BotaoVoltar";
import Codigo from "@/components/mira/Codigo";
import { translateGenre } from "@/lib/stats";
import type { StoredShow } from "@/lib/db";
import { stateLabel } from "./serie";
import type { Serie } from "./useSerie";

const CIRCULO =
  "vidro flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-label transition-transform duration-100 active:scale-[0.97]";

/**
 * O herói do detalhe (Mira, B·2a): a arte de ponta a ponta com o degradê
 * para o fundo, os dois círculos de vidro por cima (recuar e «···») e, já
 * no fim do degradê, o título grande e uma linha de metadados.
 *
 * Nada de texto pequeno sobre a arte: o título começa onde o degradê já é
 * fundo, e a linha de estado vive por baixo dele.
 */
export default function CabecalhoSerie({
  show,
  serie,
  showComplete,
  accent,
  onMenu,
}: {
  show: StoredShow;
  serie: Serie;
  showComplete: boolean;
  accent: string;
  onMenu: () => void;
}) {
  const { watchedCount, buracos, backdropPath, seasons } = serie;
  const year = show.firstAired?.slice(0, 4);
  const genero = show.genres?.[0] ? translateGenre(show.genres[0]) : null;
  const remaining = show.totalEpisodes != null ? show.totalEpisodes - watchedCount : 0;
  // Com mais de cinco temporadas a faixa não as mostra todas: diz-se aqui quantas são (B·E5).
  const temporadas = seasons.length > 5 ? `${seasons.length} temporadas` : null;
  const metaLine = [year, genero, temporadas].filter(Boolean).join(" · ");

  return (
    <div className="relative">
      {/* 290px num iPhone; num ecrã baixo, nunca mais de 40% dele — a arte
          não pode empurrar o próximo episódio para fora de vista. */}
      <div className="relative h-[min(290px,40vh)] overflow-hidden bg-group">
        {backdropPath && (
          <Poster
            path={backdropPath}
            alt=""
            size="w780"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        )}
        {/* Escuro em cima nos dois modos (a barra de estado lê-se por cima
            da arte), e no fim o próprio fundo — noite ou claro. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(0,0,0,.45) 0, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 55%, var(--color-bg) 100%)",
          }}
        />
      </div>

      <div className="absolute inset-x-4 top-[max(12px,env(safe-area-inset-top))] flex justify-between">
        <BotaoVoltar label="Voltar às séries" fallback="/series" className={CIRCULO}>
          <ChevronLeft aria-hidden className="h-5 w-5" strokeWidth={2.4} />
        </BotaoVoltar>
        <button
          type="button"
          onClick={onMenu}
          aria-label="Mais opções"
          aria-haspopup="dialog"
          data-testid="menu-serie"
          className={CIRCULO}
        >
          <Ellipsis aria-hidden className="h-5 w-5" strokeWidth={2.4} />
        </button>
      </div>

      <div className="relative -mt-14 flex flex-col gap-1 px-5">
        <h1 className="line-clamp-3 text-[2rem] leading-[1.1] font-bold text-label">{show.name}</h1>
        {/* Texto corrido, para partir como texto: com buracos, o estado
            toma o lugar da contagem (B·2b) — o ponto e o texto no «por
            marcar», a única cor de estado que também é texto (Regra da
            mira); a meio, só a contagem, que já é o estado (B·2a); em dia,
            a contagem e o ponto. */}
        <p className="text-[0.88rem] text-label-2">
          {metaLine}
          {buracos.total > 0 ? (
            <span className="whitespace-nowrap" data-testid="estado-serie">
              {metaLine && " · "}
              <span
                aria-hidden
                data-testid="heroi-traco"
                className="mr-1.5 inline-block h-2 w-2 rounded-full bg-por-marcar align-[0.05em]"
              />
              <span className="text-por-marcar-texto">{buracos.total} por marcar</span>
            </span>
          ) : (
            <>
              {show.totalEpisodes != null && (
                <span className="whitespace-nowrap">
                  {metaLine && " · "}
                  <Codigo className="text-[0.76rem]">
                    {watchedCount}/{show.totalEpisodes}
                  </Codigo>{" "}
                  vistos
                </span>
              )}
              {showComplete && (
                <span className="whitespace-nowrap" data-testid="estado-serie">
                  {" · "}
                  <span
                    aria-hidden
                    data-testid="heroi-traco"
                    className="mr-1.5 inline-block h-2 w-2 rounded-full align-[0.05em]"
                    style={{ background: accent }}
                  />
                  <span>{stateLabel(showComplete, remaining, show.status)}</span>
                </span>
              )}
            </>
          )}
        </p>
      </div>
    </div>
  );
}
