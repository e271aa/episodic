"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Acao from "@/components/mira/Acao";
import CabecalhoEcra from "@/components/CabecalhoEcra";
import Poster from "@/components/Poster";
import { CheckIcon, TvIcon } from "@/components/icons";
import { contarEpisodios } from "@/lib/buracos";
import { recursoSeries } from "@/lib/cache";
import { pushUndo } from "@/lib/undo";
import { formatEpCode } from "@/lib/watchnext";
import {
  arquivar,
  desfazerAindaAVer,
  desmarcarVistos,
  marcarAindaAVer,
  marcarVistos,
  seriesARever,
  temporadasDe,
  type Episodio,
  type SerieARever,
} from "@/lib/rever";

/** A frase que diz porque é que esta série está aqui — cada padrão pede
 *  uma pergunta diferente. */
function porque(s: SerieARever): string {
  if (s.padrao === "buracos") {
    return `Tens ${contarEpisodios(s.paraTras.length)} por marcar antes do último que viste (${
      s.ultimo ? formatEpCode(s.ultimo.season, s.ultimo.episode) : ""
    }). Quase de certeza viste-os.`;
  }
  if (s.padrao === "fronteira" && s.ultimo) {
    return `Paraste no fim da T${s.ultimo.season}. Viste o que veio a seguir?`;
  }
  return s.ultimo
    ? `Ficaste em ${formatEpCode(s.ultimo.season, s.ultimo.episode)}.`
    : "Começaste e não marcaste mais.";
}

