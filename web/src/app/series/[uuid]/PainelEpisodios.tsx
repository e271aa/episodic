import { episodeKey, type StoredShow } from "@/lib/db";
import { curta } from "@/lib/datas";
import { ChevronDownIcon } from "@/components/icons";
import LinhaEpisodio from "./LinhaEpisodio";
import { stateColor } from "./serie";
import type { Serie } from "./useSerie";

/** As temporadas em faixas e a lista de episódios da que estiver aberta. */
export default function PainelEpisodios({
  uuid,
  show,
  serie,
  accent,
}: {
  uuid: string;
  show: StoredShow;
  serie: Serie;
  accent: string;
}) {
  const {
    watched,
    seasons,
    openSeason,
    episodesBySeason,
    corridasAbertas,
    providerMissing,
    pulseEp,
    sweepSeason,
    chipAberto,
    toggleSeason,
    toggleCorrida,
    toggleEpisode,
    openSeasonView,
    blocosEpisodios,
    markSeasonAll,
    seasonWatchedCount,
    temporadasComBuraco,
  } = serie;
  return (
    <>
      {providerMissing && (
        <p className="mb-3 rounded-lg border border-line bg-raised p-3 text-xs text-dim">
          Não foi possível obter a lista completa de episódios (série não mapeada
          ou sem ligação) — mostramos só as temporadas com episódios vistos.
        </p>
      )}

      {seasons.length === 0 ? (
        <p className="text-[0.9375rem] text-dim">Sem informação de temporadas.</p>
      ) : (
        <>
          {/* Temporadas como faixas: cinco toques em vez de uma lista de
              cinco cartões, e o estado de todas lê-se de uma vez, sem
              abrir nada. Até 5 dividem o espaço todo; mais do que isso
              (animes longos, séries de 20 temporadas) passam a scroll
              horizontal com largura fixa — cinco a espremer-se até à
              ilegibilidade não é "ver tudo de uma vez", é o oposto. */}
          <div
            className={
              seasons.length > 5
                ? "-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1"
                : "flex gap-2"
            }
          >
            {seasons.map((season) => {
              const seen = seasonWatchedCount.get(season.number) ?? 0;
              const complete = season.episodeCount > 0 && seen >= season.episodeCount;
              const cor = stateColor(complete, show.status);
              const selected = openSeason === season.number;
              // `29/51` servia para "faltam 22 no fim" e para "faltam 22
              // no meio" — e são coisas diferentes. O ponto diz qual é.
              const temBuraco = temporadasComBuraco.has(season.number);
              return (
                <button
                  key={season.number}
                  onClick={() => void toggleSeason(season)}
                  data-testid={`season-${season.number}`}
                  aria-pressed={selected}
                  aria-label={
                    season.episodeCount === 0
                      ? `Temporada ${season.number}, ainda não estreou`
                      : `Temporada ${season.number}, ${seen} de ${season.episodeCount} vistos` +
                        (temBuraco ? ", com episódios por marcar mais atrás" : "")
                  }
                  ref={(el) => {
                    if (selected) chipAberto.current = el;
                  }}
                  className={`relative h-[72px] shrink-0 cursor-pointer snap-start overflow-hidden rounded-xl border transition-colors ${
                    seasons.length > 5 ? "w-16" : "flex-1"
                  } ${
                    selected
                      ? "border-ink/40 bg-raised"
                      : "border-line bg-panel hover:border-ink/25"
                  } ${sweepSeason === season.number ? "season-sweep" : ""}`}
                >
                  {temBuraco && (
                    <span
                      aria-hidden
                      className="absolute right-1.5 top-[7px] h-[7px] w-[7px] rounded-full"
                      style={{ background: "var(--color-smpte-cyan)" }}
                    />
                  )}
                  <span className="flex h-full flex-col items-center justify-center gap-0.5">
                    <span className="ep-code text-[0.9375rem] font-semibold text-ink">
                      {season.number}
                    </span>
                    <span className="ep-code text-[0.6875rem] text-faint">
                      {season.episodeCount === 0 ? "breve" : `${seen}/${season.episodeCount}`}
                    </span>
                  </span>
                  {/* O quanto da temporada já foi visto, em largura.
                      `29/51` e `50/50` desenhavam-se iguais — o mesmo
                      retângulo, a mesma pastilha — e a diferença ficava
                      num texto de 11px. Com o preenchimento, a faixa
                      toda passa a ler-se de relance como a forma do
                      percurso pela série.

                      Uma barra só, em baixo: havia outra igual em cima
                      a dizer o estado pela cor, e numa temporada
                      completa as duas ficavam idênticas — o chip com
                      uma moldura verde em cima e em baixo, que se lê
                      como caixa e não como informação. A cor aqui diz
                      o estado, a largura diz o progresso. */}
                  <span
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-[3px] bg-line"
                  >
                    <span
                      className="block h-full transition-[width] duration-[320ms] ease-out"
                      style={{
                        width:
                          season.episodeCount > 0
                            ? `${Math.min(100, (seen / season.episodeCount) * 100)}%`
                            : "0%",
                        background: cor,
                      }}
                    />
                  </span>
                </button>
              );
            })}
          </div>

          {(() => {
            const season = openSeasonView;
            if (!season) return null;
            const seen = seasonWatchedCount.get(season.number) ?? 0;
            const complete = season.episodeCount > 0 && seen >= season.episodeCount;
            const episodes = episodesBySeason.get(season.number);
            return (
              <div className="mt-4">
                {/* Fixo ao rolar: à 3ª linha já se tinha perdido de
                    vista em que temporada se estava, numa lista que
                    agora pode ter dezenas de linhas por baixo. O
                    respiro do topo repete o da barra do estado do
                    telemóvel — aqui é que fica flush com o topo do
                    ecrã, o herói é que normalmente o cobre. */}
                <div className="sticky top-0 z-10 -mx-4 bg-tube px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-display text-[0.9375rem] font-semibold">
                      {season.name}
                    </p>
                    {!complete && season.episodeCount > 0 && (
                      <button
                        onClick={() => void markSeasonAll(season)}
                        className="cursor-pointer text-xs font-semibold text-ink hover:underline"
                      >
                        Marcar temporada como vista
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex flex-col">
                  {blocosEpisodios.map((bloco) => {
                    if (bloco.tipo === "unico") {
                      const metaEp = episodes?.find((e) => e.episode === bloco.episodio);
                      const key = episodeKey(uuid, season.number, bloco.episodio);
                      return (
                        <LinhaEpisodio
                          key={bloco.episodio}
                          season={season.number}
                          epNumber={bloco.episodio}
                          metaEp={metaEp}
                          isSeen={watched.has(key)}
                          isPulsing={pulseEp === key}
                          accent={accent}
                          onToggle={() => void toggleEpisode(season.number, bloco.episodio)}
                        />
                      );
                    }

                    const chave = `${season.number}-${bloco.inicio}-${bloco.fim}`;
                    const contagem = bloco.fim - bloco.inicio + 1;
                    const codigo = `E${String(bloco.inicio).padStart(2, "0")}–E${String(bloco.fim).padStart(2, "0")}`;

                    if (corridasAbertas.has(chave)) {
                      return (
                        <div key={chave}>
                          <button
                            onClick={() => toggleCorrida(chave)}
                            className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg px-2 text-left text-xs font-semibold text-faint hover:bg-raised"
                          >
                            <ChevronDownIcon className="h-3.5 w-3.5 rotate-180" />
                            Fechar {codigo}
                          </button>
                          {Array.from(
                            { length: contagem },
                            (_, i) => bloco.inicio + i,
                          ).map((epNumber) => {
                            const metaEp = episodes?.find((e) => e.episode === epNumber);
                            const key = episodeKey(uuid, season.number, epNumber);
                            return (
                              <LinhaEpisodio
                                key={epNumber}
                                season={season.number}
                                epNumber={epNumber}
                                metaEp={metaEp}
                                isSeen={watched.has(key)}
                                isPulsing={pulseEp === key}
                                accent={accent}
                                onToggle={() => void toggleEpisode(season.number, epNumber)}
                              />
                            );
                          })}
                        </div>
                      );
                    }

                    return (
                      <button
                        key={chave}
                        onClick={() => toggleCorrida(chave)}
                        data-testid={`corrida-${chave}`}
                        className="flex h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-2 text-left text-dim transition-colors hover:bg-raised"
                      >
                        <span className="ep-code w-[70px] shrink-0 text-[0.75rem] text-faint">
                          {codigo}
                        </span>
                        <span
                          aria-hidden
                          className="flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full text-xs font-bold"
                          style={{ background: accent, color: "var(--color-tube)" }}
                        >
                          ✓
                        </span>
                        <span className="flex-1 text-[0.9375rem]">
                          {contagem} episódios vistos
                        </span>
                        <ChevronDownIcon className="h-4 w-4 shrink-0 text-faint" />
                      </button>
                    );
                  })}
                  {/* Anunciados: mostram-se, com a data, mas não se
                      marcam nem contam — ninguém viu um episódio que
                      ainda não estreou. */}
                  {Array.from(
                    { length: season.anunciados },
                    (_, i) => season.episodeCount + i + 1,
                  ).map((epNumber) => {
                    const metaEp = episodes?.find((e) => e.episode === epNumber);
                    return (
                      <div
                        key={epNumber}
                        data-testid={`anunciado-${season.number}-${epNumber}`}
                        className="flex h-[52px] items-center gap-3 px-2 text-faint"
                      >
                        <span className="ep-code w-[34px] shrink-0 text-[0.8125rem]">
                          E{String(epNumber).padStart(2, "0")}
                        </span>
                        <span className="h-[26px] w-[26px] shrink-0 rounded-full border-2 border-dashed border-line" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-base">
                            {metaEp?.name ?? `Episódio ${epNumber}`}
                          </span>
                          <span className="ep-code block text-xs">
                            {metaEp?.airDate
                              ? `estreia a ${curta(metaEp.airDate)}`
                              : "por estrear"}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </>
      )}
    </>
  );
}
