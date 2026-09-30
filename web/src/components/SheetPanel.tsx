"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "@/components/icons";

/**
 * Painel que sobe de baixo. Serve o que saiu do cabeçalho da Biblioteca — os
 * filtros e a ordenação — sem os pôr de volta no fluxo.
 *
 * Sobe de baixo e não desce de cima porque é de baixo que vem o toque: o
 * botão que o abre está na barra flutuante, e o painel aparece a partir dela.
 *
 * Vai por portal para o `body` pela mesma razão que o `LibraryControls`: o
 * `PageTransition` envolve as páginas num elemento com `transform`, e um
 * transform — mesmo identidade — torna-se o bloco de referência de qualquer
 * descendente `position: fixed`. Sem o portal, o painel assentava no fundo
 * do **documento** em vez do fundo do ecrã, e era preciso rolar a página
 * inteira para lá chegar.
 *
 * Movimento (Ronda 12, Fase 6): sobe do fundo com a curva da gaveta do iOS e
 * desce pelo mesmo caminho, mais depressa — entrava como uma página (6px a
 * subir) e desaparecia de golpe. Fecha-se também a arrastar a cabeça para
 * baixo: um piparote rápido chega, não é preciso passar um limiar.
 */

/** quanto dura a descida — tem de bater com `[data-estado="a-fechar"]` no CSS */
const SAIDA_MS = 200;
/** px/ms a partir dos quais um arrasto para baixo fecha, seja qual for a distância */
const VELOCIDADE_FECHA = 0.11;
/** a partir daqui (fração da altura) fecha mesmo devagar */
const DISTANCIA_FECHA = 0.3;
export default function SheetPanel({
  titulo,
  aberto,
  onFechar,
  children,
  agrupada = true,
}: {
  titulo: string;
  aberto: boolean;
  onFechar: () => void;
  children: ReactNode;
  /**
   * Uma folha de listas agrupadas, à iOS (Mira) — é a única, desde a Fase 8: o fundo e os grupos trocam
   * de degrau — sem isto, um `Grupo` dentro da folha tinha a cor dela e
   * desaparecia. Os grupos de dentro leem `--m-group` (o tema é `inline`) e apanham-no daqui.
   */
  agrupada?: boolean;
}) {
  // Fechar com Escape — quem tem teclado espera isto, e é a saída óbvia
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto, onFechar]);

  const painelRef = useRef<HTMLDivElement>(null);
  const antesDeAbrir = useRef<HTMLElement | null>(null);

  // Gestão de foco: sem isto, um teclado ou o VoiceOver ficava no botão por
  // trás do véu, e fechar não devolvia o foco a lado nenhum (Ronda 12, Fase
  // 4, achado #13). Guarda quem tinha o foco, move-o para o painel ao abrir,
  // devolve-o ao fechar.
  useEffect(() => {
    if (!aberto) return;
    antesDeAbrir.current = document.activeElement as HTMLElement | null;
    painelRef.current?.focus();
    return () => antesDeAbrir.current?.focus();
  }, [aberto]);

  // Tab não sai do painel enquanto ele está aberto — o resto da página está
  // atrás de um véu que fecha ao toque, não é um sítio para onde navegar.
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !painelRef.current) return;
      const focaveis = painelRef.current.querySelectorAll<HTMLElement>(
        'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focaveis.length === 0) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto]);

  // O portal só pode montar no cliente: no servidor não há `document`.
  const noCliente = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // Fechar não desmonta logo: a folha fica o tempo de descer. Acertado
  // durante o render (e não num efeito) para não haver um frame em que já
  // está fechada e ainda não começou a sair.
  const [montada, setMontada] = useState(aberto);
  const [aFechar, setAFechar] = useState(false);
  if (aberto && !montada) setMontada(true);
  if (aberto && aFechar) setAFechar(false);
  if (!aberto && montada && !aFechar) setAFechar(true);
  useEffect(() => {
    if (!aFechar) return;
    const t = setTimeout(() => {
      setMontada(false);
      setAFechar(false);
    }, SAIDA_MS);
    return () => clearTimeout(t);
  }, [aFechar]);

  // Com a folha aberta a página de trás não rola: o dedo a rolar a folha
  // "passava" para a página, a barra do Safari recolhia e ficava um vão em
  // baixo. Repõe-se o que lá estava ao fechar.
  useEffect(() => {
    if (!montada) return;
    const el = document.documentElement;
    const antes = el.style.overflow;
    el.style.overflow = "hidden";
    return () => {
      el.style.overflow = antes;
    };
  }, [montada]);

  // Arrastar a cabeça para baixo. Escreve direto no `style` do painel — um
  // re-render por movimento do dedo é trabalho a mais onde um frame perdido
  // se sente logo. A captura do ponteiro só começa quando o dedo se mexe de
  // facto: capturar logo no toque roubava o clique ao ✕ da cabeça.
  const arrasto = useRef<{ id: number; y0: number; t0: number; capturado: boolean } | null>(
    null,
  );
  const deslocar = (dy: number | null) => {
    const painel = painelRef.current;
    if (!painel) return;
    painel.style.transform = dy === null ? "" : `translateY(${dy}px)`;
    painel.style.transition = dy === null ? "" : "none";
  };
  const aoTocar = (e: React.PointerEvent) => {
    if (e.button !== 0 || aFechar) return;
    arrasto.current = { id: e.pointerId, y0: e.clientY, t0: performance.now(), capturado: false };
  };
  const aoMover = (e: React.PointerEvent) => {
    const a = arrasto.current;
    if (!a || a.id !== e.pointerId) return;
    const d = e.clientY - a.y0;
    if (!a.capturado) {
      if (Math.abs(d) < 4) return;
      a.capturado = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    // para cima não há para onde ir: cede um pouco, com atrito, em vez de
    // bater numa parede invisível
    deslocar(d > 0 ? d : -Math.sqrt(-d) * 2);
  };
  const aoLargar = (e: React.PointerEvent) => {
    const a = arrasto.current;
    arrasto.current = null;
    if (!a || a.id !== e.pointerId || !a.capturado) return;
    const d = e.clientY - a.y0;
    const velocidade = d / Math.max(1, performance.now() - a.t0);
    const altura = painelRef.current?.offsetHeight ?? 1;
    // tirar o arrasto do `style` devolve a folha ao CSS: sobe de volta, ou
    // desce a partir de onde o dedo a deixou
    deslocar(null);
    if (d > 0 && (velocidade > VELOCIDADE_FECHA || d > altura * DISTANCIA_FECHA)) onFechar();
  };

  if (!montada || !noCliente) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      data-estado={aFechar ? "a-fechar" : "aberta"}
    >
      {/* O véu escurece o suficiente para o painel ser o assunto, e fecha ao
          toque — a saída não pode depender de acertar num botão pequeno. */}
      <button
        aria-label="Fechar"
        onClick={onFechar}
        className="folha-veu absolute inset-0 cursor-default bg-tube/70 backdrop-blur-sm"
      />
      <div
        ref={painelRef}
        tabIndex={-1}
        data-folha
        className={`folha absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto overscroll-contain rounded-t-[28px] pb-[calc(env(safe-area-inset-bottom)+1.5rem)] outline-none ${
          agrupada ? "folha-agrupada" : "border-t border-line bg-panel"
        }`}
      >
        {/* A cabeça é a pega: `touch-none` para o arrasto não rolar o
            conteúdo por baixo. A barrinha diz que se pode puxar. */}
        <div
          data-folha-pega
          onPointerDown={aoTocar}
          onPointerMove={aoMover}
          onPointerUp={aoLargar}
          onPointerCancel={aoLargar}
          className={`sticky top-0 z-10 flex touch-none items-center justify-between gap-3 px-5 pt-5 pb-4 ${
            agrupada ? "" : "border-b border-line bg-panel"
          }`}
        >
          <span
            aria-hidden
            className="absolute top-2 left-1/2 h-1 w-9 -translate-x-1/2 rounded-full bg-label-3"
          />
          <p className="min-w-0 truncate text-base font-semibold text-label">{titulo}</p>
          <button
            onClick={onFechar}
            aria-label="Fechar"
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-label-2 transition active:scale-95"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        <div className={agrupada ? "px-4 pb-4" : "px-5 py-4"}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
