"use client";

import { useEffect, useState } from "react";
import Cartaz from "@/components/mira/Cartaz";
import Poster from "@/components/Poster";
import SheetPanel from "@/components/SheetPanel";
import StreamingBadges from "@/components/StreamingBadges";
import { CheckIcon, PlusIcon } from "@/components/icons";
import { getMovieDetails, getShowDetails, type DiscoverItem } from "@/lib/tmdb";

type Estado = "idle" | "a-guardar" | "guardado" | "seguida";

interface Numeros {
  /** [valor, rótulo] — o que ajuda a decidir se vale a pena começar */
  blocos: [string, string, string][];
  generos: string[];
  estado: string | null;
}

const ESTADOS: Record<string, string> = {
  "Returning Series": "Em exibição",
  Ended: "Terminada",
  Canceled: "Cancelada",
  Cancelled: "Cancelada",
};

function plural(n: number, um: string, varios: string) {
  return n === 1 ? um : varios;
}

/**
 * Os números da ficha: numa série, temporadas e episódios (é o que decide se
 * se começa); num filme, a duração. Pedidos só quando a ficha abre; sem rede
 * simplesmente não aparecem — a sinopse e a ação continuam.
 */
function FichaNumeros({ item }: { item: DiscoverItem }) {
  const [n, setN] = useState<Numeros | null>(null);
  useEffect(() => {
    let vivo = true;
    const pedido: Promise<Numeros> =
      item.kind === "tv"
        ? getShowDetails(item.tmdbId).then((d) => {
            const minutos = d.episode_run_time?.[0];
            return {
              blocos: [
                [String(d.number_of_seasons), plural(d.number_of_seasons, "temporada", "temporadas"), "temporadas"],
                [String(d.number_of_episodes), plural(d.number_of_episodes, "episódio", "episódios"), "episodios"],
                ...(minutos ? [[String(minutos), "min por episódio", "minutos"] as [string, string, string]] : []),
              ],
              generos: (d.genres ?? []).map((g) => g.name),
              estado: ESTADOS[d.status] ?? null,
            };
          })
        : getMovieDetails(item.tmdbId).then((d) => ({
            blocos: d.runtime ? [[String(d.runtime), "minutos", "minutos"]] : [],
            generos: (d.genres ?? []).map((g) => g.name),
            estado: null,
          }));
    pedido.then((r) => vivo && setN(r)).catch(() => {});
    return () => {
      vivo = false;
    };
  }, [item.kind, item.tmdbId]);

  if (!n || (n.blocos.length === 0 && n.generos.length === 0)) return null;
  return (
    <div className="mt-4">
      {n.blocos.length > 0 && (
        <div className="flex gap-2.5">
          {n.blocos.map(([valor, rotulo, id]) => (
            <div key={id} className="min-w-0 flex-1 rounded-[22px] bg-group px-3 py-3">
              <p data-testid={`ficha-${id}`} className="text-2xl font-bold leading-none text-label [font-family:ui-rounded,system-ui]">
                {valor}
              </p>
              <p className="mt-1 text-[0.8125rem] text-label-2">{rotulo}</p>
            </div>
          ))}
        </div>
      )}
      {(n.generos.length > 0 || n.estado) && (
        <p className="mt-2.5 text-[0.8125rem] text-label-2">
          {[n.estado, ...n.generos.slice(0, 3)].filter(Boolean).join(" · ")}
        </p>
      )}
    </div>
  );
}

/**
 * Um cartaz do Explorar (B·4): **uma só ação** — «+ Para ver» numa cápsula
 * `fill`; depois de tocada, «✓ Na lista», só contorno e sem preenchimento
 * (uma escolha feita, não uma ação). Dispensar já não vive aqui: é na Triagem,
 * onde cada sugestão se decide de propósito.
 *
 * Com `onFollow` (as séries de uma pesquisa) há uma segunda ação: quem procura
 * um título pelo nome normalmente já o está a ver — «Seguir» põe-no na fila,
 * «Para ver» guarda-o para um dia.
 */
