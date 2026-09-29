"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { imageUrl } from "@/lib/tmdb";
import { formatEpCode } from "@/lib/watchnext";
import type { MetaEpisode } from "@/lib/metadata";
import { CheckIcon } from "@/components/icons";

export interface TonightHeroProps {
  showUuid: string;
  showName: string;
  backdropPath: string | null;
  posterPath: string | null;
  episode: MetaEpisode;
  /** rótulo por cima do título — muda consoante a série seja ativa, parada ou nova */
  eyebrow?: string;
  /** episódios vistos / total, para a barra de progresso */
  watchedCount?: number;
  totalEpisodes?: number | null;
  /**
   * Quantas SÉRIES têm episódios por ver — a pílula de entrada no "Pôr em
   * dia". Dizia "10 em dia", que é o contrário: "em dia" é não ter nada por
   * ver (Ronda 12, Fase 4).
   */
  seriesPorVer?: number;
  /** "Ou então" — por baixo do "Marcar visto", ainda na primeira dobra */
  alternativas?: ReactNode;
  onCheck: (season: number, episode: number) => Promise<void>;
}

/**
 * O ecrã responde a uma pergunta só: o que vejo a seguir?
 *
 * Na direção 2b o episódio ocupa o ecrã inteiro — não é um cartão dentro de
 * uma página, é a página. O texto vive por cima da arte, no terço de baixo,
 * onde o polegar chega e onde o gradiente já escureceu o suficiente para se
 * ler sem tapar a imagem.
 *
 * O ritual de marcar (Ronda 12, Fase 6 — escolhido pelo Ruben a 28-09,
 * variante C): a barra de progresso acende uma vez com as cores SMPTE — cor
 * só onde há progresso —, o ✓ salta, e o episódio troca com um desfoque
 * curto. O varrimento grande continua reservado a fechar uma temporada.
 */