export default function ReverPage() {
  const [series, setSeries] = useState<SerieARever[] | null>(null);
  const [progresso, setProgresso] = useState<{ feitas: number; total: number } | null>(null);
  const [indice, setIndice] = useState(0);
  const [arrumadas, setArrumadas] = useState(0);
  const [aCorrer, setACorrer] = useState(false);

  useEffect(() => {
    let vivo = true;
    void seriesARever((feitas, total) => {
      if (vivo) setProgresso({ feitas, total });
    }).then((r) => {
      if (!vivo) return;
      setSeries(r);
      // os totais podem ter mudado ao perguntar ao fornecedor
      void recursoSeries.revalidar();
    });
    return () => {
      vivo = false;
    };
  }, []);

  const atual = series?.[indice] ?? null;
  /** o que a prova cobre (os buracos para trás), ou nada quando não há prova */
  const prova = atual?.padrao === "buracos" ? atual.paraTras : null;
  const alemDaProva = prova ? atual!.porMarcar.filter((e) => !prova.some((t) => t.season === e.season && t.episode === e.episode)) : [];

  /**
   * Cada resposta: aplica, avança, e deixa anular — anular volta a mostrar
   * este cartão, porque é aqui que a decisão se refaz.
   */
  const responder = useCallback(
    async (
      aplicar: () => Promise<void>,
      desfazer: () => Promise<void>,
      aviso: string,
    ) => {
      if (!atual || aCorrer) return;
      setACorrer(true);
      const aqui = indice;
      try {
        await aplicar();
        setArrumadas((n) => n + 1);
        setIndice(aqui + 1);
        pushUndo({
          label: aviso,
          detail: atual.show.name,
          undo: async () => {
            await desfazer();
            setArrumadas((n) => Math.max(0, n - 1));
            setIndice(aqui);
            void recursoSeries.revalidar();
          },
        });
        void recursoSeries.revalidar();
      } finally {
        setACorrer(false);
      }
    },
    [atual, aCorrer, indice],
  );

  const marcar = (episodios: Episodio[], aviso: string) =>
    atual &&
    responder(
      () => marcarVistos(atual.show.uuid, episodios),
      () => desmarcarVistos(atual.show.uuid, episodios),
      aviso,
    );

  return (
    // `pt-4` e não `pt-8`: com a base da Mira (17px) o cartão cresceu 10px e as
    // saídas passavam para baixo da barra ao chegar (Ronda 14, Fase 1). O ecrã
    // é refeito por inteiro na Fase 8.
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pt-4 pb-8">
      <CabecalhoEcra titulo="Rever a biblioteca" voltar="Voltar ao perfil" fallback="/profile" />
      {/* Duas linhas, não três: "uma de cada vez, e tudo se anula" já o
          dizem o contador e o aviso de anular, e a linha a mais empurrava a
          saída do cartão para debaixo da dock (Ronda 12, 5d). */}
      <p className="mt-1 text-[0.88rem] text-label-2">
        Séries com menos marcado do que o que já estreou. Só tu sabes se as viste.
      </p>

      {series === null ? (
        <div className="mt-10 flex flex-col items-center text-center" data-testid="rever-a-carregar">
          <span className="spinner h-6 w-6 rounded-full border-2 border-label-3 border-t-label" />
          <p className="mt-4 text-[0.88rem] text-label-2">
            A comparar com o que já estreou
            {progresso && progresso.total > 0
              ? ` · ${progresso.feitas}/${progresso.total}`
              : "…"}
          </p>
        </div>
      ) : series.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <CheckIcon className="h-12 w-12 text-label-3" />
          <p className="mt-4 max-w-sm text-[1.18rem] font-semibold text-label">Nada para rever</p>
          <p className="mt-2 max-w-sm text-[0.88rem] text-label-2">
            Tudo o que tens marcado bate certo com o que já estreou.
          </p>
        </div>
      ) : !atual ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center" data-testid="rever-fim">
          <CheckIcon className="check-pop h-12 w-12 text-label" />
          <p className="mt-4 max-w-sm text-[1.18rem] font-semibold text-label">Biblioteca revista</p>
          <p className="mt-2 max-w-sm text-[0.88rem] text-label-2">
            {arrumadas === 1 ? "1 série arrumada" : `${arrumadas} séries arrumadas`}
            {arrumadas < series.length
              ? ` · ${series.length - arrumadas} ficaram para depois`
              : ""}
            .
          </p>
          <Link
            href="/library"
            className="mt-6 flex min-h-[52px] items-center rounded-full bg-acao px-5 font-semibold text-on-label transition active:scale-[0.97]"
          >
            Ir para a Biblioteca
          </Link>
        </div>
      ) : (
        <section className="mt-4" data-testid="rever-cartao" aria-live="polite">
          {/* "Decidir depois" é passar à seguinte — vive junto do contador.
              Em baixo, com três botões no cartão, ficava debaixo da dock ao
              chegar (0% livre, 5b.4). A margem negativa guarda os 44px de
              toque sem alargar a linha. */}
          <div className="flex items-center justify-between">
            <p className="ep-code text-[0.76rem] text-label-2">
              {indice + 1} de {series.length}
            </p>
            <button
              onClick={() => setIndice(indice + 1)}
              className="-mr-3 -my-3.5 flex min-h-11 cursor-pointer items-center px-3 text-[0.88rem] text-label-2"
            >
              Decidir depois
            </button>
          </div>
          <div key={atual.show.uuid} className="page-enter mt-2 rounded-[26px] bg-group p-4">
            <div className="flex gap-3">
              {atual.show.posterPath ? (
                <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-lg">
                  <Poster path={atual.show.posterPath} alt="" size="w185" fill sizes="56px" className="object-cover" />
                </div>
              ) : (
                <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded-lg bg-fill text-label-3">
                  <TvIcon className="h-6 w-6" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <Link
                  href={`/series/${atual.show.uuid}`}
                  className="tap-44 relative text-[1.18rem] leading-tight font-semibold text-label"
                >
                  {atual.show.name}
                </Link>
                <p className="ep-code mt-1 text-[0.88rem] text-label-2">
                  {atual.vistos} de {atual.estreados} estreados
                </p>
                {/* O glossário (PRODUCT.md): "por marcar" é só o que está
                    ATRÁS do último visto; o que vem depois é "por ver". Dizia
                    "por marcar: 35 · T2 e T4" quando 28 eram a T4 inteira,
                    à frente (Ronda 12, 5b.4, P1 #4). `paraTras` é o início
                    de `porMarcar` — os dois estão pela mesma ordem. */}
                {atual.paraTras.length > 0 && (
                  <p className="ep-code text-[0.88rem] text-label-2">
                    {atual.paraTras.length} por marcar · {temporadasDe(atual.paraTras)}
                  </p>
                )}
                {atual.porMarcar.length > atual.paraTras.length && (
                  <p className="ep-code text-[0.88rem] text-label-2">
                    {atual.porMarcar.length - atual.paraTras.length} por ver ·{" "}
                    {temporadasDe(atual.porMarcar.slice(atual.paraTras.length))}
                  </p>
                )}
              </div>
            </div>
            <p className="mt-4 text-base text-label" data-testid="rever-porque">
              {porque(atual)}
            </p>

            {/* Só a prova ganha a pílula branca (Ronda 12, Fase 4): com
                buracos para trás, é marcar esses; sem prova nenhuma (parou
                no fim de uma temporada, ou a meio), é uma pergunta e nenhuma
                resposta vem recomendada. O "vi tudo" diz sempre o que junta
                para além da prova. */}
            <div className="mt-3 flex flex-col gap-2">
              {prova && (
                <Acao
                  grande={false}
                  onClick={() => void marcar(prova, `${contarEpisodios(prova.length)} marcados`)}
                  disabled={aCorrer}
                  className="w-full"
                >
                  <CheckIcon className="h-4 w-4" />
                  Marcar {prova.length === 1 ? "o episódio" : `os ${prova.length}`}
                  {alemDaProva.length > 0 && " de trás"}
                </Acao>
              )}
              {(!prova || alemDaProva.length > 0) && (
                <Acao
                  tipo="secundaria"
                  grande={false}
                  onClick={() =>
                    void marcar(atual.porMarcar, `${contarEpisodios(atual.porMarcar.length)} marcados`)
                  }
                  disabled={aCorrer}
                  className="w-full"
                >
                  {prova
                    ? `Vi tudo · também ${alemDaProva.length === 1 ? "o" : `os ${alemDaProva.length}`} da ${temporadasDe(alemDaProva)}`
                    : `Vi tudo · marca ${atual.porMarcar.length === 1 ? "o episódio" : `os ${atual.porMarcar.length}`}`}
                </Acao>
              )}
              <Acao
                tipo="secundaria"
                grande={false}
                onClick={() =>
                  void responder(
                    () => marcarAindaAVer(atual.show.uuid),
                    () => desfazerAindaAVer(atual.show.uuid),
                    "Fica como está",
                  )
                }
                disabled={aCorrer}
                className="w-full"
              >
                Ainda estou a ver
              </Acao>
            </div>
          </div>
          {/* Arquivar não é uma resposta à pergunta do cartão — é uma saída
              dele. Numa linha discreta, fora da pilha de botões. */}
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4">
            <button
              onClick={() =>
                void responder(
                  () => arquivar(atual.show.uuid, true),
                  () => arquivar(atual.show.uuid, false),
                  "Arquivada",
                )
              }
              disabled={aCorrer}
              className="flex min-h-11 cursor-pointer items-center px-3 text-[0.88rem] text-label-2 transition disabled:opacity-50"
            >
              Deixei de ver — arquivar
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