export default function DiscoverCard({
  item,
  index,
  onSave,
  onFollow,
  mostrarTipo = false,
  fluida = false,
}: {
  item: DiscoverItem;
  index: number;
  onSave: (item: DiscoverItem) => Promise<void>;
  onFollow?: (item: DiscoverItem) => Promise<void>;
  /** a pesquisa mistura séries e filmes — sem isto não se sabe qual é qual */
  mostrarTipo?: boolean;
  /** numa faixa que rola, o cartaz tem largura fixa; num mosaico, acompanha
   *  a coluna — senão as três colunas ficavam com um vão à direita */
  fluida?: boolean;
}) {
  const [estado, setEstado] = useState<Estado>("idle");
  const [ficha, setFicha] = useState(false);

  const guardar = async () => {
    setEstado("a-guardar");
    await onSave(item);
    setEstado("guardado");
  };

  const seguir = async () => {
    if (!onFollow) return;
    setEstado("a-guardar");
    await onFollow(item);
    setEstado("seguida");
  };

  const legenda = [mostrarTipo ? (item.kind === "movie" ? "Filme" : "Série") : null, item.year]
    .filter(Boolean)
    .join(" · ");

  const botao =
    "flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-full text-[0.9375rem] font-semibold transition-transform active:scale-95";

  const acoes = (
    <div className="flex flex-col">
      {estado === "idle" && onFollow && (
        <>
          <button onClick={() => void seguir()} className={`${botao} bg-fill text-label`}>
            Seguir
          </button>
          <button onClick={() => void guardar()} className={`${botao} text-label-2`}>
            Para ver
          </button>
        </>
      )}
      {estado === "idle" && !onFollow && (
        <button onClick={() => void guardar()} className={`${botao} bg-fill text-label`}>
          <PlusIcon className="h-4 w-4" />
          Para ver
        </button>
      )}
      {estado === "a-guardar" && (
        <span className={`${botao} bg-fill text-label-2 opacity-60`} aria-busy>
          A guardar…
        </span>
      )}
      {(estado === "guardado" || estado === "seguida") && (
        <span
          role="status"
          className={`${botao} cursor-default shadow-[inset_0_0_0_1px_var(--color-label-3)] text-label-2 active:scale-100`}
        >
          <CheckIcon className="check-pop h-4 w-4" />
          {estado === "seguida" ? "Seguida" : "Na lista"}
        </span>
      )}
    </div>
  );

  return (
    <>
      <Cartaz
        grande
        fluida={fluida}
        nome={item.name}
        capa={item.posterPath}
        indice={index}
        legenda={legenda}
        onAbrir={() => setFicha(true)}
        rodape={<div className="mt-2">{acoes}</div>}
      />
      {/* A ficha: sinopse e onde ver, sem guardar nada só por espreitar */}
      <SheetPanel titulo="Detalhes" aberto={ficha} onFechar={() => setFicha(false)} agrupada>
        <div className="px-5 pb-4">
          <div className="flex gap-4">
            <div className="relative aspect-2/3 w-[104px] shrink-0 overflow-hidden rounded-xl bg-group">
              <Poster path={item.posterPath} alt="" fill sizes="104px" className="object-cover" />
            </div>
            <div className="min-w-0">
              <p className="text-[1.375rem] font-bold leading-tight text-label">{item.name}</p>
              <p className="ep-code mt-1 text-[0.8125rem] text-label-2">
                {[item.kind === "movie" ? "Filme" : "Série", item.year].filter(Boolean).join(" · ")}
                {item.rating > 0 && ` · ★ ${item.rating.toFixed(1)}`}
              </p>
            </div>
          </div>
          <FichaNumeros item={item} />
          <p className="mt-4 text-[0.9375rem] leading-relaxed text-label">
            {item.overview ?? "Sem sinopse disponível."}
          </p>
          <div className="mt-4">
            <StreamingBadges kind={item.kind} tmdbId={item.tmdbId} variant="linha" />
          </div>
          <div className="mt-4">{acoes}</div>
        </div>
      </SheetPanel>
    </>
  );
}
