"use client";

import { SearchIcon, SortIcon } from "@/components/icons";

/**
 * Os controlos da Biblioteca: os três separadores, a pesquisa e os filtros.
 *
 * Estiveram a flutuar em baixo, na zona do polegar (Ronda 12, 5b.3), e
 * depois a esconder-se ao rolar (5d). Mesmo assim, ao chegar eram duas
 * barras — esta e a dock — a ocupar ~185 de 664px e a tapar o título da
 * segunda fila (crítica final, 29-09). O Ruben escolheu tirá-los de lá:
 * sobem para o topo, por baixo do título, e em baixo fica só a dock.
 *
 * `sticky`, não uma linha que rola e se perde: com 138 séries, os filtros
 * têm de estar ao alcance a meio da página. Colada ao topo, com um fundo
 * que deixa o conteúdo desvanecer por baixo. Sem portal: um `sticky` vive
 * no fluxo, e o `transform` do `PageTransition` não o afeta (só um
 * `overflow` num antepassado o partiria).
 */

export default function LibraryControls({
  segment,
  counts,
  onSegment,
  onSearch,
  onFilters,
  filtrosAtivos,
}: {
  segment: "series" | "filmes" | "listas";
  counts: { series: number; filmes: number; listas: number };
  onSegment: (s: "series" | "filmes" | "listas") => void;
  onSearch: () => void;
  onFilters: () => void;
  /** true = há filtro por aplicar além do predefinido; acende o ponto */
  filtrosAtivos: boolean;
}) {
  return (
    <>
      <div
        data-testid="barra-biblioteca"
        // `@container`: as contagens dependem da largura **em rem**, não em px —
        // a 150% de texto a barra ficava com 503px num ecrã de 390 (medido, F5)
        className="@container sticky top-[env(safe-area-inset-top)] z-30 -mx-5 mt-3 bg-tube/90 px-5 py-2 backdrop-blur-lg"
      >
      <div className="flex h-[52px] items-center gap-1 rounded-full border border-line bg-raised/92 px-1">
        {(
          [
            ["series", "Séries", counts.series],
            ["filmes", "Filmes", counts.filmes],
            // o 3.º separador, escolhido pelo Ruben a 27-09 (Ronda 12, Fase
            // 5b.3) — antes as listas viviam escondidas na folha de ordenar
            ["listas", "Listas", counts.listas],
          ] as const
        ).map(([id, label, total]) => (
          <button
            key={id}
            onClick={() => onSegment(id)}
            aria-pressed={segment === id}
            className={`flex h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full text-[min(0.9375rem,17px)] font-semibold transition ${
              segment === id ? "bg-ink/[0.14] text-ink" : "text-dim hover:text-ink"
            }`}
          >
            {label}
            {/* Abaixo de 360px as contagens não cabem: com três separadores e
                os números do Ruben (138 · 266 · 3), a 320px empurravam a
                pesquisa e a ordenação 36px para fora da barra (medido). */}
            <span
              className={`ep-code hidden text-xs @[22.5rem]:inline ${segment === id ? "text-dim" : "text-faint"}`}
            >
              {total}
            </span>
          </button>
        ))}

        {segment !== "listas" && (
          <>
            <button
              onClick={onSearch}
              aria-label="Procurar na biblioteca"
              className="flex h-11 w-[44px] shrink-0 cursor-pointer items-center justify-center rounded-full text-dim transition hover:text-ink active:scale-95"
            >
              <SearchIcon className="h-[18px] w-[18px]" />
            </button>
            <button
              onClick={onFilters}
              aria-label="Filtros e ordenação"
              className="relative flex h-11 w-[44px] shrink-0 cursor-pointer items-center justify-center rounded-full text-dim transition hover:text-ink active:scale-95"
            >
              <SortIcon className="h-[18px] w-[18px]" />
              {filtrosAtivos && (
                <span
                  aria-hidden
                  className="absolute right-2 top-2 h-[7px] w-[7px] rounded-full bg-ink"
                />
              )}
            </button>
          </>
        )}
      </div>
      </div>
    </>
  );
}
