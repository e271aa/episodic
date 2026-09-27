"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { SearchIcon, SortIcon } from "@/components/icons";

/**
 * Os controlos da Biblioteca, a flutuar na zona do polegar.
 *
 * A Biblioteca gastava ~330px de cabeçalho antes do primeiro cartaz: título,
 * três atalhos, pesquisa, segmented, seis chips de filtro e uma linha de
 * contagem. Quase metade do ecrã para configurar a vista de uma coisa que a
 * pessoa só quer ver.
 *
 * Aqui o conteúdo começa em cima e os controlos descem para onde o polegar
 * chega. Fica **um** controlo do que se vê (o segmented) e ícones para o
 * resto — a regra de cromo do sistema.
 *
 * Vai por portal para o `body`: o `PageTransition` envolve as páginas num
 * elemento com `transform`, e um transform — mesmo identidade — torna-se o
 * bloco de referência de qualquer descendente `position: fixed`. Sem o
 * portal, a barra assentava 76px acima do sítio, medido.
 */
export default function LibraryControls({
  segment,
  counts,
  onSegment,
  onSearch,
  onFilters,
  filtrosAtivos,
}: {
  segment: "series" | "filmes";
  counts: { series: number; filmes: number };
  onSegment: (s: "series" | "filmes") => void;
  onSearch: () => void;
  onFilters: () => void;
  /** true = há filtro por aplicar além do predefinido; acende o ponto */
  filtrosAtivos: boolean;
}) {
  // O portal só pode montar no cliente: no servidor não há `document`.
  // `useSyncExternalStore` diz isto sem um setState dentro de um efeito, que
  // é o padrão que já nos deu problemas neste projeto (ver Fase M).
  const noCliente = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  if (!noCliente) return null;

  return createPortal(
    <>
      {/* O degradê é o que faz o corte da grelha ler-se como "há mais por
          baixo" em vez de "acabou aqui". */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 z-30 h-[170px]"
        style={{
          bottom: 0,
          background: "linear-gradient(to top, #101014 32%, rgba(16,16,20,0) 100%)",
        }}
      />
      <div
        className="fixed inset-x-5 z-40 flex h-[52px] items-center gap-1 rounded-full border border-line bg-raised/92 px-1 backdrop-blur-lg"
        style={{ bottom: "calc(var(--dock-h) + 12px)" }}
      >
        {(
          [
            ["series", "Séries", counts.series],
            ["filmes", "Filmes", counts.filmes],
          ] as const
        ).map(([id, label, total]) => (
          <button
            key={id}
            onClick={() => onSegment(id)}
            aria-pressed={segment === id}
            className={`flex h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full text-[0.9375rem] font-semibold transition ${
              segment === id ? "bg-ink/[0.14] text-ink" : "text-dim hover:text-ink"
            }`}
          >
            {label}
            <span className={`ep-code text-xs ${segment === id ? "text-dim" : "text-faint"}`}>
              {total}
            </span>
          </button>
        ))}

        <button
          onClick={onSearch}
          aria-label="Procurar na biblioteca"
          className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-dim transition hover:text-ink active:scale-95"
        >
          <SearchIcon className="h-[18px] w-[18px]" />
        </button>
        <button
          onClick={onFilters}
          aria-label="Filtros e ordenação"
          className="relative flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-dim transition hover:text-ink active:scale-95"
        >
          <SortIcon className="h-[18px] w-[18px]" />
          {filtrosAtivos && (
            <span
              aria-hidden
              className="absolute right-2 top-2 h-[7px] w-[7px] rounded-full"
              style={{ background: "#3fd2c8" }}
            />
          )}
        </button>
      </div>
    </>,
    document.body,
  );
}
