"use client";

import { useState } from "react";

export interface Coluna {
  chave: string | number;
  /** o nome inteiro, para a tabela: "2022", "Quarta-feira" */
  nome: string;
  /** o que vai por baixo da coluna, curto: "22", "Seg" */
  rotulo: string;
  valor: number;
  /** o que se lê ao escolher: "2022 · 438 episódios" */
  leitura: string;
}

/**
 * Colunas para comparar magnitudes (Ronda 12, Fase 7). As regras dos
 * gráficos, à medida desta app:
 *
 * - **uma cor só, a neutra**: a coluna em destaque em branco-projetor, as
 *   outras a 35% — nunca uma cor por coluna, e nunca as cores de estado (a
 *   Bars Rule). Antes eram todas o mesmo cinzento, sem nada a dizer qual
 *   era a importante;
 * - **no máximo 24px de largura** e o topo arredondado a 4px, base direita;
 * - **um só número à vista** (o do destaque, ou o da coluna tocada), não um
 *   em cada coluna — os outros leem-se ao tocar, e estão todos na tabela;
 * - **tocar escolhe**: num telemóvel não há hover, por isso cada coluna é um
 *   botão de 44px de alto e a leitura fica escrita por cima.
 */
export default function Colunas({
  titulo,
  dados,
  destaque,
  altura = 72,
  colunaCabecalho,
  valorCabecalho,
}: {
  titulo: string;
  dados: Coluna[];
  /** qual sobressai por omissão: a maior, ou a última (a mais recente) */
  destaque: "maior" | "ultima";
  altura?: number;
  colunaCabecalho: string;
  valorCabecalho: string;
}) {
  const maximo = Math.max(1, ...dados.map((d) => d.valor));
  const porOmissao =
    destaque === "ultima"
      ? dados.length - 1
      : dados.reduce((m, d, i) => (d.valor > dados[m].valor ? i : m), 0);
  const [escolhida, setEscolhida] = useState<number | null>(null);
  const foco = escolhida ?? porOmissao;

  return (
    <div>
      <p className="min-h-4 text-xs tabular-nums text-label-2" aria-live="polite" data-testid="leitura">
        {dados[foco]?.leitura}
      </p>
      <div role="group" aria-label={titulo} className="mt-2 flex items-end justify-between gap-1">
        {dados.map((d, i) => (
          <button
            key={d.chave}
            type="button"
            onClick={() => setEscolhida(i)}
            aria-label={d.leitura}
            aria-pressed={i === foco}
            className="flex min-h-11 flex-1 cursor-pointer flex-col items-center justify-end gap-1.5"
          >
            <span
              className={`w-full max-w-6 rounded-t-[4px] transition-colors ${
                i === foco ? "bg-ink" : "bg-ink/35"
              }`}
              style={{ height: `${Math.max(4, (d.valor / maximo) * altura)}px` }}
            />
            <span className={`ep-code text-[0.6875rem] ${i === foco ? "text-ink" : "text-faint"}`}>
              {d.rotulo}
            </span>
          </button>
        ))}
      </div>
      <Tabela
        colunaCabecalho={colunaCabecalho}
        valorCabecalho={valorCabecalho}
        linhas={dados.map((d) => [d.nome, String(d.valor)])} />
    </div>
  );
}

/** A tabela por baixo de um gráfico: o mesmo dado, para o leitor de ecrã e para quem prefere números. */
export function Tabela({
  colunaCabecalho,
  valorCabecalho,
  linhas,
}: {
  colunaCabecalho: string;
  valorCabecalho: string;
  linhas: string[][];
}) {
  return (
    <details className="mt-1">
      <summary className="flex min-h-11 cursor-pointer items-center text-xs text-faint">
        Ver em tabela
      </summary>
      <table className="ep-code w-full text-xs text-dim">
        <thead>
          <tr className="text-left text-faint">
            <th className="py-1 font-normal">{colunaCabecalho}</th>
            <th className="py-1 text-right font-normal">{valorCabecalho}</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map(([a, b]) => (
            <tr key={a} className="border-t border-line">
              <td className="py-1">{a}</td>
              <td className="py-1 text-right text-ink">{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
