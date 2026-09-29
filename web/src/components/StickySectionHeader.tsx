"use client";

/**
 * O cabeçalho de uma secção da Biblioteca («Em curso 12»), colado por baixo
 * da barra compacta do título enquanto a secção rola. O nome à esquerda a
 * 17/600, a contagem à direita em mono — sem cor: a cor de estado é das
 * barras, dos pontos e do «N por marcar», nunca de um cabeçalho.
 *
 * O `-mx-4 px-4` desfaz e refaz a margem do contentor — pressupõe que quem o
 * usa tem exatamente essa margem (hoje só a Biblioteca).
 */
export default function StickySectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="sticky top-[var(--topo-barra)] z-10 -mx-4 mb-2 mt-4 flex items-baseline gap-2 bg-tube/90 px-4 py-2 backdrop-blur">
      <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-label">{label}</h2>
      <span className="ep-code shrink-0 text-[0.82rem] text-label-2">{count}</span>
    </div>
  );
}
