"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Check } from "lucide-react";
import { imageUrl } from "@/lib/tmdb";
import { formatEpCode } from "@/lib/watchnext";
import { getEpisodesOfSeason, getSeasons, type MetaEpisode } from "@/lib/metadata";
import { getWatchedForShow, type StoredShow } from "@/lib/db";
import Acao from "@/components/mira/Acao";
import Codigo from "@/components/mira/Codigo";
import Segmentos from "@/components/mira/Segmentos";

export interface TonightHeroProps {
  show: StoredShow;
  episode: MetaEpisode;
  /**
   * A linha de contexto, sempre presente e com a mesma altura: «Parada há 42
   * dias», «Viste o anterior ontem». Era um sobretítulo que só existia em
   * «Retomar»/«Começar» — ao marcar, desaparecia e o botão saltava ~23px
   * debaixo do polegar (crítica da Fase 3).
   */
  contexto: string;
  /** episódios vistos / total da série — o progresso enquanto a temporada não chega */
  watchedCount?: number;
  totalEpisodes?: number | null;
  onCheck: (season: number, episode: number) => Promise<void>;
}

interface Temporada {
  numero: number;
  total: number;
  vistos: Set<number>;
}

/**
 * A temporada do episódio proposto: quantos episódios tem e quais estão
 * vistos. A temporada é contada **por posição** (1.ª, 2.ª…), a mesma regra
 * do `findNextUnwatched` — assim os segmentos nunca contradizem o episódio
 * que o cartão propõe (séries de anime numeradas por ano, 2007, 2008…).
 */
function useTemporada(
  show: StoredShow,
  episode: MetaEpisode,
): { valor: Temporada | null; fresca: boolean } {
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
      if (vivo) setT({ chave, valor: total > 0 ? { numero: episode.season, total, vistos: desta } : null });
    })();
    return () => {
      vivo = false;
    };
    // a chave diz tudo: série, temporada e episódio (muda a cada marcação)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  // enquanto a temporada nova não chega, a anterior continua certa o bastante
  // — e `fresca` diz se já é a do episódio proposto
  return { valor: t?.valor ?? null, fresca: t?.chave === chave };
}

/** quanto tempo a temporada acabada fica à vista, completa, antes de dar lugar à seguinte */
const FIM_MS = 1400;

/**
 * A casa responde a uma pergunta só: o que vejo esta noite? (Mira, Ronda 14)
 *
 * Um cartão: a arte em cima **sem texto por cima**, e por baixo a série, a
 * linha de contexto, o episódio, a temporada em segmentos e a única ação.
 *
 * **O ritual** (a assinatura, Fase 3) acontece **no toque**, não depois de a
 * gravação acabar: o segmento acende, a mira corre fatia a fatia até ele, a
 * contagem rola. Marcar é o que se faz todas as noites — nada espera.
 * **O fim de uma temporada** tem o seu momento: a temporada fica à vista,
 * completa, com «T1 ✓», e os segmentos da seguinte constroem-se da esquerda.
 */
