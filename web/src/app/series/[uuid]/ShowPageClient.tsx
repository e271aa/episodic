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
import MenuSerie from "./MenuSerie";

export default function ShowPage() {
  const { uuid } = useParams<{ uuid: string }>();
  const serie = useSerie(uuid);
  const { show, watchedCount } = serie;
  const [menu, setMenu] = useState(false);

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

  /**
   * Uma coluna só (Mira, B·2a): a arte, o título, a ação, onde ver, as
   * temporadas e os episódios. Os três separadores saíram — o Sobre e as
   * Estatísticas vivem no «···», e a pergunta deste ecrã («qual é o
   * próximo?») responde-se sem tocar em nada.
   */
  return (
    // Sem padding em baixo: a moldura (layout.tsx) já reserva o espaço da
    // dock, e reservá-lo aqui outra vez deixava 188px de nada por baixo das
    // temporadas fechadas (medido — Ronda 12, Fase 5b.3)
    <main className="mx-auto w-full max-w-2xl">
      <CabecalhoSerie
        show={show}
        serie={serie}
        showComplete={showComplete}
        accent={accent}
        onMenu={() => setMenu(true)}
      />

      <div className="px-4">
        <AcoesSerie uuid={uuid} show={show} serie={serie} />
        <PainelEpisodios uuid={uuid} serie={serie} />
      </div>

      <MenuSerie
        aberto={menu}
        onFechar={() => setMenu(false)}
        uuid={uuid}
        show={show}
        serie={serie}
        accent={accent}
      />
    </main>
  );
}
