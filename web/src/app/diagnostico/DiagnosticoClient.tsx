"use client";

import { useEffect, useRef, useState } from "react";

interface Leitura {
  instalada: string;
  ecra: string;
  areaSegura: string;
  textoRaiz: string;
  corpoDoSistema: string;
  esquema: string;
  tema: string;
  metasCor: string;
  barraDeEstado: string;
  fundo: string;
}

interface Amostra {
  /** o que estava à vista: sem vidro, as 4 camadas da app, ou essas e mais pequenas */
  fase: Fase;
  fotogramas: number;
  p50: number;
  p95: number;
  max: number;
  lentos: number;
}

type Fase = "sem" | "quatro" | "dezasseis" | "vinteoito";
const FASES: { fase: Fase; nome: string }[] = [
  { fase: "sem", nome: "Sem vidro" },
  { fase: "quatro", nome: "4 camadas (o que a app tem hoje)" },
  { fase: "dezasseis", nome: "16 camadas (4 + 12 pequenas)" },
  { fase: "vinteoito", nome: "28 camadas (4 + 24 pequenas)" },
];

const px = (n: number) => `${Math.round(n * 10) / 10}`;

/** Lê tudo de uma vez, já com o ecrã montado. */
function ler(sonda: HTMLElement, corpo: HTMLElement): Leitura {
  const cs = getComputedStyle(sonda);
  const vv = window.visualViewport;
  const metas = Array.from(document.querySelectorAll('meta[name="theme-color"]')).map(
    (m) => `${m.getAttribute("content")}${m.getAttribute("media") ? ` (${m.getAttribute("media")})` : ""}`,
  );
  const barra = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone;
  return {
    instalada: `navigator.standalone = ${String(standalone)} · display-mode standalone = ${String(
      matchMedia("(display-mode: standalone)").matches,
    )}`,
    ecra: `janela ${window.innerWidth}×${window.innerHeight} · ecrã ${screen.width}×${screen.height} · visualViewport ${
      vv ? `${px(vv.width)}×${px(vv.height)}` : "—"
    } · ×${window.devicePixelRatio}`,
    areaSegura: `cima ${px(parseFloat(cs.paddingTop))} · direita ${px(parseFloat(cs.paddingRight))} · baixo ${px(
      parseFloat(cs.paddingBottom),
    )} · esquerda ${px(parseFloat(cs.paddingLeft))}`,
    textoRaiz: `${px(parseFloat(getComputedStyle(document.documentElement).fontSize))} px`,
    corpoDoSistema: `${px(parseFloat(getComputedStyle(corpo).fontSize))} px`,
    esquema: matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro",
    tema: document.documentElement.getAttribute("data-theme") ?? "automático (sem data-theme)",
    metasCor: metas.length ? metas.join(" · ") : "nenhuma",
    barraDeEstado: barra?.getAttribute("content") ?? "sem meta (o Next não a escreveu)",
    fundo: getComputedStyle(document.body).backgroundColor,
  };
}

/** Rola o palco durante `ms` e mede o tempo de cada fotograma. */
function rolar(palco: HTMLElement, ms: number): Promise<Omit<Amostra, "fase">> {
  return new Promise((resolve) => {
    const deltas: number[] = [];
    const max = palco.scrollHeight - palco.clientHeight;
    let y = 0;
    let sentido = 1;
    let ultimo = performance.now();
    const inicio = ultimo;
    const passo = (t: number) => {
      deltas.push(t - ultimo);
      ultimo = t;
      y += 28 * sentido;
      if (y >= max) sentido = -1;
      if (y <= 0) sentido = 1;
      palco.scrollTop = y;
      if (t - inicio < ms) requestAnimationFrame(passo);
      else {
        const d = deltas.slice(3).sort((a, b) => a - b);
        const q = (p: number) => d[Math.min(d.length - 1, Math.floor(d.length * p))];
        resolve({
          fotogramas: d.length,
          p50: Math.round(q(0.5) * 10) / 10,
          p95: Math.round(q(0.95) * 10) / 10,
          max: Math.round(d[d.length - 1] * 10) / 10,
          lentos: d.filter((x) => x > 20).length,
        });
      }
    };
    requestAnimationFrame(passo);
  });
}

const CORES = ["#3a3a3c", "#5c5c60", "#48484a", "#636366", "#2c2c2e"];

