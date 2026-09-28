"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
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
 *
 * Esconde-se ao rolar para baixo e volta ao rolar para cima, como a barra do
 * Safari (escolhido pelo Ruben, Ronda 12, 5d): eram duas barras a flutuar no
 * fundo, ~140px de 664, e os títulos liam-se por baixo delas.
 */

/** px de scroll no mesmo sentido antes de mudar — um tremor não conta */
const LIMIAR_SCROLL = 8;
/** perto do topo, está sempre à vista */
const TOPO = 80;
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
  // O portal só pode montar no cliente: no servidor não há `document`.
  // `useSyncExternalStore` diz isto sem um setState dentro de um efeito, que
  // é o padrão que já nos deu problemas neste projeto (ver Fase M).
  const noCliente = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const [escondida, setEscondida] = useState(false);
  useEffect(() => {
    let ultimo = window.scrollY;
    const aoRolar = () => {
      const y = window.scrollY;
      if (y < TOPO) {
        setEscondida(false);
        ultimo = y;
        return;
      }
      if (Math.abs(y - ultimo) < LIMIAR_SCROLL) return;
      setEscondida(y > ultimo);
      ultimo = y;
    };
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, []);

  if (!noCliente) return null;

  return createPortal(
    <>
      {/* O degradê é o que faz o corte da grelha ler-se como "há mais por
          baixo" em vez de "acabou aqui". */}
      <div
        aria-hidden
        className={`pointer-events-none fixed inset-x-0 z-30 h-[170px] transition-opacity duration-200 ${
          escondida ? "opacity-0" : ""
        }`}
        style={{
          bottom: 0,
          background: "linear-gradient(to top, #101014 32%, rgba(16,16,20,0) 100%)",
        }}
      />
      <div
        data-testid="barra-biblioteca"
        data-escondida={escondida}
        // quem chega por teclado traz a barra de volta — escondida não é
        // inacessível
        onFocus={() => setEscondida(false)}
        className={`fixed inset-x-5 z-40 flex h-[52px] items-center gap-1 rounded-full border border-line bg-raised/92 px-1 backdrop-blur-lg transition-[transform,opacity] duration-200 ease-out ${
          escondida ? "pointer-events-none translate-y-6 opacity-0" : ""
        }`}
        style={{ bottom: "calc(var(--dock-h) + 12px)" }}
      >
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
            className={`flex h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full text-[0.9375rem] font-semibold transition ${
              segment === id ? "bg-ink/[0.14] text-ink" : "text-dim hover:text-ink"
            }`}
          >
            {label}
            {/* Abaixo de 360px as contagens não cabem: com três separadores e
                os números do Ruben (138 · 266 · 3), a 320px empurravam a
                pesquisa e a ordenação 36px para fora da barra (medido). */}
            <span
              className={`ep-code hidden text-xs min-[360px]:inline ${segment === id ? "text-dim" : "text-faint"}`}
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
                  className="absolute right-2 top-2 h-[7px] w-[7px] rounded-full bg-ink"
                />
              )}
            </button>
          </>
        )}
      </div>
    </>,
    document.body,
  );
}
