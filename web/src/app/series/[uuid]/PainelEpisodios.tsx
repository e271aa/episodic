import { Fragment } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { episodeKey } from "@/lib/db";
import { curta } from "@/lib/datas";
import Codigo from "@/components/mira/Codigo";
import LinhaEpisodio from "./LinhaEpisodio";
import type { SeasonView } from "./serie";
import type { Serie } from "./useSerie";

const ep = (n: number) => `E${String(n).padStart(2, "0")}`;

/**
 * As temporadas e a lista de episódios da escolhida (Mira, B·2a e B·E5).
 *
 * Até cinco temporadas, um controlo segmentado: dividem o espaço e lê-se o
 * estado de todas de uma vez. Mais do que isso (Grey's Anatomy, animes
 * longos), uma faixa de pastilhas de 68px que rola de lado, abre centrada na
 * temporada em curso e desvanece nas pontas — cinco a espremer-se até à
 * ilegibilidade não é «ver tudo de uma vez», é o oposto.
 */
export default function PainelEpisodios({
  uuid,
  serie,
}: {
  uuid: string;
  serie: Serie;
}) {
  const {
    watched,
    seasons,
    openSeason,
    episodesBySeason,
    corridasAbertas,
    providerMissing,
    nextUp,
    pulseEp,
    sweepSeason,
    chipAberto,
    escolherTemporada,
    toggleCorrida,
    toggleEpisode,
    openSeasonView,
    blocosEpisodios,
    markSeasonAll,
    buracos,
    seasonWatchedCount,
    temporadasComBuraco,
  } = serie;
  const faixa = seasons.length > 5;

  const pastilha = (season: SeasonView) => {
    const seen = seasonWatchedCount.get(season.number) ?? 0;
    const selected = openSeason === season.number;
    // `29/51` servia para "faltam 22 no fim" e para "faltam 22 no meio" — e
    // são coisas diferentes. O ponto «por marcar» diz qual é.
    const temBuraco = temporadasComBuraco.has(season.number);
    const contagem = season.episodeCount === 0 ? "breve" : `${seen}/${season.episodeCount}`;
    const ponto = temBuraco && (
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-por-marcar" />
    );
    const comum = {
      onClick: () => void escolherTemporada(season),
      "data-testid": `season-${season.number}`,
      "aria-pressed": selected,
      "aria-label":
        season.episodeCount === 0
          ? `Temporada ${season.number}, ainda não estreou`
          : `Temporada ${season.number}, ${seen} de ${season.episodeCount} vistos` +
            (temBuraco ? ", com episódios por marcar mais atrás" : ""),
      ref: (el: HTMLButtonElement | null) => {
        if (selected) chipAberto.current = el;
      },
    };
    const varrer = sweepSeason === season.number ? "season-sweep" : "";

    if (!faixa) {
      return (
        <button
          key={season.number}
          type="button"
          {...comum}
          className={`flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[19px] px-1.5 text-[0.88rem] transition-[background-color,box-shadow] duration-200 ${
            selected
              ? "bg-segment font-semibold text-label shadow-[var(--m-seg-sombra)]"
              : "font-medium text-label-2"
          } ${varrer}`}
        >
          <span>T{season.number}</span>
          <Codigo className="text-[0.7rem] font-medium">{contagem}</Codigo>
          {ponto}
        </button>
      );
    }

    // A largura da barra diz o progresso da temporada, sempre em `label`: a
    // cor de estado é da série (no cabeçalho), não de cada temporada.
    const largura =
      season.episodeCount > 0 ? Math.min(100, (seen / season.episodeCount) * 100) : 0;
    return (
      <button
        key={season.number}
        type="button"
        {...comum}
        className={`relative flex h-[60px] w-[68px] shrink-0 cursor-pointer snap-center flex-col justify-between overflow-hidden rounded-2xl px-[11px] py-[9px] text-left transition-[background-color,transform] duration-100 active:scale-[0.97] ${
          selected ? "bg-chip" : "bg-group"
        } ${varrer}`}
      >
        <span className="flex items-center justify-between">
          <span className={`text-[0.88rem] text-label ${selected ? "font-bold" : "font-semibold"}`}>
            T{season.number}
          </span>
          {ponto}
        </span>
        <Codigo className={`text-[0.65rem] font-medium ${selected ? "text-label" : "text-label-2"}`}>
          {contagem}
        </Codigo>
        <span aria-hidden className="block h-[3px] overflow-hidden rounded-sm bg-track">
          <span
            className="block h-full bg-label transition-[width] duration-[320ms] ease-out"
            style={{ width: `${largura}%` }}
          />
        </span>
      </button>
    );
  };

  const season = openSeasonView;
  const seen = season ? (seasonWatchedCount.get(season.number) ?? 0) : 0;
  const complete = season ? season.episodeCount > 0 && seen >= season.episodeCount : false;
  const episodes = season ? episodesBySeason.get(season.number) : undefined;
  const buracosDaTemporada = new Set(
    buracos.porTemporada.find((t) => t.temporada === season?.number)?.episodios ?? [],
  );

  const linha = (epNumber: number) => {
    if (!season) return null;
    const key = episodeKey(uuid, season.number, epNumber);
    return (
      <LinhaEpisodio
        key={epNumber}
        season={season.number}
        epNumber={epNumber}
        metaEp={episodes?.find((e) => e.episode === epNumber)}
        isSeen={watched.has(key)}
        isNext={nextUp?.season === season.number && nextUp.episode === epNumber}
        isBuraco={buracosDaTemporada.has(epNumber)}
        isPulsing={pulseEp === key}
        onToggle={() => void toggleEpisode(season.number, epNumber)}
      />
    );
  };

  return (
    <section className="mt-5 flex flex-col gap-3" aria-label="Episódios" data-testid="temporadas">
      {providerMissing && (
        <p className="rounded-[18px] bg-group p-3 text-[0.76rem] text-label-2">
          Não foi possível obter a lista completa de episódios (série não mapeada ou sem ligação)
          — mostramos só as temporadas com episódios vistos.
        </p>
      )}

      {seasons.length === 0 ? (
        <p className="px-1 text-[0.88rem] text-label-2">Sem informação de temporadas.</p>
      ) : (
        <>
          {faixa ? (
            <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 [mask-image:linear-gradient(90deg,transparent_0,#000_16px,#000_calc(100%-16px),transparent)] [scrollbar-width:none]">
              {seasons.map(pastilha)}
            </div>
          ) : (
            <div className="flex min-h-11 rounded-[22px] bg-fill p-[3px]">{seasons.map(pastilha)}</div>
          )}

          {season && (
            <div>
              {/* Fixo ao rolar: à 3ª linha já se tinha perdido de vista em
                  que temporada se estava, numa lista que pode ter dezenas de
                  linhas. Rente ao topo, por baixo da barra de estado. */}
              <div className="sticky top-0 z-10 -mx-4 flex min-h-11 items-center justify-between gap-3 bg-bg px-5 pt-[max(0px,env(safe-area-inset-top))]">
                <p className="truncate text-[0.76rem] font-semibold tracking-[0.02em] text-label-2 uppercase">
                  {season.name}
                </p>
                {!complete && season.episodeCount > 0 && (
                  <button
                    type="button"
                    onClick={() => void markSeasonAll(season)}
                    className="min-h-11 shrink-0 cursor-pointer text-[0.88rem] font-semibold text-label transition-opacity active:opacity-60"
                  >
                    Marcar temporada como vista
                  </button>
                )}
              </div>

              <div className="overflow-hidden rounded-[26px] bg-group">
                {blocosEpisodios.map((bloco) => {
                  if (bloco.tipo === "unico") return linha(bloco.episodio);

                  const chave = `${season.number}-${bloco.inicio}-${bloco.fim}`;
                  const contagem = bloco.fim - bloco.inicio + 1;
                  const codigo = `${ep(bloco.inicio)}–${ep(bloco.fim)}`;
                  const numeros = Array.from({ length: contagem }, (_, i) => bloco.inicio + i);

                  if (corridasAbertas.has(chave)) {
                    return (
                      <Fragment key={chave}>
                        <button
                          type="button"
                          onClick={() => toggleCorrida(chave)}
                          className="flex min-h-11 w-full cursor-pointer items-center gap-2 border-b-[0.5px] border-separator px-4 text-left text-[0.76rem] font-semibold text-label-2 active:bg-fill"
                        >
                          <ChevronUp aria-hidden className="h-3.5 w-3.5" strokeWidth={2.6} />
                          Fechar <Codigo>{codigo}</Codigo>
                        </button>
                        {numeros.map(linha)}
                      </Fragment>
                    );
                  }

                  return (
                    <button
                      key={chave}
                      type="button"
                      onClick={() => toggleCorrida(chave)}
                      data-testid={`corrida-${chave}`}
                      aria-label={`${codigo}, ${contagem} episódios vistos — abrir`}
                      className="flex min-h-[50px] w-full cursor-pointer items-center gap-3 border-b-[0.5px] border-separator pr-4 pl-4 text-left last:border-b-0 active:bg-fill"
                    >
                      <Codigo className="w-[62px] shrink-0 text-[0.76rem] font-medium text-label-2">
                        {codigo}
                      </Codigo>
                      <span className="flex-1 text-[0.88rem] text-label-2">{contagem} vistos</span>
                      <ChevronDown aria-hidden className="h-4 w-4 shrink-0 text-label-3" strokeWidth={2.6} />
                    </button>
                  );
                })}
                {/* Anunciados: mostram-se, com a data, mas não se marcam nem
                    contam — ninguém viu um episódio que ainda não estreou. */}
                {Array.from({ length: season.anunciados }, (_, i) => season.episodeCount + i + 1).map(
                  (epNumber) => {
                    const metaEp = episodes?.find((e) => e.episode === epNumber);
                    return (
                      <div
                        key={epNumber}
                        data-testid={`anunciado-${season.number}-${epNumber}`}
                        className="flex min-h-[54px] items-center gap-3 border-b-[0.5px] border-separator py-1.5 pr-1.5 pl-4 last:border-b-0"
                      >
                        <Codigo className="w-[62px] shrink-0 text-[0.76rem] font-medium text-label-2">
                          {ep(epNumber)}
                        </Codigo>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-base text-label-2">
                            {metaEp?.name ?? `Episódio ${epNumber}`}
                          </span>
                          <Codigo className="block text-[0.7rem] text-label-2">
                            {metaEp?.airDate ? `estreia a ${curta(metaEp.airDate)}` : "por estrear"}
                          </Codigo>
                        </span>
                        <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center">
                          <span className="h-[26px] w-[26px] rounded-full border-[1.5px] border-dashed border-label-3" />
                        </span>
                      </div>
                    );
                  },
                )}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
