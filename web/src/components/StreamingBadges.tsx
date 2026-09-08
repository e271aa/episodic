"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getStreamingAvailability, imageUrl, type StreamingAvailability } from "@/lib/tmdb";

function Badges({ data }: { data: StreamingAvailability }) {
  return (
    <>
      <div className="mt-2 flex flex-wrap gap-2.5">
        {data.streaming.map((p) => {
          const logo = imageUrl(p.logoPath, "w185");
          return (
            <a
              key={p.id}
              href={data.link ?? undefined}
              target="_blank"
              rel="noreferrer"
              title={p.name}
              className="block h-11 w-11 shrink-0 overflow-hidden rounded-xl shadow-sm shadow-black/30 transition active:scale-90"
            >
              {logo ? (
                <Image src={logo} alt={p.name} width={44} height={44} className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-raised text-center text-[10px] text-dim">
                  {p.name}
                </span>
              )}
            </a>
          );
        })}
      </div>
      <p className="ep-code mt-1.5 text-[11px] text-faint">Dados da JustWatch, via TMDB</p>
    </>
  );
}

/**
 * Onde ver, em Portugal — só o que está por assinatura (não aluguer/compra,
 * que a TMDB também devolve mas raramente é a pergunta de quem está a decidir
 * o que ver a seguir).
 *
 * `variant="inline"` (por omissão, usada nos filmes) fica em silêncio se não
 * houver nada: nem toda a gente quer saber, e "sem streaming" não é um facto
 * que mereça um cartão vazio.
 *
 * `variant="action"` (Detalhe de série 2b) é o oposto de propósito: é uma das
 * duas ações fixas ao lado do título, por isso tem de estar sempre lá, e um
 * toque nela que não faça nada seria pior do que dizer "não há".
 */
export default function StreamingBadges({
  kind,
  tmdbId,
  variant = "inline",
}: {
  kind: "movie" | "tv";
  tmdbId: number | null | undefined;
  variant?: "inline" | "action";
}) {
  const [data, setData] = useState<StreamingAvailability | null | undefined>(undefined);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      if (!tmdbId) {
        setData(null);
        return;
      }
      void getStreamingAvailability(kind, tmdbId)
        .then(setData)
        .catch(() => setData(null));
    });
    return () => cancelAnimationFrame(raf);
  }, [kind, tmdbId]);

  if (variant === "action") {
    return (
      <div className="flex-1">
        <button
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          className="flex h-12 w-full cursor-pointer items-center justify-center rounded-full border border-line bg-raised/60 text-[15px] font-medium text-ink backdrop-blur transition active:scale-95"
        >
          Onde ver
        </button>
        {aberto && (
          <div className="page-enter mt-3">
            {data === undefined ? (
              <p className="text-[15px] text-dim">A verificar…</p>
            ) : data && data.streaming.length > 0 ? (
              <Badges data={data} />
            ) : !tmdbId ? (
              // Não é a mesma coisa que "não há", e dizer "não há" era mentira:
              // 69 das 74 séries da biblioteca chegaram aqui sem id do TMDB —
              // vieram todas da TVmaze — e todas afirmavam que não estavam em
              // lado nenhum. Sem saber que série é lá fora, não há pergunta a
              // fazer. O backfill preenche o id em segundo plano.
              <p className="text-[15px] text-dim">
                Ainda não identifiquei esta série no catálogo — sem isso não dá
                para saber onde a ver. Volta daqui a pouco.
              </p>
            ) : (
              <p className="text-[15px] text-dim">
                Sem serviços de streaming em Portugal.
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  if (!data || data.streaming.length === 0) return null;

  return (
    <div className="mt-4">
      <p className="font-display text-xs font-semibold uppercase tracking-[0.15em] text-dim [font-stretch:80%]">
        Onde ver em Portugal
      </p>
      <Badges data={data} />
    </div>
  );
}