export default function TonightHero({
  show,
  episode,
  contexto,
  watchedCount,
  totalEpisodes,
  onCheck,
}: TonightHeroProps) {
  const aMarcar = useRef(false);
  const [erro, setErro] = useState<string | null>(null);
  // A troca de série (key={show.uuid} no chamador) remonta o componente, por
  // isso "lit" nasce sempre a false e só este efeito o liga.
  const [lit, setLit] = useState(false);
  const backdrop = imageUrl(show.backdropPath ?? show.posterPath, "w780");
  const { valor: temporada, fresca } = useTemporada(show, episode);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setLit(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // O otimista: o episódio marcado acende já, antes de a gravação acabar.
  const [otimista, setOtimista] = useState<{ temporada: number; episodio: number } | null>(null);
  // Só marcar festeja. Anular também muda o episódio, e por isso o ritual
  // conta marcações, não mudanças de episódio.
  const [marcacoes, setMarcacoes] = useState(0);
  // A temporada acabada, mantida à vista durante o momento de fim
  const [fim, setFim] = useState<Temporada | null>(null);
  const [construir, setConstruir] = useState(false);

  const handleCheck = async () => {
    if (aMarcar.current) return;
    aMarcar.current = true;
    setErro(null);
    const alvo = { temporada: episode.season, episodio: episode.episode };
    setOtimista(alvo);
    setMarcacoes((n) => n + 1);
    const vistosDepois =
      temporada && temporada.numero === alvo.temporada
        ? new Set([...temporada.vistos, alvo.episodio])
        : null;
    if (temporada && vistosDepois && vistosDepois.size >= temporada.total) {
      setFim({ ...temporada, vistos: vistosDepois });
    }
    try {
      await onCheck(alvo.temporada, alvo.episodio);
    } catch {
      // Propõe, nunca finge: se não ficou gravado, não fica aceso.
      setOtimista(null);
      setFim(null);
      setErro("Não deu para marcar. Tenta outra vez.");
    } finally {
      aMarcar.current = false;
    }
  };

  // O momento de fim de temporada: acesa e completa, depois dá lugar à
  // seguinte, que se constrói da esquerda
  useEffect(() => {
    if (!fim) return;
    const t = setTimeout(() => {
      setFim(null);
      setConstruir(true);
    }, FIM_MS);
    return () => clearTimeout(t);
  }, [fim]);
  useEffect(() => {
    if (!construir) return;
    const t = setTimeout(() => setConstruir(false), 600);
    return () => clearTimeout(t);
  }, [construir]);

  // O episódio que sai fica o tempo de desvanecer por cima do que entra —
  // qualquer mudança, anular incluído. Acertado durante o render.
  const [mostrado, setMostrado] = useState(episode);
  const [aSair, setASair] = useState<MetaEpisode | null>(null);
  if (episode.season !== mostrado.season || episode.episode !== mostrado.episode) {
    setASair(mostrado);
    setMostrado(episode);
    // anulou-se: voltou ao episódio que estava aceso de forma otimista —
    // apaga-se já, sem esperar pela leitura
    if (otimista && otimista.temporada === episode.season && otimista.episodio === episode.episode) {
      setOtimista(null);
    }
  }
  useEffect(() => {
    if (!aSair) return;
    const t = setTimeout(() => setASair(null), 160);
    return () => clearTimeout(t);
  }, [aSair]);

  // O que os segmentos mostram: a temporada acabada durante o momento de fim;
  // senão a do episódio proposto, com o otimista aceso (1) no toque, enquanto
  // o cartão ainda mostra o episódio marcado — a leitura desse episódio é
  // fresca mas é de antes de o marcar — e (2) depois de o episódio mudar,
  // enquanto a leitura nova não chega (quando chega, `fresca`, já o traz)
  const noToque =
    otimista !== null && otimista.temporada === episode.season && otimista.episodio === episode.episode;
  const mostrada: Temporada | null = fim
    ? fim
    : temporada && otimista && (noToque || !fresca) && otimista.temporada === temporada.numero
      ? { ...temporada, vistos: new Set([...temporada.vistos, otimista.episodio]) }
      : temporada;
  const contagem = fim
    ? `T${fim.numero} ✓`
    : mostrada
      ? `${mostrada.vistos.size}/${mostrada.total}`
      : watchedCount !== undefined && totalEpisodes
        ? `${watchedCount}/${totalEpisodes}`
        : null;
  const aceso = fim ? fim.total : (otimista?.episodio ?? null);

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
          {/* `min-h-11`: o nome é o caminho para a série, e o alvo são 44px
              mesmo quando cabe numa linha */}
          <Link href={`/series/${show.uuid}`} className="flex min-h-11 items-center">
            <h2 className="line-clamp-3 text-[1.65rem] font-bold leading-[1.1] text-label">{show.name}</h2>
          </Link>
          <p className="truncate text-[0.88rem] leading-snug text-label-2" data-testid="contexto-casa">
            {contexto}
          </p>
          <div className="relative mt-2">
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

        {contagem && (
          <div className="flex items-center gap-2" data-testid="progresso-casa" data-fim={fim ? "sim" : undefined}>
            <div className="flex-1">
              <Segmentos
                total={mostrada?.total ?? totalEpisodes ?? 1}
                vistos={mostrada?.vistos ?? new Set(Array.from({ length: watchedCount ?? 0 }, (_, i) => i + 1))}
                aceso={aceso}
                ritual={marcacoes}
                construir={construir}
                rotulo={
                  fim
                    ? `Temporada ${fim.numero} completa`
                    : mostrada
                      ? `${mostrada.vistos.size} de ${mostrada.total} vistos na temporada ${mostrada.numero}`
                      : `${contagem} vistos`
                }
              />
            </div>
            <Codigo className="shrink-0 text-[0.76rem] text-label-2">
              <span key={contagem} className={marcacoes > 0 ? "contagem-rola" : undefined}>
                {contagem}
              </span>
            </Codigo>
          </div>
        )}

        <Acao
          onClick={() => void handleCheck()}
          className="w-full"
          icone={
            <span key={marcacoes} className={`relative ${marcacoes > 0 ? "check-ring" : ""}`}>
              <Check aria-hidden strokeWidth={2.6} className={`h-[22px] w-[22px] ${marcacoes > 0 ? "check-pop" : ""}`} />
            </span>
          }
        >
          Marcar visto
        </Acao>
        {erro && (
          <p role="alert" className="-mt-1 text-center text-[0.88rem] text-danger">
            {erro}
          </p>
        )}
      </div>
    </article>
  );
}

/** O código e o nome do episódio — o que troca a cada marcação. */
function LinhaEpisodio({ episode }: { episode: MetaEpisode }) {
  return (
    <p className="text-base leading-snug text-label-2">
      <Codigo className="mr-2 text-[0.88rem] font-semibold text-label">
        {formatEpCode(episode.season, episode.episode)}
      </Codigo>
      {episode.name}
    </p>
  );
}
