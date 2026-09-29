"use client";

import { useEffect, useState } from "react";
import { markWatchedMany, unmarkWatchedMany } from "@/lib/db";
import { formatEpCode } from "@/lib/watchnext";
import { pushUndo } from "@/lib/undo";
import type { MetaEpisode } from "@/lib/metadata";
import SwipeCard from "@/components/SwipeCard";
import BotaoVoltar from "@/components/BotaoVoltar";
import { ArrowLeftIcon, CheckIcon } from "@/components/icons";
import { Bone, TitleBone } from "@/components/Skeleton";
import { useSerie } from "@/app/series/[uuid]/useSerie";

type Episodio = { season: number; episode: number };

/**
 * O «Um a um» do cartão dos buracos (Mira, B·2b): o Pôr em dia **desta
 * série**, só com os episódios que ficaram por marcar atrás. Um cartão por
 * episódio — «vi» marca-o sem data (sabes que o viste, não quando: com a de
 * hoje, as estatísticas contavam-no como visto hoje), «ainda não» passa.
 *
 * A pilha tira-se uma vez, quando as temporadas chegam: marcar um buraco
 * muda a lista de buracos, e a pilha não pode mudar debaixo do dedo.
 */
export default function UmAUm({ uuid }: { uuid: string }) {
  const serie = useSerie(uuid);
  const { show, buracos, seasons, temporadasCarregadas, episodesBySeason, loadSeasonEpisodes } =
    serie;
  const [pilha, setPilha] = useState<Episodio[] | null>(null);
  const [cursor, setCursor] = useState(0);
  const [marcados, setMarcados] = useState(0);

  if (pilha === null && temporadasCarregadas) {
    setPilha(
      buracos.porTemporada.flatMap((t) =>
        t.episodios.map((e) => ({ season: t.temporada, episode: e })),
      ),
    );
  }

  // Os nomes dos episódios, das temporadas que têm buracos.
  useEffect(() => {
    if (!pilha) return;
    const raf = requestAnimationFrame(() => {
      for (const t of new Set(pilha.map((p) => p.season))) {
        const sv = seasons.find((s) => s.number === t);
        if (sv) void loadSeasonEpisodes(sv);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [pilha, seasons, loadSeasonEpisodes]);

  const meta = (p: Episodio): MetaEpisode =>
    episodesBySeason.get(p.season)?.find((e) => e.episode === p.episode) ?? {
      season: p.season,
      episode: p.episode,
      name: `Episódio ${p.episode}`,
      airDate: null,
    };

  const decidir = (p: Episodio, vi: boolean) => {
    if (!show) return;
    if (vi) void markWatchedMany(uuid, [p], { exata: false });
    setCursor((c) => c + 1);
    if (vi) setMarcados((n) => n + 1);
    pushUndo({
      label: vi ? "Marcado como visto" : "Deixado para depois",
      detail: `${show.name} · ${formatEpCode(p.season, p.episode)}`,
      undo: async () => {
        if (vi) await unmarkWatchedMany(uuid, [p]);
        setCursor((c) => Math.max(0, c - 1));
        if (vi) setMarcados((n) => Math.max(0, n - 1));
      },
    });
  };

  // Alternativa por teclado — arrastar nunca é a única forma de decidir
  const topo = pilha?.[cursor];
  useEffect(() => {
    if (!topo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") decidir(topo, true);
      else if (e.key === "ArrowLeft") decidir(topo, false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (show === undefined || pilha === null) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-8">
        <TitleBone />
        <Bone className="mt-6 aspect-3/4 w-full rounded-3xl" />
      </main>
    );
  }

  const voltar = show ? `/series/${uuid}` : "/series";
  const total = pilha.length;
  const visiveis = pilha.slice(cursor, cursor + 3);

  return (
    <main className="tela-cheia mx-auto flex w-full max-w-md flex-col overflow-hidden px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <div className="flex shrink-0 items-center gap-2">
        <BotaoVoltar
          label="Voltar à série"
          fallback={voltar}
          className="-ml-2 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-label-2 transition active:scale-90"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </BotaoVoltar>
        <div className="min-w-0">
          <h1 className="text-[1.3rem] leading-tight font-bold">Pôr em dia</h1>
          {show && <p className="truncate text-[0.76rem] text-label-2">{show.name} · por marcar</p>}
        </div>
      </div>

      {!show || total === 0 || cursor >= total ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <CheckIcon className="h-10 w-10 text-label-2" />
          <p className="mt-4 font-semibold">
            {!show ? "Série não encontrada" : total === 0 ? "Nada por marcar aqui" : "Passaste tudo em revista"}
          </p>
          {show && total > 0 && (
            <p className="mt-1 max-w-xs text-[0.88rem] text-label-2" data-testid="um-a-um-fim">
              {marcados === 0
                ? "Nenhum marcado."
                : `${marcados} ${marcados === 1 ? "marcado" : "marcados"}, sem data.`}
            </p>
          )}
        </div>
      ) : (
        <>
          <p className="ep-code mt-3 shrink-0 text-center text-xs text-label-2">
            {cursor + 1} de {total}
          </p>
          <div className="relative mt-3 min-h-0 flex-1 pb-4" data-swipe-stack>
            {visiveis.map((p, i) => (
              <SwipeCard
                key={`${p.season}-${p.episode}`}
                showName={show.name}
                posterPath={show.posterPath}
                backdropPath={show.backdropPath}
                episode={meta(p)}
                watchedCount={serie.watchedCount}
                totalEpisodes={show.totalEpisodes}
                active={i === 0}
                depth={i}
                onDecide={(vi) => decidir(p, vi)}
              />
            ))}
            <div className="pointer-events-none absolute inset-x-0 bottom-[calc(var(--dock-h)+5.5rem)] z-20 flex items-center justify-center gap-6">
              <button
                onClick={() => decidir(visiveis[0], false)}
                aria-label="Ainda não — deixar por marcar"
                className="vidro pointer-events-auto flex h-14 w-14 cursor-pointer items-center justify-center rounded-full text-label transition active:scale-90"
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
              <button
                onClick={() => decidir(visiveis[0], true)}
                aria-label="Vi — marcar como visto"
                className="pointer-events-auto flex h-16 w-16 cursor-pointer items-center justify-center rounded-full bg-acao text-on-label transition active:scale-90"
              >
                <CheckIcon className="h-7 w-7" />
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
