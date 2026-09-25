"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import BotaoVoltar from "@/components/BotaoVoltar";
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
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pt-8 pb-[calc(var(--dock-h)+2rem)]">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold [font-stretch:110%]">
          Rever a biblioteca
        </h1>
        <BotaoVoltar
          label="Voltar ao perfil"
          fallback="/profile"
          className="-mr-2 inline-flex min-h-11 items-center px-2 text-[15px] text-dim hover:text-ink hover:underline"
        >
          Perfil
        </BotaoVoltar>
      </div>
      <p className="mt-1 text-[15px] text-dim">
        Séries com menos marcado do que o que já estreou. A app não sabe se as
        viste — tu sabes. Uma de cada vez, e tudo se anula.
      </p>

      {series === null ? (
        <div className="mt-10 flex flex-col items-center text-center" data-testid="rever-a-carregar">
          <span className="spinner h-6 w-6 rounded-full border-2 border-line border-t-ink" />
          <p className="mt-4 text-[15px] text-dim">
            A comparar com o que já estreou
            {progresso && progresso.total > 0
              ? ` · ${progresso.feitas}/${progresso.total}`
              : "…"}
          </p>
        </div>
      ) : series.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <CheckIcon className="h-12 w-12 text-faint" />
          <p className="mt-4 max-w-sm font-display font-semibold">Nada para rever</p>
          <p className="mt-2 max-w-sm text-[15px] text-dim">
            Tudo o que tens marcado bate certo com o que já estreou.
          </p>
        </div>
      ) : !atual ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center" data-testid="rever-fim">
          <CheckIcon className="check-pop h-12 w-12 text-ink" />
          <p className="mt-4 max-w-sm font-display font-semibold">Biblioteca revista</p>
          <p className="mt-2 max-w-sm text-[15px] text-dim">
            {arrumadas === 1 ? "1 série arrumada" : `${arrumadas} séries arrumadas`}
            {arrumadas < series.length
              ? ` · ${series.length - arrumadas} ficaram para depois`
              : ""}
            .
          </p>
          <Link
            href="/library"
            className="mt-6 flex min-h-11 items-center rounded-full border border-line px-5 text-[15px] font-semibold text-ink transition hover:border-ink active:scale-95"
          >
            Ir para a Biblioteca
          </Link>
        </div>
      ) : (
        <section className="mt-6" data-testid="rever-cartao" aria-live="polite">
          <p className="ep-code text-xs text-faint">
            {indice + 1} de {series.length}
          </p>
          <div key={atual.show.uuid} className="page-enter mt-2 rounded-2xl border border-line bg-panel p-4">
            <div className="flex gap-3">
              {atual.show.posterPath ? (
                <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-lg">
                  <Poster path={atual.show.posterPath} alt="" size="w185" fill className="object-cover" />
                </div>
              ) : (
                <div className="flex h-24 w-16 shrink-0 items-center justify-center rounded-lg bg-raised text-faint">
                  <TvIcon className="h-6 w-6" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <Link
                  href={`/series/${atual.show.uuid}`}
                  className="font-display text-lg font-semibold leading-tight hover:underline"
                >
                  {atual.show.name}
                </Link>
                <p className="ep-code mt-1 text-sm text-dim">
                  {atual.vistos} de {atual.estreados} estreados
                </p>
                <p className="ep-code text-sm text-dim">
                  por marcar: {atual.porMarcar.length} · {temporadasDe(atual.porMarcar)}
                </p>
              </div>
            </div>
            <p className="mt-4 text-[15px] text-ink" data-testid="rever-porque">
              {porque(atual)}
            </p>

            <div className="mt-4 flex flex-col gap-2">
              <button
                onClick={() => void marcar(atual.porMarcar, `${contarEpisodios(atual.porMarcar.length)} marcados`)}
                disabled={aCorrer}
                className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-ink px-4 text-[15px] font-semibold text-tube transition hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
              >
                <CheckIcon className="h-4 w-4" />
                Vi tudo · marca {atual.porMarcar.length === 1 ? "o episódio" : `os ${atual.porMarcar.length}`}
              </button>
              {/* Com buracos para trás E episódios por ver à frente, "vi
                  tudo" diria mais do que sabes. Esta marca só os de trás. */}
              {atual.padrao === "buracos" && atual.paraTras.length < atual.porMarcar.length && (
                <button
                  onClick={() =>
                    void marcar(atual.paraTras, `${contarEpisodios(atual.paraTras.length)} marcados`)
                  }
                  disabled={aCorrer}
                  className="flex min-h-12 w-full cursor-pointer items-center justify-center rounded-full border border-line px-4 text-[15px] font-semibold text-ink transition hover:border-ink/40 hover:bg-raised active:scale-[0.99] disabled:opacity-50"
                >
                  Só os de trás · {atual.paraTras.length}
                </button>
              )}
              <button
                onClick={() =>
                  void responder(
                    () => marcarAindaAVer(atual.show.uuid),
                    () => desfazerAindaAVer(atual.show.uuid),
                    "Fica como está",
                  )
                }
                disabled={aCorrer}
                className="flex min-h-12 w-full cursor-pointer items-center justify-center rounded-full border border-line px-4 text-[15px] font-semibold text-ink transition hover:border-ink/40 hover:bg-raised active:scale-[0.99] disabled:opacity-50"
              >
                Ainda estou a ver
              </button>
              <button
                onClick={() =>
                  void responder(
                    () => arquivar(atual.show.uuid, true),
                    () => arquivar(atual.show.uuid, false),
                    "Arquivada",
                  )
                }
                disabled={aCorrer}
                className="flex min-h-12 w-full cursor-pointer items-center justify-center rounded-full px-4 text-[15px] font-semibold text-dim transition hover:text-ink active:scale-[0.99] disabled:opacity-50"
              >
                Deixei de ver — arquivar
              </button>
            </div>
          </div>
          <button
            onClick={() => setIndice(indice + 1)}
            className="mx-auto mt-3 flex min-h-11 cursor-pointer items-center px-3 text-[15px] text-faint hover:text-ink"
          >
            Decidir depois
          </button>
        </section>
      )}
    </main>
  );
}
