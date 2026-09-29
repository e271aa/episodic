"use client";

import { Tv } from "lucide-react";
import Acao from "@/components/mira/Acao";

type Segment = "series" | "filmes";
type SeriesFilter =
  | "tudo"
  | "a-ver"
  | "retomar"
  | "por-comecar"
  | "completas"
  | "para-ver"
  | "arquivadas"
  | "parei";

/**
 * Vazio com saída. Um ecrã que só diz "não há nada" deixa o utilizador
 * encalhado — há sempre um passo seguinte a oferecer.
 */
export default function LibraryEmptyState({
  query,
  segment,
  filter,
  onClearFilter,
  onProcurar,
}: {
  query: string | null;
  segment: Segment;
  filter: SeriesFilter;
  onClearFilter: () => void;
  /** abre a procura — a saída de uma biblioteca vazia */
  onProcurar: () => void;
}) {
  const filtrado = segment === "series" && filter !== "tudo";
  return (
    <div className="mt-12 flex flex-col items-center px-6 text-center">
      <Tv aria-hidden className="mb-4 h-11 w-11 text-label-3" strokeWidth={1.5} />
      <p className="text-[1.18rem] font-semibold text-label">
        {query
          ? `Nada na tua biblioteca para “${query}”`
          : filtrado
            ? "Nada neste filtro"
            : segment === "series"
              ? "Ainda não há séries"
              : "Ainda não há filmes"}
      </p>
      <p className="mt-1 max-w-xs text-[0.88rem] text-label-2">
        {query
          ? "Procura no catálogo em baixo para o adicionares."
          : filtrado
            ? "Este filtro está vazio — vê tudo o que tens."
            : // Uma série SEGUE-se, não se "adiciona" — é o verbo do
              // glossário (PRODUCT.md); só o filme se adiciona mesmo.
              segment === "series"
              ? "Procura pelo nome para seguires a primeira."
              : "Procura pelo nome para adicionares o primeiro."}
      </p>
      {!filtrado && !query && (
        <Acao onClick={onProcurar} className="mt-5">
          {segment === "series" ? "Procurar uma série" : "Procurar um filme"}
        </Acao>
      )}
      {filtrado && !query && (
        <Acao onClick={onClearFilter} className="mt-5">
          Ver tudo
        </Acao>
      )}
    </div>
  );
}