export default function DiagnosticoClient() {
  const sonda = useRef<HTMLDivElement>(null);
  const corpo = useRef<HTMLParagraphElement>(null);
  const palco = useRef<HTMLDivElement>(null);
  const [leitura, setLeitura] = useState<Leitura | null>(null);
  const [amostras, setAmostras] = useState<Amostra[]>([]);
  const [aMedir, setAMedir] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    const atualizar = () => sonda.current && corpo.current && setLeitura(ler(sonda.current, corpo.current));
    atualizar();
    window.addEventListener("resize", atualizar);
    return () => window.removeEventListener("resize", atualizar);
  }, []);

  async function medir() {
    const el = palco.current;
    if (!el || aMedir) return;
    setAMedir(true);
    setAmostras([]);
    for (const { fase } of FASES) {
      el.dataset.fase = fase;
      await new Promise((r) => setTimeout(r, 300));
      const r = await rolar(el, 2500);
      setAmostras((a) => [...a, { fase, ...r }]);
    }
    delete el.dataset.fase;
    setAMedir(false);
  }

  const linhas: [string, string][] = leitura
    ? [
        ["Instalada?", leitura.instalada],
        ["Ecrã", leitura.ecra],
        ["Área segura", leitura.areaSegura],
        ["Texto da raiz (Dynamic Type)", leitura.textoRaiz],
        ["Corpo do sistema (−apple-system-body)", leitura.corpoDoSistema],
        ["Modo do iPhone", leitura.esquema],
        ["Aparência da app", leitura.tema],
        ["theme-color", leitura.metasCor],
        ["Barra de estado (meta)", leitura.barraDeEstado],
        ["Fundo da página", leitura.fundo],
      ]
    : [];

  const relatorio = () =>
    [
      ...linhas.map(([k, v]) => `${k}: ${v}`),
      ...amostras.map(
        (a) =>
          `${FASES.find((f) => f.fase === a.fase)?.nome}: p50 ${a.p50} ms · p95 ${a.p95} ms · máx ${a.max} ms · ${a.lentos}/${a.fotogramas} fotogramas > 20 ms`,
      ),
    ].join("\n");

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-[max(12px,env(safe-area-inset-top))] pb-6">
      {/* As faixas de cor mostram onde acaba o que é do sistema: vermelho = a
          área segura de cima, azul = a de baixo, magenta = a linha y=0 da página.
          Se a linha magenta não se vê, o conteúdo está por baixo da barra de estado. */}
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-40 h-[3px] bg-[#ff00ff]" />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-30 bg-[#ff453a]/70"
        style={{ height: "env(safe-area-inset-top)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 z-30 bg-[#0a84ff]/70"
        style={{ height: "env(safe-area-inset-bottom)" }}
      />

      <h1 className="text-[2rem] leading-[1.1] font-bold text-label">Diagnóstico</h1>
      <p className="mt-1 text-[0.88rem] text-label-2">
        O que só se vê com a PWA instalada. Abre esta página na app do ecrã inicial e depois no Safari:
        são duas leituras diferentes.
      </p>

      {/* a sonda da área segura e a do texto do sistema, fora do ecrã */}
      <div
        ref={sonda}
        aria-hidden
        className="invisible fixed"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingRight: "env(safe-area-inset-right)",
          paddingBottom: "env(safe-area-inset-bottom)",
          paddingLeft: "env(safe-area-inset-left)",
        }}
      />
      <p ref={corpo} aria-hidden className="invisible fixed" style={{ font: "-apple-system-body" }}>
        x
      </p>

      <dl className="mt-5 overflow-hidden rounded-[26px] bg-group" data-testid="leituras">
        {linhas.map(([k, v]) => (
          <div key={k} className="border-b-[0.5px] border-separator px-4 py-2.5 last:border-b-0">
            <dt className="text-[0.76rem] text-label-2">{k}</dt>
            <dd className="text-[0.88rem] break-words text-label">{v}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mt-6 text-[1.05rem] font-semibold text-label">O vidro a rolar</h2>
      <p className="mt-1 text-[0.88rem] text-label-2">
        Rola uma lista de 300 capas 2,5 s de cada vez: sem vidro, com as 4 camadas que a app tem
        (barra, dock, dois botões) e com 16 e 28 (as 12 e 24 pequenas são o selo e o botão de
        cada cartaz «Para ver» da Biblioteca › Filmes). Um fotograma a 60 fps dura 16,7 ms; a 120 Hz, 8,3.
      </p>
      <div className="relative mt-3 h-[300px] overflow-hidden rounded-[22px] bg-group">
        <div ref={palco} className="diag-palco h-full overflow-y-auto">
          <div className="grid grid-cols-3 gap-2 p-2">
            {Array.from({ length: 300 }, (_, i) => (
              <div
                key={i}
                className="aspect-2/3 rounded-xl"
                style={{ background: CORES[i % CORES.length] }}
              />
            ))}
          </div>
        </div>
        {[
          "left-0 right-0 top-0 h-14",
          "left-3 right-3 bottom-3 h-16 rounded-[28px]",
          "left-3 top-16 h-11 w-11 rounded-full",
          "right-3 top-16 h-11 w-24 rounded-full",
        ].map((c) => (
          <div key={c} aria-hidden className={`vidro diag-vidro pointer-events-none absolute ${c}`} />
        ))}
        {/* as pequenas: o selo («Para ver», ~60×20) e o botão (32×32) de cada cartaz */}
        <div aria-hidden className="diag-extras pointer-events-none absolute inset-0">
          {Array.from({ length: 24 }, (_, i) => (
            <div
              key={i}
              className={`vidro diag-vidro absolute ${i % 2 ? "h-8 w-8 rounded-full" : "h-5 w-[60px] rounded-md"}`}
              style={{ left: `${6 + (i % 3) * 32}%`, top: `${16 + Math.floor(i / 3) * 10}%` }}
            />
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={() => void medir()}
        disabled={aMedir}
        className="mt-3 inline-flex min-h-11 cursor-pointer items-center rounded-full bg-acao px-5 font-semibold text-on-label disabled:opacity-50"
      >
        {aMedir ? "A medir…" : "Medir o vidro a rolar"}
      </button>

      <ul className="mt-3 flex flex-col gap-2" data-testid="amostras">
        {amostras.map((a) => (
          <li key={a.fase} className="rounded-[22px] bg-group px-4 py-3 text-[0.88rem] text-label">
            <span className="font-semibold">{FASES.find((f) => f.fase === a.fase)?.nome}</span>
            <span className="ep-code ml-2 text-label-2">
              p50 {a.p50} ms · p95 {a.p95} ms · máx {a.max} ms · {a.lentos}/{a.fotogramas} &gt; 20 ms
            </span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(relatorio()).then(() => setCopiado(true));
        }}
        className="mt-6 inline-flex min-h-11 cursor-pointer items-center rounded-full bg-fill-strong px-5 font-semibold text-label"
      >
        {copiado ? "Copiado" : "Copiar tudo"}
      </button>
    </main>
  );
}
