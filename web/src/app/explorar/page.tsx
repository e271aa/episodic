"use client";

/**
 * Direção B — "Baralho de bordo a bordo".
 *
 * Cromo: 264px → 74px. Uma só linha: o catálogo como menu (Séries ▾), a
 * lupa, e os ícones de modo. O baralho ocupa tudo o resto, de bordo a bordo,
 * e as ações flutuam sobre ele na zona do polegar — nada por baixo da dock.
 *
 * Perde-se o enquadramento 2:3 (o cartaz é recortado) e a leitura de
 * "objeto" com bordas; ganha-se imagem e um alvo "Para ver" com rótulo.
 */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  alreadyInLibrary,
  loadExplore,
  type ExploreData,
  type ExploreSection,
} from "@/lib/explore";
import { isCloudConfigured } from "@/lib/supabase";
import { searchMulti, type DiscoverItem } from "@/lib/tmdb";
import DiscoverCard from "@/components/DiscoverCard";
import DiscoverSwipeCard, { type DeckItem } from "@/components/DiscoverSwipeCard";
import SwipeCoach, { EXPLORAR_COACH_KEY } from "@/components/SwipeCoach";
import ViewModeToggle, { MODOS, type Modo } from "@/components/ViewModeToggle";
import { useExploreAcoes } from "@/lib/useExploreAcoes";
import { usePref } from "@/lib/prefs";
import {
  CheckIcon,
  ChevronDownIcon,
  CloseIcon,
  CompassIcon,
  PlusIcon,
  SearchIcon,
} from "@/components/icons";
import { Bone, PosterRowBone, TitleBone } from "@/components/Skeleton";

type Kind = "tv" | "movie";

const BAR_COLORS = ["#3fd2c8", "#e6c832", "#d24bd2", "#37c837", "#3c46e6", "#e6483c"];
function barColor(seed: string) {
  let n = 0;
  for (let i = 0; i < seed.length; i++) n = (n + seed.charCodeAt(i)) % BAR_COLORS.length;
  return BAR_COLORS[n];
}

/**
 * Por sessão, não por sempre — fora do componente para sobreviver a uma
 * montagem nova, mas morre quando a app fecha de vez (persistir para lá
 * disso não faz sentido: a lista muda com o gosto entre visitas espaçadas).
 *
 * Medido: trocar para a Biblioteca pela dock e voltar ao Explorar — nem é
 * "recuar", é só espreitar outro separador — repunha o baralho a meio a 1/86
 * depois de já ires em 5/84. `chave` distingue Séries de Filmes e pesquisa
 * de navegação, para uma posição de um baralho nunca aparecer no outro.
 */
const posicaoDoBaralho = new Map<string, number>();

