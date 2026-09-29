"use client";

import { useLayoutEffect, useRef, useState } from "react";

/** Acima disto, os riscos ficam finos de mais para se contar: uma barra contínua. */
export const MAX_SEGMENTOS = 24;
const INTERVALO = 3; // px entre segmentos

/**
 * A gramática de TV da Mira: um segmento por episódio da temporada, vistos em
 * `label`, por ver em `track`. É informação, não decoração — conta-se a
 * temporada de relance. Acima de 24 episódios, uma barra contínua.
 *
 * **O ritual** (a assinatura, Fase 3): quando `ritual` muda, cada segmento
 * visto pinta **a sua fatia** da mira — a mira inteira estende-se pela
 * largura da fila, e cada segmento mostra só o pedaço que lhe cabe, por isso
 * os intervalos de 3px continuam a ser intervalos. A varredura vai só até ao
 * episódio marcado (`aceso`), que fica aceso um pouco mais. Os por ver nunca
 * acendem.
 */
export default function Segmentos({
  total,
  vistos,
  aceso,
  ritual = 0,
  construir = false,
  fino = false,
  rotulo,
}: {
  total: number;
  /** números dos episódios vistos (1 = o primeiro) */
  vistos: Set<number>;
  /** o episódio acabado de marcar — o fim da varredura */
  aceso?: number | null;
  /** muda a cada marcação, para repetir o ritual; 0 = nunca aconteceu */
  ritual?: number;
  /** os segmentos entram da esquerda, um a um (temporada nova) */
  construir?: boolean;
  /** 3px e contínua: a barra por baixo de uma capa */
  fino?: boolean;
  /** o que o leitor de ecrã diz, ex. «6 de 10 vistos na temporada 2» */
  rotulo: string;
}) {
  const fila = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(0);
  useLayoutEffect(() => {
    const el = fila.current;
    if (!el) return;
    const medir = () => setLargura(el.getBoundingClientRect().width);
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const continua = fino || total > MAX_SEGMENTOS;
  const fracao = total > 0 ? Math.min(1, vistos.size / total) : 0;
  const altura = fino ? "h-[3px]" : "h-1";

  if (continua) {
    return (
      <div
        ref={fila}
        role="img"
        aria-label={rotulo}
        data-testid="segmentos"
        className={`relative ${altura} w-full overflow-hidden rounded-[2px] bg-track`}
      >
        <div
          className="h-full bg-label transition-[width] duration-[240ms] ease-out"
          style={{ width: `${fracao * 100}%` }}
        />
        {ritual > 0 && (
          <div
            key={ritual}
            aria-hidden
            data-ritual="barra"
            className="mira-fatia absolute inset-y-0 left-0"
            style={{ width: `${fracao * 100}%`, background: "var(--bars)", backgroundSize: `${largura}px 100%` }}
          />
        )}
      </div>
    );
  }

  const w = total > 0 ? (largura - INTERVALO * (total - 1)) / total : 0;
  const ate = aceso ?? Math.max(0, ...vistos);
  return (
    <div
      ref={fila}
      role="img"
      aria-label={rotulo}
      data-testid="segmentos"
      className={`relative flex ${altura} w-full`}
      style={{ gap: INTERVALO }}
    >
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const visto = vistos.has(n);
        return (
          <i
            key={i}
            data-visto={visto}
            className={`relative h-full flex-1 overflow-hidden rounded-[2px] transition-colors duration-200 ${
              visto ? "bg-label" : "bg-track"
            } ${construir ? "segmento-constroi" : ""}`}
            style={construir ? { animationDelay: `${i * 15}ms` } : undefined}
          >
            {ritual > 0 && visto && n <= ate && largura > 0 && (
              <span
                // a chave repete o ritual a cada marcação
                key={ritual}
                aria-hidden
                data-ritual="fatia"
                className={`absolute inset-0 ${n === ate ? "mira-fica" : "mira-fatia"}`}
                style={{
                  background: "var(--bars)",
                  backgroundSize: `${largura}px 100%`,
                  backgroundPosition: `${-i * (w + INTERVALO)}px 0`,
                  // a varredura corre da esquerda: cada fatia começa um pouco
                  // depois da anterior, até ao episódio marcado
                  animationDelay: `${Math.round((i / Math.max(1, ate)) * 280)}ms`,
                }}
              />
            )}
          </i>
        );
      })}
    </div>
  );
}
