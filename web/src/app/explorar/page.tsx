"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getMovie, getShow, putMovie, putShow, updateShow } from "@/lib/db";
import { loadExplore, type ExploreData } from "@/lib/explore";
import { dismiss, undismiss } from "@/lib/dismissed";
import { pushUndo } from "@/lib/undo";
import { isCloudConfigured } from "@/lib/supabase";
import type { DiscoverItem } from "@/lib/tmdb";
import DiscoverSwipeCard, { type DeckItem } from "@/components/DiscoverSwipeCard";
import SwipeCoach, { EXPLORAR_COACH_KEY } from "@/components/SwipeCoach";
import { CompassIcon } from "@/components/icons";
import { Bone, PosterRowBone, TitleBone } from "@/components/Skeleton";

type Kind = "tv" | "movie";

function ExplorarContent({ kind }: { kind: Kind }) {
  const router = useRouter();

  const [data, setData] = useState<ExploreData | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    // O `kind` é a chave deste componente (ver ExplorarSwitcher): trocar de
    // separador remonta-o com estado limpo. Isso dispensa repor `data` a
    // null aqui dentro — que era o que obrigava a envolver tudo num
    // requestAnimationFrame para escapar ao `set-state-in-effect`, e nessa
    // versão o resultado chegava a uma instância que já não era a que
    // renderizava, deixando o ecrã preso no esqueleto.
    let vivo = true;
    void loadExplore(kind)
      .then((d) => {
        if (vivo) setData(d);
      })
      .catch(() => {
        if (vivo) setErro("Não foi possível carregar. Verifica a ligação.");
      });
    return () => {
      vivo = false;
    };
  }, [kind]);

  /** As secções lado a lado escondiam quantos títulos existiam de facto —
   *  um baralho só, na ordem das secções, é o que se percorre a sério. O
   *  título da secção de onde veio fica no cartão, para não se perder o
   *  "porquê" de aparecer. */
  const baralho: DeckItem[] = useMemo(() => {
    if (!data) return [];
    return data.sections.flatMap((section) =>
      section.items.map((item) => ({
        item,
        sectionTitle: section.title,
        sectionReason: section.reason,
      })),
    );
  }, [data]);

  /** Guardar = entra na lista "para ver" (a mesma da Fase L). */
  const guardar = useCallback(async (item: DiscoverItem) => {
    if (item.kind === "movie") {
      const key = `tmdb-${item.tmdbId}`;
      if (await getMovie(key)) return;
      await putMovie({
        key,
        name: item.name,
        watchedAt: null,
        dateIsExact: true,
        releaseDate: item.year ? `${item.year}-01-01` : null,
        addedAt: new Date().toISOString(),
        tmdbId: item.tmdbId,
        posterPath: item.posterPath,
      });
    } else {
      const uuid = `tmdb-${item.tmdbId}`;
      const existing = await getShow(uuid);
      if (existing) {
        await updateShow(uuid, { inWatchlist: true });
      } else {
        await putShow({
          uuid,
          name: item.name,
          tvdbId: null,
          tmdbId: item.tmdbId,
          tvmazeId: null,
          posterPath: item.posterPath,
          backdropPath: item.backdropPath,
          overview: item.overview,
          totalEpisodes: null,
          followed: false,
          inWatchlist: true,
          archived: false,
          addedAt: new Date().toISOString(),
        });
      }
    }
    pushUndo({
      label: "Guardado para ver",
      detail: item.name,
      undo: async () => {
        if (item.kind === "movie") {
          const { deleteMovie } = await import("@/lib/db");
          await deleteMovie(`tmdb-${item.tmdbId}`);
        } else {
          await updateShow(`tmdb-${item.tmdbId}`, { inWatchlist: false });
        }
      },
    });
  }, []);

  const naoInteressa = useCallback(async (item: DiscoverItem) => {
    await dismiss(item.kind, item.tmdbId);
    pushUndo({
      label: "Dispensado",
      detail: item.name,
      undo: async () => {
        await undismiss(item.kind, item.tmdbId);
      },
    });
  }, []);

  const decidir = (deckItem: DeckItem, quero: boolean) => {
    void (quero ? guardar(deckItem.item) : naoInteressa(deckItem.item));
    setCursor((c) => c + 1);
  };

  const setKind = (next: Kind) =>
    router.replace(next === "movie" ? "/explorar?tipo=filmes" : "/explorar", {
      scroll: false,
    });

  const remaining = baralho.slice(cursor, cursor + 3);
  const topo = remaining[0];

  // Alternativa por teclado — o gesto de arrastar nunca é a única forma de decidir
  useEffect(() => {
    if (!topo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") decidir(topo, true);
      else if (e.key === "ArrowLeft") decidir(topo, false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topo]);

  const total = baralho.length;
  const acabou = cursor >= total && total > 0;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-8">
      <h1 className="font-display text-2xl font-bold [font-stretch:110%]">Explorar</h1>

      {/* Séries ou filmes — o mesmo padrão da Biblioteca, para não haver
          dois vocabulários diferentes para a mesma escolha */}
      <div className="mt-4 flex gap-1 rounded-full border border-line bg-panel p-1">
        {(
          [
            ["tv", "Séries"],
            ["movie", "Filmes"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setKind(id)}
            aria-pressed={kind === id}
            className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-full text-sm font-semibold transition ${
              kind === id ? "bg-ink text-tube" : "text-dim hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {erro ? (
        <div className="mt-12 flex flex-col items-center px-6 text-center">
          <span className="bars mb-4 h-11 w-11 rounded-full opacity-40" aria-hidden />
          <p className="font-display font-semibold">Não deu para carregar</p>
          <p className="mt-1 max-w-xs text-sm text-dim">{erro}</p>
        </div>
      ) : !data ? (
        <div className="mt-6 space-y-8">
          {[0, 1].map((s) => (
            <div key={s}>
              <Bone className="h-4 w-40 rounded" />
              <PosterRowBone />
            </div>
          ))}
        </div>
      ) : total === 0 ? (
        <div className="mt-12 flex flex-col items-center px-6 text-center">
          <CompassIcon className="mb-3 h-10 w-10 text-faint" />
          <p className="font-display font-semibold">Nada para mostrar agora</p>
          <p className="mt-1 max-w-xs text-sm text-dim">
            {isCloudConfigured()
              ? "Tenta outra vez daqui a pouco."
              : "A TMDB não está configurada nesta instalação."}
          </p>
        </div>
      ) : (
        <>
          {data.taste.isEmpty && cursor === 0 && (
            <p className="mt-4 rounded-2xl border border-line bg-panel p-3 text-xs text-dim">
              Ainda não sei o que gostas. À medida que marcares episódios, isto
              passa a sugerir com base nas tuas séries.
            </p>
          )}

          {acabou ? (
            <div className="mt-16 flex flex-1 flex-col items-center justify-center text-center">
              <CompassIcon className="h-10 w-10 text-faint" />
              <p className="mt-4 font-display font-semibold">Por agora é tudo</p>
              <p className="mt-1 max-w-xs text-sm text-dim">
                Passaste por {total} sugestões. Volta amanhã para veres mais.
              </p>
              <button
                onClick={() => setCursor(0)}
                className="mt-6 cursor-pointer rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-tube transition hover:brightness-110 active:scale-95"
              >
                Rever outra vez
              </button>
            </div>
          ) : (
            <>
              <p className="ep-code mt-4 text-center text-xs text-faint">
                {cursor + 1} de {total}
              </p>
              <div className="relative mt-3 aspect-2/3 flex-1" data-swipe-stack>
                {remaining.map((deckItem, i) => (
                  <DiscoverSwipeCard
                    key={`${deckItem.item.kind}-${deckItem.item.tmdbId}`}
                    deckItem={deckItem}
                    active={i === 0}
                    depth={i}
                    onDecide={(quero) => decidir(deckItem, quero)}
                  />
                ))}
                <SwipeCoach
                  kvKey={EXPLORAR_COACH_KEY}
                  titulo="Arrasta o cartão"
                  detalhe="Descobre séries e filmes um a um, à tua medida."
                  esquerda={{
                    seta: "←",
                    titulo: "Não quero",
                    detalhe: "Passa à frente e nunca mais aparece",
                  }}
                  direita={{
                    seta: "→",
                    titulo: "Para ver",
                    detalhe: "Guarda na tua lista para ver",
                  }}
                />
              </div>

              <div className="mt-5 flex items-center justify-center gap-6">
                <button
                  onClick={() => decidir(remaining[0], false)}
                  aria-label="Não me interessa"
                  className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border-2 border-line text-faint transition hover:border-ink hover:text-ink active:scale-90"
                >
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
                    <path
                      d="M6 6l12 12M18 6L6 18"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => decidir(remaining[0], true)}
                  aria-label="Guardar para ver"
                  className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-full bg-ink text-tube transition hover:brightness-110 active:scale-90"
                >
                  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden>
                    <path
                      d="M12 5v14M5 12h14"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}

/** Lê o separador do URL e usa-o como chave — trocar de séries para filmes
 *  remonta o conteúdo com estado limpo, sem lógica de reposição. */
function ExplorarSwitcher() {
  const params = useSearchParams();
  const kind: Kind = params.get("tipo") === "filmes" ? "movie" : "tv";
  return <ExplorarContent key={kind} kind={kind} />;
}

export default function ExplorarPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-2xl px-4 py-8">
          <TitleBone />
          <Bone className="mt-4 h-12 w-full rounded-full" />
          <PosterRowBone />
        </main>
      }
    >
      <ExplorarSwitcher />
    </Suspense>
  );
}