function Baralho({
  chave,
  sections,
  onGuardar,
  onDispensar,
  mostrarTipo = false,
}: {
  /** identifica este baralho — normalmente o catálogo, ou a pesquisa */
  chave: string;
  sections: ExploreSection[];
  onGuardar: (item: DiscoverItem) => void;
  onDispensar: (item: DiscoverItem) => void;
  /** a pesquisa mistura séries e filmes — sem isto não se sabe qual é qual */
  mostrarTipo?: boolean;
}) {
  const baralho: DeckItem[] = useMemo(
    () =>
      sections.flatMap((s) =>
        s.items.map((item) => ({ item, sectionTitle: s.title, sectionReason: s.reason })),
      ),
    [sections],
  );

  // O total pode ter mudado desde a última visita (a lista refina-se com o
  // que se vai vendo) — sem o `min`, uma posição guardada além do total de
  // hoje mostraria logo "Por agora é tudo" em vez de retomar.
  const [cursor, setCursor] = useState(() =>
    Math.min(posicaoDoBaralho.get(chave) ?? 0, baralho.length),
  );

  useEffect(() => {
    posicaoDoBaralho.set(chave, cursor);
  }, [chave, cursor]);

  const decidir = useCallback(
    (deckItem: DeckItem, quero: boolean) => {
      if (quero) onGuardar(deckItem.item);
      else onDispensar(deckItem.item);
      setCursor((c) => c + 1);
    },
    [onGuardar, onDispensar],
  );

  const remaining = baralho.slice(cursor, cursor + 3);
  const topo = remaining[0];

  useEffect(() => {
    if (!topo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") decidir(topo, true);
      else if (e.key === "ArrowLeft") decidir(topo, false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [topo, decidir]);

  const total = baralho.length;

  if (cursor >= total && total > 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <CompassIcon className="h-10 w-10 text-faint" />
        <p className="mt-4 font-display text-lg font-semibold [font-stretch:105%]">
          Por agora é tudo
        </p>
        <p className="mt-1 max-w-xs text-sm text-dim">
          Passaste por {total} sugestões. Marca episódios e volta cá: o que aparece aqui muda
          com o que vais vendo.
        </p>
        <button
          onClick={() => setCursor(0)}
          className="mt-6 min-h-11 cursor-pointer rounded-full bg-ink px-6 text-sm font-semibold text-tube transition hover:brightness-110"
        >
          Rever outra vez
        </button>
      </div>
    );
  }

  return (
    <div className="relative min-h-0 flex-1" data-swipe-stack>
      {remaining.map((deckItem, i) => (
        <DiscoverSwipeCard
          key={`${deckItem.item.kind}-${deckItem.item.tmdbId}`}
          deckItem={deckItem}
          active={i === 0}
          depth={i}
          posicao={cursor + 1 + i}
          total={total}
          variante="bordo"
          mostrarTipo={mostrarTipo}
          onDecide={(quero) => decidir(deckItem, quero)}
        />
      ))}

      {/* As ações flutuam sobre o cartaz, acima da dock. O gesto continua a
          existir; isto é a outra metade, nunca a alternativa única. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[calc(var(--dock-h)+2.25rem)] z-20 flex items-center justify-center gap-5">
        <button
          onClick={() => decidir(topo, false)}
          aria-label="Não me interessa — passa à frente e nunca mais aparece"
          className="pointer-events-auto flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border border-ink/20 bg-tube/70 text-ink backdrop-blur-md transition active:scale-90"
        >
          <CloseIcon className="h-6 w-6" />
        </button>
        <button
          onClick={() => decidir(topo, true)}
          className="pointer-events-auto flex h-14 cursor-pointer items-center gap-2.5 rounded-full bg-ink px-7 text-base font-semibold text-tube transition hover:brightness-110 active:scale-95"
        >
          <PlusIcon className="h-5 w-5" />
          Para ver
        </button>
      </div>

      {/* Progresso do baralho: faixa SMPTE a encher, com o contador em mono */}
      <div className="pointer-events-none absolute inset-x-5 bottom-[calc(var(--dock-h)+0.5rem)] z-20">
        <div className="flex items-center justify-between pb-1.5">
          <span className="ep-code text-[11px] text-faint">
            {cursor + 1} / {total}
          </span>
          <span className="text-[11px] text-faint">arrasta ou decide aqui</span>
        </div>
        <div className="h-[3px] overflow-hidden rounded-full bg-ink/8">
          <div
            className="bars h-full transition-[width] duration-300"
            style={{ width: `${((cursor + 1) / Math.max(total, 1)) * 100}%` }}
          />
        </div>
      </div>

      <SwipeCoach
        kvKey={EXPLORAR_COACH_KEY}
        titulo="Arrasta o cartão"
        detalhe="Descobre séries e filmes um a um, à tua medida."
        esquerda={{
          seta: "←",
          titulo: "Não quero",
          detalhe: "Passa à frente e nunca mais aparece",
        }}
        direita={{ seta: "→", titulo: "Para ver", detalhe: "Guarda na tua lista para ver" }}
      />
    </div>
  );
}

function Grelha({
  sections,
  onGuardar,
  onDispensar,
  mostrarTipo = false,
}: {
  sections: ExploreSection[];
  onGuardar: (item: DiscoverItem) => Promise<void>;
  onDispensar: (item: DiscoverItem) => Promise<void>;
  /** a pesquisa mistura séries e filmes — sem isto não se sabe qual é qual */
  mostrarTipo?: boolean;
}) {
  return (
    <div className="space-y-7 overflow-y-auto pb-[calc(var(--dock-h)+1rem)] pt-4">
      {sections.map((section) => (
        <section key={section.id}>
          <div className="flex items-baseline justify-between gap-3 px-4">
            <h2 className="flex items-center gap-2 font-display text-[13px] font-semibold uppercase tracking-[0.15em] text-ink [font-stretch:80%]">
              <span
                aria-hidden
                className="h-3.5 w-[3px] shrink-0 rounded-full"
                style={{ backgroundColor: barColor(section.title) }}
              />
              {section.title}
            </h2>
            <span className="ep-code shrink-0 text-xs text-faint">
              {section.reason ?? section.items.length}
            </span>
          </div>
          <div className="mt-3 flex gap-3 overflow-x-auto px-4 pb-2">
            {section.items.map((item, i) => (
              <DiscoverCard
                key={`${item.kind}-${item.tmdbId}`}
                item={item}
                index={i}
                onSave={onGuardar}
                onDismiss={onDispensar}
                mostrarTipo={mostrarTipo}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ExplorarContent({ kind }: { kind: Kind }) {
  const router = useRouter();
  const { guardar, naoInteressa } = useExploreAcoes();

  const [data, setData] = useState<ExploreData | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // Grelha por omissão: vê-se tudo de uma vez. O baralho continua lá, num
  // toque, e a escolha fica guardada entre visitas.
  const [modo, setModo] = usePref<Modo>("explorar-modo", "grelha", MODOS);
  const [catalogoAberto, setCatalogoAberto] = useState(false);
  const [pesquisaAberta, setPesquisaAberta] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchState, setSearchState] = useState<{ query: string; items: DiscoverItem[] } | null>(
    null,
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let vivo = true;
    void loadExplore(kind)
      .then((d) => {
        if (vivo) setData(d);
      })
      .catch(() => {
        if (vivo) setErro("Não foi possível carregar. Verifica a ligação.");
      });
    return () => {
      vivo = false;
    };
  }, [kind]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  const termo = debouncedQuery.trim();
  const searching = termo.length >= 2;

  useEffect(() => {
    if (!searching) return;
    let vivo = true;
    // A pesquisa nunca dependeu do catálogo aberto — é o mesmo pedido quer
    // estejas em Séries ou em Filmes. `search/multi` devolve os dois juntos,
    // ordenados pela popularidade real da TMDB (não uma ordenação inventada
    // a juntar dois pedidos separados).
    void searchMulti(termo)
      .then((r) => {
        // Sem este filtro, a pesquisa devolve séries que já estão na
        // biblioteca — foi por aqui que o Arrow e o Prison Break entraram
        // duas vezes. As secções normais já passam pelo mesmo crivo dentro
        // do `loadExplore`; a pesquisa tem de o fazer aqui.
        const filtrados = data
          ? r.filter((x) => x.posterPath && !alreadyInLibrary(x, data.taste))
          : r.filter((x) => x.posterPath);
        if (vivo) setSearchState({ query: termo, items: filtrados });
      })
      .catch(() => {
        if (vivo) setSearchState({ query: termo, items: [] });
      });
    return () => {
      vivo = false;
    };
  }, [searching, termo, data]);

  const searchResults = searchState && searchState.query === termo ? searchState.items : null;

  const escolherKind = (next: Kind) => {
    setCatalogoAberto(false);
    router.replace(next === "movie" ? "/explorar?tipo=filmes" : "/explorar", { scroll: false });
  };

  const sections: ExploreSection[] = searching
    ? searchResults
      ? [{ id: "pesquisa", title: `Resultados para "${termo}"`, items: searchResults }]
      : []
    : (data?.sections ?? []);
  const carregando = searching ? searchResults === null : data === null;
  const totalItens = sections.reduce((n, s) => n + s.items.length, 0);

  return (
    <main
      className="page-enter mx-auto flex w-full max-w-md flex-col overflow-hidden pt-[max(0.25rem,env(safe-area-inset-top))]"
      style={{ height: "100dvh" }}
    >
      {/* O respiro do topo tem de contar com `safe-area-inset-top`: este
          ecrã é o único (com o "Pôr em dia") que define a própria altura
          em `100dvh` — o resto da app vive dentro do `<body>`, que nunca
          precisou de tratar a área segura de cima porque todos os outros
          cabeçalhos já tinham padding de sobra. Sem isto, o campo de
          pesquisa (44px cheios) ficava com o topo por baixo da barra de
          estado do iPhone. Fica no `main`, não na linha: a linha tem
          altura fixa (36/44px), e a área segura de um iPhone com notch
          (47–59px) é maior do que ela — pô-la como padding da própria
          linha esmagava o campo em vez de o empurrar para baixo.

          A linha cresce para 44px com a pesquisa aberta: o campo tem de
          ter 16px de fonte (senão o iOS amplia a página e o ✕ sai do
          ecrã) e 16px não cabem numa linha de 36px. `transition-[height]`
          para o crescimento se ver — sem ela a linha saltava de 36 para
          44px no mesmo instante em que o teclado sobe, e as duas mudanças
          a acontecerem de repente é o que se lê como "esquisito". */}
      <div
        className={`relative z-30 flex shrink-0 items-center gap-2 px-4 transition-[height] duration-150 ease-out ${
          pesquisaAberta ? "h-11" : "h-9"
        }`}
      >
        {pesquisaAberta ? (
          <>
            {/* min-w-0: sem isto o campo recusa-se a encolher abaixo da
                largura do `placeholder` e empurra o ✕ para fora do ecrã */}
            <div className="relative min-w-0 flex-1">
              <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
              <input
                ref={inputRef}
                autoFocus
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={kind === "tv" ? "Procurar uma série…" : "Procurar um filme…"}
                className="relative h-11 w-full rounded-full border border-ink bg-panel/90 pl-9 pr-3 text-base outline-none backdrop-blur-md"
              />
            </div>
            <button
              onClick={() => {
                setPesquisaAberta(false);
                setQuery("");
              }}
              aria-label="Fechar pesquisa"
              className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-dim"
            >
              <CloseIcon className="h-[18px] w-[18px]" />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setCatalogoAberto((v) => !v)}
              aria-expanded={catalogoAberto}
              aria-label="Mudar de catálogo"
              className="tap-44 relative flex flex-1 cursor-pointer items-center gap-1.5 text-ink"
            >
              <span className="font-display text-[22px] font-bold [font-stretch:110%]">
                {kind === "tv" ? "Séries" : "Filmes"}
              </span>
              <ChevronDownIcon
                className={`h-4 w-4 transition-transform ${catalogoAberto ? "rotate-180" : ""}`}
                strokeWidth={2.5}
              />
            </button>
            <button
              onClick={() => setPesquisaAberta(true)}
              aria-label="Procurar no catálogo"
              className="tap-44 relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line bg-raised/80 text-dim backdrop-blur-md"
            >
              <SearchIcon className="h-[17px] w-[17px]" />
            </button>
            <ViewModeToggle modo={modo} onChange={setModo} />
          </>
        )}
      </div>

      {catalogoAberto && (
        <div className="relative z-30 mx-4 mt-2 flex shrink-0 flex-col gap-0.5 rounded-[1.25rem] border border-line bg-panel p-1.5">
          {(
            [
              ["tv", "Séries"],
              ["movie", "Filmes"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => escolherKind(id)}
              aria-pressed={kind === id}
              className={`flex min-h-11 cursor-pointer items-center justify-between rounded-2xl px-3.5 text-[15px] font-semibold transition ${
                kind === id ? "bg-raised text-ink" : "text-dim hover:text-ink"
              }`}
            >
              {label}
              {kind === id && <CheckIcon className="h-4 w-4" />}
            </button>
          ))}
        </div>
      )}

      {!searching && data?.taste.isEmpty && !catalogoAberto && (
        <p className="relative z-30 shrink-0 px-4 pt-1 text-center text-xs text-faint">
          Ainda não sei o que gostas — isto afina-se à medida que marcares episódios.
        </p>
      )}

      {erro ? (
        <div className="mt-16 flex flex-col items-center px-8 text-center">
          <span className="bars mb-4 h-11 w-11 rounded-full opacity-40" aria-hidden />
          <p className="font-display font-semibold">Não deu para carregar</p>
          <p className="mt-1 max-w-xs text-sm text-dim">{erro}</p>
        </div>
      ) : carregando ? (
        modo === "cartoes" ? (
          <Bone className="mt-3 min-h-0 w-full flex-1" />
        ) : (
          <div className="space-y-7 pt-4">
            {[0, 1].map((s) => (
              <div key={s} className="px-4">
                <Bone className="h-4 w-40 rounded" />
                <PosterRowBone />
              </div>
            ))}
          </div>
        )
      ) : totalItens === 0 ? (
        <div className="mt-16 flex flex-col items-center px-8 text-center">
          <CompassIcon className="mb-3 h-10 w-10 text-faint" />
          <p className="font-display font-semibold">
            {searching ? "Nada encontrado" : "Nada para mostrar agora"}
          </p>
          <p className="mt-1 max-w-xs text-sm text-dim">
            {searching
              ? `Sem resultados para "${termo}".`
              : isCloudConfigured()
                ? "Tenta outra vez daqui a pouco."
                : "A TMDB não está configurada nesta instalação."}
          </p>
        </div>
      ) : modo === "cartoes" ? (
        <Baralho
          key={termo}
          chave={`${kind}:${termo}`}
          sections={sections}
          onGuardar={(item) => void guardar(item)}
          onDispensar={(item) => void naoInteressa(item)}
          mostrarTipo={searching}
        />
      ) : (
        <Grelha
          sections={sections}
          onGuardar={guardar}
          onDispensar={naoInteressa}
          mostrarTipo={searching}
        />
      )}
    </main>
  );
}

function ExplorarSwitcher() {
  const params = useSearchParams();
  const kind: Kind = params.get("tipo") === "filmes" ? "movie" : "tv";
  return <ExplorarContent key={kind} kind={kind} />;
}

export default function ExplorarPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-md px-4 pt-2">
          <TitleBone />
          <Bone className="mt-3 h-[60vh] w-full rounded-none" />
        </main>
      }
    >
      <ExplorarSwitcher />
    </Suspense>
  );
}
