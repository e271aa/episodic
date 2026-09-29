"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Check } from "lucide-react";
import { imageUrl } from "@/lib/tmdb";
import { formatEpCode } from "@/lib/watchnext";
import { getEpisodesOfSeason, getSeasons, type MetaEpisode } from "@/lib/metadata";
import { getWatchedForShow, type StoredShow } from "@/lib/db";
import Acao from "@/components/mira/Acao";

export interface TonightHeroProps {
  show: StoredShow;
  episode: MetaEpisode;
  /** «Retomar onde ficaste» / «Começar do início» — só quando não é a série do costume */
  eyebrow?: string;
  /** episódios vistos / total da série — o progresso enquanto a temporada não chega */
  watchedCount?: number;
  totalEpisodes?: number | null;
  onCheck: (season: number, episode: number) => Promise<void>;
}

/** Acima disto, os segmentos ficam finos de mais para se contar: uma barra contínua. */
const MAX_SEGMENTOS = 24;

interface Temporada {
  total: number;
  vistos: Set<number>;
}

/**
 * A temporada do episódio proposto: quantos episódios tem e quais estão
 * vistos. A temporada é contada **por posição** (1.ª, 2.ª…), a mesma regra
 * do `findNextUnwatched` — assim os segmentos nunca contradizem o episódio
 * que o cartão propõe (séries de anime numeradas por ano, 2007, 2008…).
 */