export default function TonightHero({
  showUuid,
  showName,
  backdropPath,
  posterPath,
  episode,
  eyebrow = "Esta noite",
  watchedCount,
  totalEpisodes,
  seriesPorVer = 0,
  alternativas,
  onCheck,
}: TonightHeroProps) {
  const [checking, setChecking] = useState(false);
  // A troca de série (key={showUuid} no chamador) remonta o componente, por
  // isso "lit" nasce sempre a false e só este efeito o liga — sem precisar
  // de o repor manualmente a cada mudança.
  const [lit, setLit] = useState(false);
  const backdrop = imageUrl(backdropPath ?? posterPath, "original");

  useEffect(() => {
    const raf = requestAnimationFrame(() => setLit(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Só marcar festeja. Anular também muda o episódio (volta ao anterior), e
  // por isso o ritual conta marcações, não mudanças de episódio.
  const [marcacoes, setMarcacoes] = useState(0);
  const handleCheck = async () => {
    if (checking) return;
    setChecking(true);
    try {
      await onCheck(episode.season, episode.episode);
      setMarcacoes((n) => n + 1);
    } finally {
      setChecking(false);
    }
  };

  // O episódio que sai fica o tempo de desvanecer por cima do que entra —
  // qualquer mudança, anular incluído. Acertado durante o render, como no
  // SheetPanel, para não haver um frame com os dois trocados de golpe.
  const [mostrado, setMostrado] = useState(episode);
  const [aSair, setASair] = useState<MetaEpisode | null>(null);
  if (episode.season !== mostrado.season || episode.episode !== mostrado.episode) {
    setASair(mostrado);
    setMostrado(episode);
  }
  useEffect(() => {
    if (!aSair) return;
    const t = setTimeout(() => setASair(null), 160);
    return () => clearTimeout(t);
  }, [aSair]);

  const progresso =
    watchedCount !== undefined && totalEpisodes
      ? Math.min(100, (watchedCount / totalEpisodes) * 100)
      : null;

  const agora = new Date();
  const dia = agora.toLocaleDateString("pt-PT", { weekday: "short" }).slice(0, 3).toUpperCase();
  const hora = agora.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="relative -mx-4 -mt-8 min-h-[calc(100dvh-var(--dock-h)-1rem)] overflow-hidden bg-panel">
      {backdrop && (
        <Image
          key={showUuid}
          src={backdrop}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover transition-[transform,opacity] duration-[900ms] ease-out"
          style={{
            transform: lit ? "scale(1)" : "scale(1.05)",
            opacity: lit ? 1 : 0,
          }}
        />
      )}
      {/* o texto vive no terço de baixo: o gradiente escurece aí o suficiente
          para se ler, e deixa a arte respirar em cima */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-tube via-tube/75 via-45% to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-tube/80 to-transparent" />
      <div className="bars absolute inset-x-0 top-0 h-[3px]" />

      {/* Barra de cima: quando é, e a entrada para o modo de foco */}
      <div className="relative flex items-center justify-between px-5 pt-4">
        <span className="ep-code text-[0.8125rem] text-dim">
          {dia} · {hora}
        </span>
        {seriesPorVer > 0 && (
          <Link
            href="/em-dia"
            aria-label={`Pôr em dia: ${seriesPorVer} ${seriesPorVer === 1 ? "série" : "séries"} com episódios por ver`}
            className="flex min-h-11 items-center gap-2 rounded-full border border-line bg-tube/60 px-3 text-[0.8125rem] font-semibold text-ink backdrop-blur transition active:scale-95"
          >
            Pôr em dia
            <span className="ep-code text-dim">{seriesPorVer}</span>
          </Link>
        )}
      </div>

      {/* `pb-16`: o espaço de um aviso de anular por baixo do "Marcar
          visto". Marca-se aqui e o aviso sobe logo acima da dock — com
          `pb-6`, sem "Ou então", tapava a parte de baixo do botão durante os
          7 segundos da janela (medido na Fase 6). */}
      <div className="relative flex min-h-[calc(100dvh-var(--dock-h)-5rem)] flex-col justify-end px-5 pb-16">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-ink/85 [font-stretch:80%]">
          {eyebrow}
        </p>
        {/* `py-1 -my-1`: o título tem 39px de caixa (40px de letra com
            entrelinha apertada) e o alvo recomendado são 44. O padding
            alarga a área de toque e a margem negativa devolve o espaço ao
            layout — cresce o que o dedo apanha, não muda o que se vê. */}
        <Link href={`/series/${showUuid}`} className="mt-2 -my-1 flex min-h-11 items-center">
          <h1 className="font-display text-[2.25rem] font-bold leading-[0.98] tracking-[-0.015em] text-ink [font-stretch:110%]">
            {showName}
          </h1>
        </Link>

        <div className="relative">
          {aSair && (
            <div aria-hidden className="episodio-sai absolute inset-x-0 top-0">
              <BlocoEpisodio episode={aSair} />
            </div>
          )}
          <div
            key={`${episode.season}:${episode.episode}`}
            className={aSair ? "episodio-entra" : undefined}
          >
            <BlocoEpisodio episode={episode} />
          </div>
        </div>

        {progresso !== null && (
          <div className="mt-3 flex items-center gap-2.5">
            <div className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-ink/20">
              <div
                className="h-full bg-ink transition-[width] duration-[240ms] ease-out"
                style={{ width: `${progresso}%` }}
              />
              {marcacoes > 0 && (
                // a chave repete a animação a cada marcação
                <div key={marcacoes} data-ritual="barra" aria-hidden className="barra-acende" />
              )}
            </div>
            <span className="ep-code shrink-0 text-[0.8125rem] text-dim">
              {watchedCount}/{totalEpisodes}
            </span>
          </div>
        )}

        <button
          onClick={() => void handleCheck()}
          disabled={checking}
          className="mt-5 flex h-[60px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-full bg-ink text-[0.9375rem] font-semibold text-tube transition active:scale-[0.98] disabled:opacity-60"
        >
          {checking ? (
            <span className="spinner h-5 w-5 rounded-full border-2 border-tube/30 border-t-tube" />
          ) : (
            <CheckIcon
              key={marcacoes}
              className={`h-5 w-5 ${marcacoes > 0 ? "check-pop" : ""}`}
            />
          )}
          Marcar visto
        </button>

        {alternativas}
      </div>
    </div>
  );
}

/** O código, o ano e o nome do episódio — o que troca a cada marcação. */
function BlocoEpisodio({ episode }: { episode: MetaEpisode }) {
  return (
    <>
      <div className="mt-3 flex items-center gap-2">
        <span className="ep-code rounded-md bg-ink px-[7px] py-0.5 text-[0.9375rem] font-bold text-tube">
          {formatEpCode(episode.season, episode.episode)}
        </span>
        {episode.airDate && (
          <span className="ep-code text-[0.9375rem] text-ink/70">{episode.airDate.slice(0, 4)}</span>
        )}
      </div>
      <p className="mt-2 text-[0.9375rem] font-medium text-ink">{episode.name}</p>
    </>
  );
}
