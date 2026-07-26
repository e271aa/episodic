"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getMovie, getShow, putMovie, putShow, updateShow } from "@/lib/db";
import { loadExplore, type ExploreData } from "@/lib/explore";
import { dismiss, undismiss } from "@/lib/dismissed";
import { pushUndo } from "@/lib/undo";
import { isCloudConfigured } from "@/lib/supabase";
import type { DiscoverItem } from "@/lib/tmdb";
import DiscoverCard from "@/components/DiscoverCard";
import { CompassIcon } from "@/components/icons";
import { Bone, PosterRowBone, TitleBone } from "@/components/Skeleton";

type Kind = "tv" | "movie";

function ExplorarContent({ kind }: { kind: Kind }) {
  const router = useRouter();

  const [data, setData] = useState<ExploreData | null>(null);
  const [erro, setErro] = useState<string | null>(null);

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

  const setKind = (next: Kind) =>
    router.replace(next === "movie" ? "/explorar?tipo=filmes" : "/explorar", {
      scroll: false,
    });

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
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
      ) : data.sections.length === 0 ? (
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
        <div className="mt-6 space-y-8">
          {data.taste.isEmpty && (
            <p className="rounded-2xl border border-line bg-panel p-3 text-xs text-dim">
              Ainda não sei o que gostas. À medida que marcares episódios, isto
              passa a sugerir com base nas tuas séries.
            </p>
          )}

          {data.sections.map((section) => (
            <section key={section.id}>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-sm font-semibold uppercase tracking-[0.15em] text-dim [font-stretch:80%]">
                  {section.title}
                </h2>
                {section.reason && (
                  <span className="ep-code shrink-0 text-xs text-faint">
                    {section.reason}
                  </span>
                )}
              </div>
              {/* fila horizontal: dá para percorrer com o polegar sem sair
                  do sítio, e mantém várias secções à vista de uma vez */}
              <div className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-2">
                {section.items.map((item, i) => (
                  <DiscoverCard
                    key={`${item.kind}-${item.tmdbId}`}
                    item={item}
                    index={i}
                    onSave={guardar}
                    onDismiss={naoInteressa}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
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