function useTemporada(show: StoredShow, episode: MetaEpisode): Temporada | null {
  const [t, setT] = useState<{ chave: string; valor: Temporada | null } | null>(null);
  const chave = `${show.uuid}:${episode.season}:${episode.episode}`;
  useEffect(() => {
    let vivo = true;
    void (async () => {
      const temporadas = await getSeasons(show);
      const alvo = temporadas?.[episode.season - 1];
      if (!alvo) {
        if (vivo) setT({ chave, valor: null });
        return;
      }
      const [episodios, vistos] = await Promise.all([
        getEpisodesOfSeason(show, alvo.number),
        getWatchedForShow(show.uuid),
      ]);
      const total = Math.max(alvo.episodeCount, episodios.length);
      const desta = new Set(vistos.filter((w) => w.season === episode.season).map((w) => w.episode));
      if (vivo) setT({ chave, valor: total > 0 ? { total, vistos: desta } : null });
    })();
    return () => {
      vivo = false;
    };
    // a chave diz tudo: série, temporada e episódio (muda a cada marcação)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  // enquanto a temporada nova não chega, a anterior continua certa o bastante
  return t?.valor ?? null;
}

/**
 * A casa responde a uma pergunta só: o que vejo esta noite? (Mira, Ronda 14)
 *
 * Um cartão: a arte em cima **sem texto por cima** (o texto pequeno sobre a
 * arte perdia-se nas capas claras — crítica final da Ronda 12), e por baixo a
 * série, o episódio, o progresso da temporada em segmentos e a única ação.
 *
 * O ritual de marcar: a cápsula comprime, o ✓ salta com um anel, **a mira
 * revela-se por cima dos segmentos** e apaga, e o episódio troca com um
 * desfoque. Só marcar festeja: anular troca o episódio, mas sem festa.
 */
export default function TonightHero({
  show,
  episode,
  eyebrow,
  watchedCount,
  totalEpisodes,
  onCheck,
}: TonightHeroProps) {
  const [checking, setChecking] = useState(false);
  // A troca de série (key={show.uuid} no chamador) remonta o componente, por
  // isso "lit" nasce sempre a false e só este efeito o liga.
  const [lit, setLit] = useState(false);
  const backdrop = imageUrl(show.backdropPath ?? show.posterPath, "w780");
  const temporada = useTemporada(show, episode);

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
  // qualquer mudança, anular incluído. Acertado durante o render, para não
  // haver um frame com os dois trocados de golpe.
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

  // Com a temporada: um segmento por episódio (ou uma barra contínua, acima
  // de 24). Sem ela (sem fornecedor, ou ainda a chegar): a série inteira.
  const segmentos = temporada && temporada.total <= MAX_SEGMENTOS ? temporada : null;
  const fracao = temporada
    ? temporada.vistos.size / temporada.total
    : watchedCount !== undefined && totalEpisodes
      ? Math.min(1, watchedCount / totalEpisodes)
      : null;
  const contagem = temporada
    ? `${temporada.vistos.size}/${temporada.total}`
    : watchedCount !== undefined && totalEpisodes
      ? `${watchedCount}/${totalEpisodes}`
      : null;

  return (
    // `@container`: com texto grande (150%) o cartão fica estreito em rem, e
    // a arte sai para a série e a ação caberem (estado B·E6 da Mira)
    <article className="@container overflow-hidden rounded-[28px] bg-group" data-testid="cartao-casa">
      <Link
        href={`/series/${show.uuid}`}
        tabIndex={-1}
        aria-hidden
        className="relative block h-44 overflow-hidden bg-elevated @max-[16rem]:hidden [@media(max-height:700px)]:h-28"
      >
        {backdrop && (
          <Image
            key={show.uuid}
            src={backdrop}
            alt=""
            fill
            loading="eager"
            fetchPriority="high"
            sizes="(max-width: 640px) 100vw, 640px"
            className="object-cover transition-[transform,opacity] duration-[900ms] ease-out"
            style={{ transform: lit ? "scale(1)" : "scale(1.05)", opacity: lit ? 1 : 0 }}
          />
        )}
      </Link>

      <div className="flex flex-col gap-3.5 px-[18px] pb-[18px] pt-4">
        <div>
          {eyebrow && (
            <p className="mb-1 text-[0.76rem] font-semibold uppercase tracking-[0.02em] text-label-2">
              {eyebrow}
            </p>
          )}
          {/* `min-h-11`: o nome é o caminho para a série, e o alvo são 44px
              mesmo quando cabe numa linha */}
          <Link href={`/series/${show.uuid}`} className="flex min-h-11 items-center">
            <h2 className="line-clamp-3 text-[1.65rem] font-bold leading-[1.1] text-label">{show.name}</h2>
          </Link>
          <div className="relative mt-1">
            {aSair && (
              <div aria-hidden className="episodio-sai absolute inset-x-0 top-0">
                <LinhaEpisodio episode={aSair} />
              </div>
            )}
            <div key={`${episode.season}:${episode.episode}`} className={aSair ? "episodio-entra" : undefined}>
              <LinhaEpisodio episode={episode} />
            </div>
          </div>
        </div>

        {fracao !== null && (
          <div className="flex items-center gap-2">
            <div
              className="relative flex h-1 flex-1 gap-[3px]"
              role="img"
              aria-label={`${contagem} vistos${temporada ? ` na temporada ${episode.season}` : ""}`}
              data-testid="progresso-casa"
            >
              {segmentos ? (
                Array.from({ length: segmentos.total }, (_, i) => (
                  <i
                    key={i}
                    data-visto={segmentos.vistos.has(i + 1)}
                    className={`h-full flex-1 rounded-[2px] transition-colors duration-200 ${
                      segmentos.vistos.has(i + 1) ? "bg-label" : "bg-track"
                    }`}
                  />
                ))
              ) : (
                <div className="h-full flex-1 overflow-hidden rounded-[2px] bg-track">
                  <div
                    className="h-full bg-label transition-[width] duration-[240ms] ease-out"
                    style={{ width: `${fracao * 100}%` }}
                  />
                </div>
              )}
              {marcacoes > 0 && (
                // a mira, por cima dos segmentos; a chave repete-a a cada marcação
                <div key={marcacoes} data-ritual="barra" aria-hidden className="barra-acende rounded-[2px]" />
              )}
            </div>
            <span className="ep-code shrink-0 text-[0.76rem] text-label-2">{contagem}</span>
          </div>
        )}

        <Acao
          onClick={() => void handleCheck()}
          disabled={checking}
          className="w-full"
          icone={
            checking ? (
              <span className="spinner h-5 w-5 rounded-full border-2 border-on-label/30 border-t-on-label" />
            ) : (
              <span key={marcacoes} className={`relative ${marcacoes > 0 ? "check-ring" : ""}`}>
                <Check aria-hidden strokeWidth={2.6} className={`h-[22px] w-[22px] ${marcacoes > 0 ? "check-pop" : ""}`} />
              </span>
            )
          }
        >
          Marcar visto
        </Acao>
      </div>
    </article>
  );
}

/** O código e o nome do episódio — o que troca a cada marcação. */
function LinhaEpisodio({ episode }: { episode: MetaEpisode }) {
  return (
    <p className="text-base leading-snug text-label-2">
      <span className="ep-code mr-2 text-[0.88rem] font-semibold text-label">
        {formatEpCode(episode.season, episode.episode)}
      </span>
      {episode.name}
    </p>
  );
}
