"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  applyRepair,
  getRepairBackup,
  planRepair,
  undoRepair,
  type RepairPlan,
} from "@/lib/repair";

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

  useEffect(() => {
    void getRepairBackup().then((b) => setPodeReverter(b?.episodes.length ?? 0));
  }, []);

  const verificar = useCallback(() => {
    setPlan(null);
    setEstado(null);
    setProgress({ done: 0, total: 0 });
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

  const seguras = plan?.repairs.filter((r) => r.safe) ?? [];
  const duvidosas = plan?.repairs.filter((r) => !r.safe) ?? [];
  const totalSeguro = seguras.reduce((n, r) => n + r.extras.length, 0);

  return (
    <div className="mt-2 rounded-2xl border border-line bg-panel p-4">
      <p className="font-display font-semibold">Verificar episódios</p>
      <p className="mt-1 text-sm text-dim">
        Procura séries com mais episódios marcados do que o fornecedor tem —
        acontece quando o import do TV Time e a app usam numerações diferentes
        e cada uma cria as suas marcações.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={verificar}
          disabled={progress !== null}
          className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line px-4 text-sm font-semibold text-dim transition hover:border-ink hover:text-ink active:scale-95 disabled:opacity-50"
        >
          {progress !== null && (
            <span className="spinner h-3.5 w-3.5 rounded-full border-2 border-dim/30 border-t-dim" />
          )}
          {progress !== null ? `A verificar ${progress.done}/${progress.total}…` : "Verificar"}
        </button>

        {podeReverter > 0 && (
          <button
            onClick={reverter}
            className="flex min-h-11 cursor-pointer items-center rounded-full border border-line px-4 text-sm font-semibold text-dim transition hover:border-ink hover:text-ink active:scale-95"
          >
            Repor {podeReverter} marcações
          </button>
        )}
      </div>

      {estado && <p className="mt-3 text-sm text-ink">{estado}</p>}

      {plan && plan.repairs.length === 0 && (
        <p className="mt-3 text-sm text-dim">
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
                      className="font-display text-sm font-semibold hover:underline"
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
                className="mt-3 flex min-h-11 w-full cursor-pointer items-center justify-center rounded-full bg-ink px-4 text-sm font-semibold text-tube transition hover:brightness-110 active:scale-95"
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
              <p className="text-sm text-dim">
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
