"use client";

import { useState } from "react";
import { degrau, plural, type MapaAnoMes } from "@/lib/graficos";
import { Tabela } from "@/components/Colunas";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
/** as cinco tintas: uma cor só, mais clara ou mais escura (sequencial) */
// o topo a 85%, não a 100%: numa "sala às escuras", 72 quadrados de branco
// cheio encandeiam (Ronda 12, Fecho)
const TINTAS = ["bg-ink/[0.06]", "bg-ink/20", "bg-ink/35", "bg-ink/55", "bg-ink/85"];

const leitura = (ano: number, mes: number, n: number) =>
  `${MESES[mes]} de ${ano} · ${n} ${plural(n, "episódio", "episódios")}`;

/**
 * Quando viste: uma linha por ano, uma célula por mês (Ronda 12, Fase 7).
 * Uma cor só, em quatro degraus (a escala sequencial dos gráficos:
 * uma tinta, mais escura = mais); nada de cores de estado. Cada célula é um
 * botão — tocar diz o mês e o número, e a tabela por baixo tem tudo.
 */
export default function MapaDeCalor({ mapa, titulo }: { mapa: MapaAnoMes; titulo?: string }) {
  // por omissão, o mês mais forte: o gráfico abre já a dizer alguma coisa
  let melhor = { ano: 0, mes: 0, n: -1 };
  for (const a of mapa.anos)
    a.meses.forEach((n, mes) => {
      if (n > melhor.n) melhor = { ano: a.ano, mes, n };
    });
  const [escolhido, setEscolhido] = useState<{ ano: number; mes: number } | null>(null);
  const foco = escolhido ?? { ano: melhor.ano, mes: melhor.mes };
  const focoN = mapa.anos.find((a) => a.ano === foco.ano)?.meses[foco.mes] ?? 0;
  const hoje = new Date();

  return (
    <div>
      {/* o título à esquerda, a leitura fixa à direita (B·5) */}
      <div className="flex items-baseline justify-between gap-3">
        {titulo && <h2 className="shrink-0 text-base font-semibold text-label">{titulo}</h2>}
        <p
          className="ep-code min-h-4 min-w-0 text-right text-xs text-label-2"
          aria-live="polite"
          data-testid="leitura"
        >
          {leitura(foco.ano, foco.mes, focoN)}
        </p>
      </div>
      <div className="mt-3 flex flex-col" role="group" aria-label="Episódios por mês e por ano">
        <div className="flex items-center" aria-hidden>
          <span className="w-7 shrink-0" />
          {MESES.map((m) => (
            <span key={m} className="ep-code flex-1 text-center text-[0.6875rem] text-faint">
              {m[0].toUpperCase()}
            </span>
          ))}
        </div>
        {mapa.anos.map((a) => (
          <div key={a.ano} className="flex items-center">
            <span className="ep-code w-7 shrink-0 text-[0.6875rem] text-faint">{a.ano}</span>
            {a.meses.map((n, mes) => {
              const ativo = foco.ano === a.ano && foco.mes === mes;
              // um mês que ainda não chegou: só o contorno, e não se escolhe
              if (a.ano === hoje.getFullYear() && mes > hoje.getMonth())
                return (
                  <span key={mes} aria-hidden className="flex aspect-square min-w-0 flex-1 p-[1.5px]">
                    <span className="block h-full w-full rounded-[4px] ring-1 ring-inset ring-label/15" />
                  </span>
                );
              return (
                <button
                  key={mes}
                  type="button"
                  data-degrau={degrau(n, mapa)}
                  onClick={() => setEscolhido({ ano: a.ano, mes })}
                  aria-label={leitura(a.ano, mes, n)}
                  aria-pressed={ativo}
                  // o alvo é a coluna inteira, sem espaço morto entre meses
                  // (21px com 3px de intervalo ficava abaixo dos 24px da
                  // WCAG 2.5.8); o quadrado que se vê fica por dentro. A
                  // 390px dá 24px; num ecrã de 320 não cabem 12 de 24 — aí,
                  // a tabela por baixo é a alternativa que a norma aceita
                  // (DESIGN.md, Gráficos)
                  className="flex aspect-square min-w-0 flex-1 cursor-pointer p-[1.5px]"
                >
                  <span
                    className={`block h-full w-full rounded-[4px] ${TINTAS[degrau(n, mapa)]} ${
                      ativo
                        ? "shadow-[0_0_0_2px_var(--color-bg),0_0_0_3px_color-mix(in_srgb,var(--color-label)_90%,transparent)]"
                        : ""
                    }`}
                  />
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <Tabela
        colunaCabecalho="Ano"
        valorCabecalho="Episódios"
        linhas={mapa.anos.map((a) => [String(a.ano), String(a.total)])}
      />
    </div>
  );
}
