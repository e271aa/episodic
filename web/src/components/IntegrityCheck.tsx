"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  applyRepair,
  findDuplicateMovies,
  findDuplicateShows,
  mergeDuplicateMovies,
  getRepairBackup,
  planRepair,
  removeDuplicateShows,
  undoRepair,
  type DuplicateMovie,
  type DuplicateShow,
  type RepairPlan,
} from "@/lib/repair";
import { PanelRow } from "@/components/Panel";
import { porExtenso } from "@/lib/datas";

/**
 * Verificação e reparação de episódios duplicados por numerações diferentes
 * (ver lib/repair.ts para o diagnóstico completo).
 *
 * Nada é apagado sem se ver primeiro o que vai sair, e o que sai fica
 * guardado para se poder repor com as datas originais.
 */
export default function IntegrityCheck() {
  const [plan, setPlan] = useState<RepairPlan | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [estado, setEstado] = useState<string | null>(null);
  const [podeReverter, setPodeReverter] = useState<number>(0);
  const [duplicados, setDuplicados] = useState<DuplicateShow[] | null>(null);
  const [filmesRepetidos, setFilmesRepetidos] = useState<DuplicateMovie[] | null>(null);

  useEffect(() => {
    void getRepairBackup().then((b) => setPodeReverter(b?.episodes.length ?? 0));
  }, []);

  const verificar = useCallback(() => {
    setPlan(null);
    setEstado(null);
    setProgress({ done: 0, total: 0 });
    setDuplicados(null);
    setFilmesRepetidos(null);
    void findDuplicateShows().then(setDuplicados).catch(() => setDuplicados([]));
    void findDuplicateMovies().then(setFilmesRepetidos).catch(() => setFilmesRepetidos([]));
    void planRepair((done, total) => setProgress({ done, total }))
      .then((p) => {
        setPlan(p);
        setProgress(null);
      })
      .catch(() => {
        setEstado("Não foi possível verificar. Verifica a ligação.");
        setProgress(null);
      });
  }, []);

  const reparar = useCallback(() => {
    if (!plan) return;
    setEstado(null);
    void applyRepair(plan.repairs)
      .then(async (n) => {
        setEstado(`${n} marcações duplicadas removidas.`);
        setPlan(null);
        setPodeReverter((await getRepairBackup())?.episodes.length ?? 0);
      })
      .catch(() => setEstado("A reparação falhou. Nada foi alterado."));
  }, [plan]);

  const reverter = useCallback(() => {
    setEstado(null);
    void undoRepair()
      .then((n) => {
        setEstado(`${n} marcações repostas com as datas originais.`);
        setPodeReverter(0);
      })
      .catch(() => setEstado("Não foi possível repor."));
  }, []);

  const limparDuplicados = useCallback(() => {
    if (!duplicados || duplicados.length === 0) return;
    setEstado(null);
    void removeDuplicateShows(duplicados)
      .then((n) => {
        setEstado(`${n} ${n === 1 ? "série repetida removida" : "séries repetidas removidas"}.`);
        setDuplicados([]);
      })
      .catch(() => setEstado("Não foi possível remover as repetidas."));
  }, [duplicados]);

  const juntarFilmes = useCallback(() => {
    if (!filmesRepetidos || filmesRepetidos.length === 0) return;
    setEstado(null);
    void mergeDuplicateMovies(filmesRepetidos)
      .then((n) => {
        setEstado(`${n} ${n === 1 ? "cópia de filme juntada" : "cópias de filmes juntadas"} ao original.`);
        setFilmesRepetidos([]);
      })
      .catch(() => setEstado("Não foi possível juntar os filmes repetidos."));
  }, [filmesRepetidos]);

  const seguras = plan?.repairs.filter((r) => r.safe) ?? [];
  const duvidosas = plan?.repairs.filter((r) => !r.safe) ?? [];
  const totalSeguro = seguras.reduce((n, r) => n + r.extras.length, 0);

  // Nada de resultados ainda e nada por repor: a verificação é uma linha
  // como as outras. O relatório só ocupa espaço depois de haver relatório.
  const emRepouso =
    plan === null &&
    duplicados === null &&
    filmesRepetidos === null &&
    estado === null &&
    podeReverter === 0;

  if (emRepouso) {
    return (
      <PanelRow
        titulo="Verificar biblioteca"
        detalhe="Procura séries e filmes repetidos, e episódios contados duas vezes"
        onClick={verificar}
        fim={
          progress !== null ? (
            <span className="ep-code flex items-center gap-2 text-xs">
              <span className="spinner h-3.5 w-3.5 rounded-full border-2 border-dim/30 border-t-dim" />
              {progress.done}/{progress.total}
            </span>
          ) : (
            "→"
          )
        }
      />
    );
  }

  return (
    <div className="px-5 py-4">
      <p className="font-display text-[0.9375rem] font-semibold">Verificar biblioteca</p>
      <p className="mt-1 text-[0.9375rem] text-dim">
        Procura séries repetidas e séries com mais episódios marcados do que o
        fornecedor tem — as duas coisas acontecem quando o import do TV Time e
        a app usam numerações e identificadores diferentes.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={verificar}
          disabled={progress !== null}
          className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line px-4 text-[0.9375rem] font-semibold text-dim transition hover:border-ink hover:text-ink active:scale-95 disabled:opacity-50"
        >
          {progress !== null && (
            <span className="spinner h-3.5 w-3.5 rounded-full border-2 border-dim/30 border-t-dim" />
          )}
          {progress !== null ? `A verificar ${progress.done}/${progress.total}…` : "Verificar"}
        </button>

        {podeReverter > 0 && (
          <button
            onClick={reverter}
            className="flex min-h-11 cursor-pointer items-center rounded-full border border-line px-4 text-[0.9375rem] font-semibold text-dim transition hover:border-ink hover:text-ink active:scale-95"
          >
            Repor {podeReverter} marcações
          </button>
        )}
      </div>

      {estado && <p className="mt-3 text-[0.9375rem] text-ink">{estado}</p>}

      {duplicados && duplicados.length > 0 && (
        <div className="mt-4 rounded-xl border border-line bg-raised p-3">
          <p className="ep-code text-sm text-ink">
            {duplicados.length}{" "}
            {duplicados.length === 1 ? "série repetida" : "séries repetidas"}
          </p>
          <p className="mt-1 text-xs text-dim">
            A mesma série ficou duas vezes na biblioteca — uma com o teu
            histórico, outra vazia, criada pelo Explorar ou pela pesquisa. Sai
            a vazia; os nomes e as listas dela passam para a que fica.
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {duplicados.map((d) => (
              <li key={d.dropUuid} className="ep-code text-xs text-faint">
                {d.dropName !== d.keepName ? `${d.dropName} = ` : ""}
                {d.keepName} · fica a que tem {d.keepWatched} episódios
              </li>
            ))}
          </ul>
          <button
            onClick={limparDuplicados}
            className="mt-3 flex min-h-11 w-full cursor-pointer items-center justify-center rounded-full bg-ink px-4 text-[0.9375rem] font-semibold text-tube transition hover:brightness-110 active:scale-95"
          >
            Remover {duplicados.length === 1 ? "a repetida" : "as repetidas"}
          </button>
        </div>
      )}

      {filmesRepetidos && filmesRepetidos.length > 0 && (
        <div className="mt-4 rounded-xl border border-line bg-raised p-3" data-testid="filmes-repetidos">
          <p className="ep-code text-sm text-ink">
            {filmesRepetidos.length}{" "}
            {filmesRepetidos.length === 1 ? "filme repetido" : "filmes repetidos"}
          </p>
          <p className="mt-1 text-xs text-dim">
            O mesmo filme ficou duas vezes — normalmente um em “para ver” e
            outro marcado como visto pela pesquisa. Juntam-se num só, com a
            data de visto, e sai de “para ver”.
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {filmesRepetidos.map((g) => (
              <li key={g.keepKey} className="ep-code text-xs text-faint">
                {g.keepName}
                {g.dropNames.some((n) => n !== g.keepName)
                  ? ` = ${g.dropNames.filter((n) => n !== g.keepName).join(", ")}`
                  : ""}{" "}
                · {g.watchedAt ? `fica visto a ${porExtenso(g.watchedAt)}` : "fica para ver"}
              </li>
            ))}
          </ul>
          <button
            onClick={juntarFilmes}
            className="mt-3 flex min-h-11 w-full cursor-pointer items-center justify-center rounded-full bg-ink px-4 text-[0.9375rem] font-semibold text-tube transition hover:brightness-110 active:scale-95"
          >
            Juntar {filmesRepetidos.length === 1 ? "o filme" : `os ${filmesRepetidos.length} filmes`}
          </button>
        </div>
      )}

      {plan &&
        plan.repairs.length === 0 &&
        duplicados?.length === 0 &&
        filmesRepetidos?.length === 0 && (
        <p className="mt-3 text-[0.9375rem] text-dim">
          Nada a corrigir em {plan.checked} séries.
        </p>
      )}

      {plan && plan.repairs.length > 0 && (
        <div className="mt-4">
          {seguras.length > 0 && (
            <>
              <p className="ep-code text-sm text-ink">
                {totalSeguro} marcações a mais em {seguras.length}{" "}
                {seguras.length === 1 ? "série" : "séries"}
              </p>
              <ul className="mt-2 flex flex-col gap-2">
                {seguras.map((r) => (
                  <li key={r.uuid} className="rounded-xl bg-raised p-3">
                    <Link
                      href={`/series/${r.uuid}`}
                      className="font-display text-[0.9375rem] font-semibold hover:underline"
                    >
                      {r.name}
                    </Link>
                    <p className="ep-code mt-0.5 text-xs text-faint">
                      {r.storedTotal} marcados · o fornecedor tem {r.providerTotal} ·
                      saem {r.extras.length}
                    </p>
                    <p className="mt-1 text-xs text-dim">
                      Fica completa depois de sair o que está a mais — são os
                      mesmos episódios contados duas vezes, não perdes nada.
                    </p>
                  </li>
                ))}
              </ul>
              <button
                onClick={reparar}
                className="mt-3 flex min-h-11 w-full cursor-pointer items-center justify-center rounded-full bg-ink px-4 text-[0.9375rem] font-semibold text-tube transition hover:brightness-110 active:scale-95"
              >
                Remover as {totalSeguro} marcações a mais
              </button>
              <p className="mt-1.5 text-center text-xs text-faint">
                Dá para repor a seguir, com as datas originais.
              </p>
            </>
          )}

          {duvidosas.length > 0 && (
            <div className="mt-4 border-t border-line pt-3">
              <p className="text-[0.9375rem] text-dim">
                Estas ficam como estão — removê-las deixaria buracos, por isso
                podem ser episódios a sério que o fornecedor numera de outra
                maneira:
              </p>
              <ul className="mt-2 flex flex-col gap-1">
                {duvidosas.map((r) => (
                  <li key={r.uuid} className="ep-code text-xs text-faint">
                    {r.name} · {r.storedTotal} marcados, fornecedor{" "}
                    {r.providerTotal} · {r.extras.length} fora do sítio
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
