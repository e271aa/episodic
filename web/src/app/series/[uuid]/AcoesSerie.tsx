import AddToListButton from "@/components/AddToListButton";
import StreamingBadges from "@/components/StreamingBadges";
import { Bone } from "@/components/Skeleton";
import { CheckIcon } from "@/components/icons";
import type { StoredShow } from "@/lib/db";
import { contarEpisodios } from "@/lib/buracos";
import { formatEpCode } from "@/lib/watchnext";
import type { Serie } from "./useSerie";

/** O que se faz nesta série: arrumar os buracos, marcar o próximo, juntar a
 *  uma lista, ver onde passa, pôr para ver. */
export default function AcoesSerie({
  uuid,
  show,
  serie,
}: {
  uuid: string;
  show: StoredShow;
  serie: Serie;
}) {
  const { buracos, marcarBuracos, nextUp, markNext, pulseNext, toggleWatchlist } = serie;
  return (
    <>
      {/* Episódios por marcar ATRÁS do ponto onde já se vai. Fica antes da
          ação principal de propósito: não faz sentido propor o próximo
          episódio a quem tem 22 esquecidos para trás — e era exatamente
          isso que a app fazia, sem nunca dizer que eles existiam.

          Repara no que NÃO diz: não afirma que os viste. Diz onde estão e
          oferece-se para os marcar. A decisão é tua. */}
      {buracos.total > 0 && (
        <div
          className="page-enter mt-4 rounded-2xl border border-line bg-raised/60 p-4"
          data-testid="aviso-buracos"
        >
          <p className="font-display text-[0.9375rem] font-semibold text-ink">
            {contarEpisodios(buracos.total)} por marcar mais atrás
          </p>
          <p className="mt-1 text-[0.9375rem] text-dim">
            {buracos.porTemporada
              .map((t) => `T${t.temporada}: ${t.episodios.length}`)
              .join(" · ")}
            {" — já viste episódios depois destes."}
          </p>
          <button
            onClick={() => void marcarBuracos()}
            data-testid="marcar-buracos"
            className="mt-3 flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-ink text-[0.9375rem] font-semibold text-tube transition hover:brightness-110 active:scale-[0.99]"
          >
            <CheckIcon className="h-4 w-4" />
            Marcar {buracos.total === 1 ? "o episódio" : `os ${buracos.total}`}
          </button>
        </div>
      )}

      {/* Ação principal — a decisão nº 1 na página de série. Sem episódio
          por marcar não há ação nenhuma a propor: o cabeçalho já disse "Em
          dia" a par do título, repetir num cartão por baixo era a mesma
          frase duas vezes na mesma página.

          Com buracos por marcar deixa de ser a principal: eram dois blocos
          brancos iguais empilhados, os dois a pedir o toque com o mesmo
          peso, e a página tem uma decisão nº 1 de cada vez. Quem tem 22
          esquecidos atrás arruma-os primeiro — foi essa a ordem decidida
          na Fase 1, e o desenho passa a dizer o mesmo que a ordem. */}
      {nextUp === undefined ? (
        <Bone className="mt-4 h-14 w-full rounded-2xl" />
      ) : nextUp ? (
        <button
          onClick={() => void markNext()}
          data-testid="mark-next"
          className={`mt-4 flex w-full cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-left transition active:scale-[0.99] ${
            buracos.total > 0
              ? "border border-line text-ink hover:border-ink/40 hover:bg-raised"
              : "bg-ink text-tube hover:brightness-110"
          }`}
        >
          <CheckIcon className={`h-6 w-6 shrink-0 ${pulseNext ? "check-pop" : ""}`} />
          <span className="min-w-0 flex-1">
            <span className="block text-[0.9375rem] font-semibold">Marcar próximo episódio</span>
            <span className="ep-code block truncate text-xs opacity-80">
              {formatEpCode(nextUp.season, nextUp.episode)} · {nextUp.name}
            </span>
          </span>
        </button>
      ) : null}

      {/* Lista e Onde ver DEPOIS de marcar (escolhido pelo Ruben a 27-09,
          Ronda 12, Fase 5b.3): marcar é a razão de se abrir uma série, e
          com buracos o "Marcar próximo episódio" ficava 20% livre ao
          chegar — o resto debaixo da dock. Agora as duas ações de marcar
          estão inteiras à vista. */}
      {/* Duas ações, sempre as mesmas duas perguntas: juntar a uma lista,
          ver onde passa. Lado a lado, mesmo peso — nenhuma é secundária
          da outra. */}
      <div className="mt-4 flex gap-2.5">
        <AddToListButton
          kind="show"
          refId={uuid}
          label="Lista"
          wrapperClassName="relative flex-1"
          className="flex h-12 w-full cursor-pointer items-center justify-center rounded-full border border-line bg-raised/60 text-[0.9375rem] font-medium text-ink backdrop-blur transition active:scale-95"
        />
        <StreamingBadges kind="tv" tmdbId={show.tmdbId} variant="action" />
      </div>

      {/* só faz sentido para quem não está a seguir ativamente — uma série
          já em acompanhamento não precisa de "para ver" a redundar */}
      {!show.followed && (
        <button
          onClick={() => void toggleWatchlist()}
          className={`mt-2.5 flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-full border px-4 text-[0.9375rem] font-medium transition active:scale-95 ${
            show.inWatchlist
              ? "border-ink/60 bg-raised text-ink"
              : "border-line text-dim hover:border-ink hover:text-ink"
          }`}
        >
          {show.inWatchlist && <CheckIcon className="h-3.5 w-3.5" />}
          {show.inWatchlist ? "Na lista para ver" : "Para ver"}
        </button>
      )}
    </>
  );
}
