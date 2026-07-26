"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getStreamingAvailability, imageUrl, type StreamingAvailability } from "@/lib/tmdb";

/**
 * Onde ver, em Portugal — só o que está por assinatura (não aluguer/compra,
 * que a TMDB também devolve mas raramente é a pergunta de quem está a decidir
 * o que ver a seguir). Fica em silêncio se não houver nada: nem toda a gente
 * quer saber, e "sem streaming" não é um facto que mereça um card vazio.
 */
export default function StreamingBadges({
  kind,
  tmdbId,
}: {
  kind: "movie" | "tv";
  tmdbId: number | null | undefined;
}) {
  const [data, setData] = useState<StreamingAvailability | null | undefined>(undefined);

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

  if (!data || data.streaming.length === 0) return null;

  return (
    <div className="mt-4">
      <p className="font-display text-xs font-semibold uppercase tracking-[0.15em] text-dim [font-stretch:80%]">
        Onde ver em Portugal
      </p>
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
    </div>
  );
}
