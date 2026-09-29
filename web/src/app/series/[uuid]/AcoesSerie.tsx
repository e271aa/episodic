import { Fragment, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import StreamingBadges from "@/components/StreamingBadges";
import { Bone } from "@/components/Skeleton";
import { CheckIcon } from "@/components/icons";
import Acao from "@/components/mira/Acao";
import Codigo from "@/components/mira/Codigo";
import type { StoredShow } from "@/lib/db";
import { formatEpCode } from "@/lib/watchnext";
import type { Serie } from "./useSerie";

const ep = (n: number) => `E${String(n).padStart(2, "0")}`;
const POUCOS = ["", "o", "os dois", "os três"];

/**
 * A pergunta do cartão dos buracos (B·2b). Com poucos, numa temporada só,
 * nomeiam-se um a um — «Viste o E04, o E05 e o E06 da T2?» — porque é assim
 * que a pessoa se lembra deles. Com muitos, conta-se, e a divisão por
 * temporada vai para o texto por baixo.
 */
function proposta(buracos: Serie["buracos"]) {
  const lista = buracos.porTemporada.flatMap((t) =>
    t.episodios.map((e) => ({ t: t.temporada, e })),
  );
  const n = lista.length;
  if (buracos.porTemporada.length === 1 && n <= 3) {
    const codigos: ReactNode[] = lista.map((x, i) => (
      <Fragment key={x.e}>
        {i > 0 && (i === n - 1 ? " e " : ", ")}o <Codigo>{ep(x.e)}</Codigo>
      </Fragment>
    ));
    return {
      pergunta: (
        <>
          Viste {codigos} da <Codigo>T{lista[0].t}</Codigo>?
        </>
      ),
      sim: n === 1 ? `Sim, vi o ${ep(lista[0].e)}` : `Sim, vi ${POUCOS[n]}`,
      divisao: false,
    };
  }
  return { pergunta: <>Viste os {n} que ficaram para trás?</>, sim: `Sim, vi os ${n}`, divisao: true };
}

/**
 * O que se faz nesta série, pela ordem do desenho: com buracos, o cartão que
 * pergunta por eles (a ação principal) e o próximo numa linha secundária;
 * sem buracos, «Marcar S02·E07» é a única cápsula preenchida do ecrã. Depois,
 * onde ver e — para quem não segue a série — «Para ver».
 */
export default function AcoesSerie({
  uuid,
  show,
  serie,
}: {
  uuid: string;
  show: StoredShow;
  serie: Serie;
}) {
  const router = useRouter();
  const { buracos, marcarBuracos, nextUp, markNext, pulseNext, toggleWatchlist } = serie;
  const check = (
    <CheckIcon aria-hidden className={`h-5 w-5 shrink-0 ${pulseNext ? "check-pop" : ""}`} />
  );

  return (
    <div className="mt-3 flex flex-col gap-3">
      {/* Os buracos ANTES do próximo: não faz sentido propor o episódio
          seguinte a quem tem 22 esquecidos para trás. E repara no que NÃO
          diz — não afirma que os viste; pergunta. A decisão é tua. */}
      {buracos.total > 0 &&
        (() => {
          const { pergunta, sim, divisao } = proposta(buracos);
          return (
            <section
              className="page-enter flex flex-col gap-2.5 rounded-[26px] bg-group p-[18px]"
              data-testid="aviso-buracos"
            >
              <h2 className="text-[1.18rem] leading-[1.25] font-semibold text-label">{pergunta}</h2>
              <p className="text-[0.88rem] leading-[1.4] text-label-2">
                Já marcaste episódios depois destes. Ficaram para trás, por marcar.
                {divisao && (
                  <>
                    {" "}
                    <Codigo className="text-label">
                      {buracos.porTemporada
                        .map((t) => `T${t.temporada}: ${t.episodios.length}`)
                        .join(" · ")}
                    </Codigo>
                  </>
                )}
              </p>
              <div className="mt-1 flex gap-2">
                <Acao
                  onClick={() => void marcarBuracos()}
                  data-testid="marcar-buracos"
                  className="flex-1"
                >
                  {sim}
                </Acao>
                <Acao
                  tipo="secundaria"
                  onClick={() => router.push(`/em-dia?serie=${encodeURIComponent(uuid)}`)}
                  data-testid="um-a-um"
                >
                  Um a um
                </Acao>
              </div>
            </section>
          );
        })()}

      {nextUp === undefined ? (
        <Bone className="h-[52px] w-full rounded-full" />
      ) : nextUp && buracos.total > 0 ? (
        // Com buracos, marcar o próximo não é a ação principal: uma linha
        // secundária com contorno, para haver uma só cápsula preenchida.
        <div
          className="flex min-h-16 items-center gap-3 rounded-[26px] bg-group py-2 pr-2.5 pl-4"
          data-testid="proximo"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[0.76rem] text-label-2">Próximo</p>
            <p className="truncate text-base text-label">
              <Codigo className="text-[0.82rem] font-semibold">
                {formatEpCode(nextUp.season, nextUp.episode)}
              </Codigo>{" "}
              {nextUp.name}
            </p>
          </div>
          <Acao
            tipo="contorno"
            grande={false}
            onClick={() => void markNext()}
            data-testid="mark-next"
            aria-label={`Marcar ${formatEpCode(nextUp.season, nextUp.episode)}`}
            icone={check}
          >
            Marcar
          </Acao>
        </div>
      ) : nextUp ? (
        <Acao
          onClick={() => void markNext()}
          data-testid="mark-next"
          icone={check}
          className="w-full"
        >
          Marcar <Codigo className="text-[0.94rem]">{formatEpCode(nextUp.season, nextUp.episode)}</Codigo>
        </Acao>
      ) : null}

      <StreamingBadges kind="tv" tmdbId={show.tmdbId} variant="linha" />

      {/* Só para quem não está a seguir: a uma série em acompanhamento,
          «para ver» só redundava. É uma escolha, não uma ação — contorno
          quando já está, cinza quando não (Regra da ação). */}
      {!show.followed && (
        <Acao
          tipo={show.inWatchlist ? "contorno" : "secundaria"}
          grande={false}
          onClick={() => void toggleWatchlist()}
          icone={show.inWatchlist ? <CheckIcon aria-hidden className="h-4 w-4" /> : undefined}
          className="w-full"
        >
          {show.inWatchlist ? "Na lista para ver" : "Para ver"}
        </Acao>
      )}
    </div>
  );
}
