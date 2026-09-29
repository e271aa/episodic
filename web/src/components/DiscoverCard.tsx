"use client";

import { useState } from "react";
import Cartaz from "@/components/mira/Cartaz";
import { CheckIcon, PlusIcon } from "@/components/icons";
import type { DiscoverItem } from "@/lib/tmdb";

type Estado = "idle" | "a-guardar" | "guardado" | "seguida";

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

  return (
    <Cartaz
      grande
      fluida={fluida}
      nome={item.name}
      capa={item.posterPath}
      indice={index}
      legenda={legenda}
      rodape={
        <div className="mt-2 flex flex-col">
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
      }
    />
  );
}
