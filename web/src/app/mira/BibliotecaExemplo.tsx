"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Acao from "@/components/mira/Acao";
import { Grupo } from "@/components/mira/Grupo";
import { isCloudConfigured } from "@/lib/supabase";
import { clearAllData, getShows, markWatched, putMovie, putShow, type StoredShow } from "@/lib/db";

/**
 * Uma biblioteca de exemplo, para julgar a assinatura (Fase 3) num iPhone sem
 * tocar em dados a sério. Séries reais da TMDB (o `next dev` da pré-visualização
 * tem a chave), cada uma num estado da casa:
 *
 * - The Bear, a um episódio de fechar a T1 — marcar dá o fim de temporada;
 * - Severance, a meio da T2 — os segmentos e o «Continuar»;
 * - Andor, parada há 60 dias — «Retomar»;
 * - Shōgun, por começar;
 * - Past Lives, um filme para ver — o «Ou então».
 *
 * Os vistos são de ontem, para o diário do cabeçalho partir do zero.
 *
 * **Só sem nuvem:** apaga a base local deste endereço antes de semear, e com
 * as chaves do Supabase a app sincronizaria a amostra para uma conta. Sai com
 * a vitrine, na Fase 12.
 */

const ONTEM_21H = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(21, 0, 0, 0);
  return d;
})();

function haDias(dias: number): Date {
  const d = new Date(ONTEM_21H);
  d.setDate(d.getDate() - (dias - 1));
  return d;
}

function serie(tmdbId: number, name: string, dias: number): StoredShow {
  return {
    uuid: `tmdb-${tmdbId}`,
    name,
    tvdbId: null,
    tmdbId,
    posterPath: null,
    backdropPath: null,
    overview: null,
    totalEpisodes: null,
    numeracao: "tmdb",
    followed: true,
    inWatchlist: false,
    archived: false,
    addedAt: haDias(dias + 30).toISOString(),
  };
}

/** [série, [temporada, episódio][], quando] — cada episódio um minuto depois do anterior */
const AMOSTRA: [StoredShow, [number, number][], Date][] = [
  [serie(136315, "The Bear", 1), [1, 2, 3, 4, 5, 6, 7].map((e) => [1, e]), ONTEM_21H],
  [
    serie(95396, "Severance", 3),
    [...Array.from({ length: 9 }, (_, i): [number, number] => [1, i + 1]), [2, 1], [2, 2], [2, 3], [2, 4], [2, 5]],
    haDias(3),
  ],
  [serie(83867, "Andor", 60), [1, 2, 3, 4].map((e) => [1, e]), haDias(60)],
  [serie(126308, "Shōgun", 10), [], haDias(10)],
];

export default function BibliotecaExemplo() {
  const router = useRouter();
  const [estado, setEstado] = useState<"parado" | "a-carregar" | "erro">("parado");
  const nuvem = isCloudConfigured();

  const carregar = async () => {
    if (nuvem || estado === "a-carregar") return;
    const existentes = await getShows();
    if (
      existentes.length > 0 &&
      !window.confirm(`Isto apaga as ${existentes.length} séries guardadas neste endereço e põe a biblioteca de exemplo.`)
    ) {
      return;
    }
    setEstado("a-carregar");
    try {
      await clearAllData();
      for (const [s, vistos, quando] of AMOSTRA) {
        await putShow(s);
        for (const [i, [season, episode]] of vistos.entries()) {
          await markWatched(s.uuid, season, episode, new Date(quando.getTime() + i * 60_000).toISOString());
        }
      }
      await putMovie({
        key: "tmdb-666277",
        name: "Past Lives",
        tmdbId: 666277,
        watchedAt: null,
        dateIsExact: true,
        releaseDate: "2023-06-02",
        addedAt: haDias(5).toISOString(),
      });
      router.push("/series");
    } catch {
      setEstado("erro");
    }
  };

  return (
    <Grupo titulo="Biblioteca de exemplo" className="mt-6">
      <div className="flex flex-col gap-3 p-4">
        <p className="text-[0.88rem] leading-snug text-label-2">
          {nuvem
            ? "Só na pré-visualização sem nuvem: aqui a amostra ia para a tua conta."
            : "Quatro séries e um filme, cada um num estado da casa. The Bear fica a um episódio de fechar a temporada. Apaga o que estiver guardado neste endereço."}
        </p>
        <Acao tipo="secundaria" disabled={nuvem || estado === "a-carregar"} onClick={() => void carregar()}>
          {estado === "a-carregar" ? "A carregar…" : "Carregar biblioteca de exemplo"}
        </Acao>
        {estado === "erro" && (
          <p role="alert" className="text-center text-[0.88rem] text-danger">
            Não deu para carregar. Tenta outra vez.
          </p>
        )}
      </div>
    </Grupo>
  );
}
