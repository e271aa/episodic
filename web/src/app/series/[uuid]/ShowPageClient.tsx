"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import BotaoVoltar from "@/components/BotaoVoltar";
import { Bone, CardsBone, DetailHeaderBone } from "@/components/Skeleton";
import { stateColor } from "./serie";
import { useSerie } from "./useSerie";
import CabecalhoSerie from "./CabecalhoSerie";
import AcoesSerie from "./AcoesSerie";
import PainelEpisodios from "./PainelEpisodios";
import PainelSobre from "./PainelSobre";
import PainelEstatisticas from "./PainelEstatisticas";

type Tab = "episodios" | "sobre" | "estatisticas";

export default function ShowPage() {
  const { uuid } = useParams<{ uuid: string }>();
  const serie = useSerie(uuid);
  const { show, watchedCount } = serie;
  const [tab, setTab] = useState<Tab>("episodios");

  if (show === undefined) {
    return (
      <main className="mx-auto w-full max-w-2xl">
        <DetailHeaderBone />
        <div className="px-4">
          <Bone className="mt-5 h-14 w-full rounded-2xl" />
          <CardsBone count={4} height="h-14" />
        </div>
      </main>
    );
  }
  if (show === null) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-dim">Série não encontrada.</p>
        <BotaoVoltar
          label="Voltar às séries"
          fallback="/series"
          className="mt-4 inline-block cursor-pointer text-ink underline"
        >
          Voltar às séries
        </BotaoVoltar>
      </main>
    );
  }

  const showComplete =
    show.totalEpisodes != null && watchedCount >= show.totalEpisodes;
  const accent = stateColor(showComplete, show.status);

  return (
    // Sem padding em baixo: a moldura (layout.tsx) já reserva o espaço da
    // dock, e reservá-lo aqui outra vez deixava 188px de nada por baixo das
    // temporadas fechadas (medido — Ronda 12, Fase 5b.3)
    <main className="mx-auto w-full max-w-2xl">
      <CabecalhoSerie show={show} serie={serie} showComplete={showComplete} accent={accent} />

      <div className="px-4">
        <AcoesSerie uuid={uuid} show={show} serie={serie} />

        {/* Separadores. Com o texto grande não cabem os três numa linha
            ("Estatísticas" chegava aos 428px num ecrã de 390, 5b.4): rolam
            de lado dentro da própria faixa, em vez de alargar a página. */}
        <div
          className="mt-6 flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none]"
          role="tablist"
        >
          {(
            [
              ["episodios", "Episódios"],
              ["sobre", "Sobre"],
              ["estatisticas", "Estatísticas"],
            ] as const
          ).map(([id, label], i, todos) => (
            <button
              key={id}
              role="tab"
              id={`tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`painel-${id}`}
              // Um `role="tab"` sem isto é meio padrão: o leitor de ecrã
              // anuncia "separador" e depois o teclado percorre-os um a um
              // como se fossem botões soltos. Setas andam entre eles, e só
              // o ativo é que entra na ordem do Tab (WAI-ARIA).
              tabIndex={tab === id ? 0 : -1}
              onKeyDown={(e) => {
                const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
                if (!delta) return;
                e.preventDefault();
                const proximo = todos[(i + delta + todos.length) % todos.length][0];
                setTab(proximo);
                document.getElementById(`tab-${proximo}`)?.focus();
              }}
              onClick={() => setTab(id)}
              data-testid={`tab-${id}`}
              className={`-mb-px flex min-h-11 shrink-0 cursor-pointer items-center border-b-2 px-3 text-[0.9375rem] whitespace-nowrap transition-colors ${
                tab === id
                  ? "border-ink font-semibold text-ink"
                  : "border-transparent text-dim hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "episodios" && (
          <section className="mt-4" id="painel-episodios" role="tabpanel" aria-labelledby="tab-episodios">
            <PainelEpisodios uuid={uuid} show={show} serie={serie} accent={accent} />
          </section>
        )}

        {tab === "sobre" && (
          <section className="mt-4 space-y-4" id="painel-sobre" role="tabpanel" aria-labelledby="tab-sobre">
            <PainelSobre show={show} />
          </section>
        )}

        {tab === "estatisticas" && (
          <section className="mt-4" id="painel-estatisticas" role="tabpanel" aria-labelledby="tab-estatisticas">
            <PainelEstatisticas show={show} serie={serie} accent={accent} />
          </section>
        )}
      </div>
    </main>
  );
}
