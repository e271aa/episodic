"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import JSZip from "jszip";
import {
  mergeMovieLists,
  parseEmotions,
  parseTrackingV1Movies,
  parseTrackingV2,
} from "@/lib/tvtime/parser";
import type { TvTimeExport } from "@/lib/tvtime/types";
import { importExport } from "@/lib/db";
import { TvIcon } from "@/components/icons";

// Ficheiros que sabemos ler: v2 (séries+episódios), v1 (filmes), reações.
const WANTED = [
  "tracking-prod-records-v2.csv",
  "tracking-prod-records.csv",
  "episode_emotion.csv",
] as const;

// Aceita o ZIP do export GDPR tal como vem do TV Time, ou os CSVs soltos.
async function extractCsvs(
  files: File[],
): Promise<{ tracking: string | null; trackingV1: string | null; emotions: string | null }> {
  let tracking: string | null = null;
  let trackingV1: string | null = null;
  let emotions: string | null = null;

  const take = (baseName: string, content: string) => {
    if (baseName === "tracking-prod-records-v2.csv") tracking = content;
    if (baseName === "tracking-prod-records.csv") trackingV1 = content;
    if (baseName === "episode_emotion.csv") emotions = content;
  };

  for (const file of files) {
    if (file.name.toLowerCase().endsWith(".zip")) {
      const zip = await JSZip.loadAsync(file);
      for (const entry of Object.values(zip.files)) {
        if (entry.dir) continue;
        const base = entry.name.split("/").pop() ?? "";
        if ((WANTED as readonly string[]).includes(base)) {
          take(base, await entry.async("string"));
        }
      }
    } else {
      take(file.name, await file.text());
    }
  }
  return { tracking, trackingV1, emotions };
}

export default function ImportPage() {
  const router = useRouter();
  const [preview, setPreview] = useState<TvTimeExport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleFiles = useCallback(async (files: File[]) => {
    setError(null);
    setPreview(null);
    setBusy(true);
    try {
      const { tracking, trackingV1, emotions } = await extractCsvs(files);
      if (!tracking) {
        setError(
          "Não encontrei o ficheiro tracking-prod-records-v2.csv. Envia o ZIP completo do export GDPR do TV Time, ou esse CSV diretamente.",
        );
        return;
      }
      const data = parseTrackingV2(tracking);
      // Os filmes vivem no ficheiro v1 (o v2 não os traz)
      if (trackingV1) {
        data.movies = mergeMovieLists(data.movies, parseTrackingV1Movies(trackingV1));
      }
      if (emotions) data.emotions = parseEmotions(emotions);
      setPreview(data);
    } catch (e) {
      setError(`Erro ao ler o ficheiro: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }, []);

  const confirm = useCallback(async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      await importExport(preview);
      router.push("/series");
    } catch (e) {
      setError(
        `Erro ao guardar a importação: ${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`,
      );
    } finally {
      setBusy(false);
    }
  }, [preview, router]);

  const followed = preview?.shows.filter((s) => s.followed).length ?? 0;
  const watchlist = preview?.shows.filter((s) => s.inWatchlist).length ?? 0;
  const exactDates = preview?.episodes.filter((e) => e.dateIsExact).length ?? 0;
  const unknownEntries = Object.entries(preview?.unknownKeys ?? {});

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <h1 className="font-display text-2xl font-bold">Importar do TV Time</h1>
      <p className="mt-2 text-sm text-dim">
        Envia o ZIP do export GDPR (gdpr.tvtime.com) — ou os CSVs extraídos. Tudo é
        processado aqui no teu browser; nada é enviado para servidores.
      </p>

      <label
        className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line p-10 text-center transition hover:border-signal hover:bg-signal-soft"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void handleFiles(Array.from(e.dataTransfer.files));
        }}
      >
        <TvIcon className="h-10 w-10 text-faint" />
        <span className="mt-3 font-medium">
          Arrasta o ZIP para aqui, ou clica para escolher
        </span>
        <span className="ep-code mt-1 text-xs text-faint">.zip ou .csv</span>
        <input
          type="file"
          accept=".zip,.csv"
          multiple
          className="hidden"
          data-testid="file-input"
          onChange={(e) => {
            if (e.target.files?.length) void handleFiles(Array.from(e.target.files));
          }}
        />
      </label>

      {busy && !preview && (
        <div className="mt-4 flex items-center gap-2 text-sm text-dim">
          <span className="spinner h-4 w-4 shrink-0 rounded-full border-2 border-line border-t-signal" />
          A processar…
        </div>
      )}

      {error && (
        <div className="page-enter mt-4 rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          {error}
        </div>
      )}

      {preview && (
        <div className="page-enter mt-6 rounded-2xl border border-line bg-panel p-5">
          <h2 className="font-display font-semibold">Resumo do export</h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-dim">Séries</dt>
            <dd className="ep-code" data-testid="summary-shows">{preview.shows.length}</dd>
            <dt className="text-dim">— a seguir</dt>
            <dd className="ep-code">{followed}</dd>
            <dt className="text-dim">— na watchlist</dt>
            <dd className="ep-code">{watchlist}</dd>
            <dt className="text-dim">Episódios vistos</dt>
            <dd className="ep-code" data-testid="summary-episodes">{preview.episodes.length}</dd>
            <dt className="text-dim">— com data exata</dt>
            <dd className="ep-code">{exactDates}</dd>
            <dt className="text-dim">Filmes vistos</dt>
            <dd className="ep-code">{preview.movies.length}</dd>
            <dt className="text-dim">Reações</dt>
            <dd className="ep-code">{preview.emotions.length}</dd>
          </dl>

          {unknownEntries.length > 0 && (
            <p className="mt-3 rounded-lg bg-signal-soft p-3 text-xs text-signal">
              Atenção: {unknownEntries.map(([k, n]) => `${n}× ${k}`).join(", ")} —
              tipos de registo que ainda não interpretamos. Nada se perde: podes
              reimportar o mesmo ficheiro quando a app for atualizada.
            </p>
          )}

          <button
            onClick={() => void confirm()}
            disabled={busy}
            data-testid="confirm-import"
            className="mt-5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-signal px-6 py-3 font-semibold text-on-signal transition hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
          >
            {busy && (
              <span className="spinner h-4 w-4 rounded-full border-2 border-on-signal/30 border-t-on-signal" />
            )}
            {busy ? "A guardar…" : "Confirmar importação"}
          </button>
        </div>
      )}
    </main>
  );
}
