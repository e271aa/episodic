"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { checkSeasonAlignment, type IntegrityReport } from "@/lib/integrity";

/**
 * Verificação de temporadas desalinhadas. É de leitura — não corrige nada.
 *
 * Existe porque a correção não se pode desenhar às cegas: o Naruto mostra
 * "Temporada 1 · 57/13" porque a numeração com que foi visto já não é a que
 * nenhum fornecedor publica, e antes de mexer em anos de histórico é preciso
 * saber quantas séries estão no mesmo caso e de que forma.
 */
export default function IntegrityCheck() {
  const [report, setReport] = useState<IntegrityReport | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const correr = useCallback(() => {
    setReport(null);
    setProgress({ done: 0, total: 0 });
    void checkSeasonAlignment((done, total) => setProgress({ done, total }))
      .then((r) => {
        setReport(r);
        setProgress(null);
      })
      .catch(() => setProgress(null));
  }, []);

  const copiar = useCallback(() => {
    if (!report) return;
    const linhas = report.affected.map((s) => {
      const temporadas = s.mismatches
        .map((m) => `T${m.season}: vistos ${m.watched}, maior episódio ${m.maxEpisode}, fornecedor ${m.providerCount ?? "não tem"}`)
        .join("; ");
      return `${s.name} — ${s.watchedTotal} vistos de ${s.providerTotal ?? "?"} · com ID TheTVDB: ${s.withTvdbId} · ${temporadas}`;
    });
    void navigator.clipboard.writeText(
      [`${report.affected.length} séries desalinhadas em ${report.checked} verificadas`, ...linhas].join("\n"),
    );
  }, [report]);

  return (
    <div className="mt-2 rounded-2xl border border-line bg-panel p-4">
      <p className="font-display font-semibold">Verificar temporadas</p>
      <p className="mt-1 text-sm text-dim">
        Procura séries onde os episódios vistos não encaixam nas temporadas do
        fornecedor — o caso do Naruto, com 57 vistos numa temporada de 13.
      </p>

      <button
        onClick={correr}
        disabled={progress !== null}
        className="mt-3 flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line px-4 text-sm font-semibold text-dim transition hover:border-ink hover:text-ink active:scale-95 disabled:opacity-50"
      >
        {progress !== null && (
          <span className="spinner h-3.5 w-3.5 rounded-full border-2 border-dim/30 border-t-dim" />
        )}
        {progress !== null
          ? `A verificar ${progress.done}/${progress.total}…`
          : "Verificar agora"}
      </button>

      {report && (
        <div className="mt-4">
          {report.affected.length === 0 ? (
            <p className="text-sm text-dim">
              Nenhuma série desalinhada em {report.checked} verificadas.
            </p>
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <p className="ep-code text-sm text-ink">
                  {report.affected.length} de {report.checked} desalinhadas
                </p>
                <button
                  onClick={copiar}
                  className="inline-flex min-h-11 cursor-pointer items-center text-xs text-dim hover:text-ink hover:underline"
                >
                  Copiar
                </button>
              </div>
              <ul className="mt-1 flex flex-col gap-2">
                {report.affected.map((s) => (
                  <li key={s.uuid} className="rounded-xl bg-raised p-3">
                    <Link
                      href={`/series/${s.uuid}`}
                      className="font-display text-sm font-semibold hover:underline"
                    >
                      {s.name}
                    </Link>
                    <p className="ep-code mt-0.5 text-xs text-faint">
                      {s.watchedTotal} vistos · fornecedor tem{" "}
                      {s.providerTotal ?? "?"} · {s.withTvdbId} com ID TheTVDB
                    </p>
                    <ul className="mt-1.5 flex flex-col gap-0.5">
                      {s.mismatches.map((m) => (
                        <li key={m.season} className="ep-code text-xs text-dim">
                          T{m.season}: {m.watched} vistos, vai até ao episódio{" "}
                          {m.maxEpisode} — o fornecedor{" "}
                          {m.providerCount === null
                            ? "nem tem esta temporada"
                            : `só tem ${m.providerCount}`}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
