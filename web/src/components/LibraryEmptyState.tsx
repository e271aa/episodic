"use client";

type Segment = "series" | "filmes";
type SeriesFilter = "tudo" | "a-ver" | "completas" | "para-ver" | "arquivadas" | "parei";

/**
 * Vazio com saída. Um ecrã que só diz "não há nada" deixa o utilizador
 * encalhado — há sempre um passo seguinte a oferecer.
 */
export default function LibraryEmptyState({
  query,
  segment,
  filter,
  onClearFilter,
}: {
  query: string | null;
  segment: Segment;
  filter: SeriesFilter;
  onClearFilter: () => void;
}) {
  const filtrado = segment === "series" && filter !== "tudo";
  return (
    <div className="mt-12 flex flex-col items-center px-6 text-center">
      <span className="bars mb-4 h-11 w-11 rounded-full opacity-40" aria-hidden />
      <p className="font-display font-semibold">
        {query
          ? `Nada na tua biblioteca para “${query}”`
          : filtrado
            ? "Nada neste filtro"
            : segment === "series"
              ? "Ainda não há séries"
              : "Ainda não há filmes"}
      </p>
      <p className="mt-1 max-w-xs text-[15px] text-dim">
        {query
          ? "Procura no catálogo em baixo para o adicionares."
          : filtrado
            ? "Este filtro está vazio — vê tudo o que tens."
            : "Procura pelo nome para adicionares o primeiro."}
      </p>
      {filtrado && !query && (
        <button
          onClick={onClearFilter}
          className="mt-5 min-h-11 cursor-pointer rounded-full bg-ink px-6 text-[15px] font-semibold text-tube transition hover:brightness-110"
        >
          Ver tudo
        </button>
      )}
    </div>
  );
}
