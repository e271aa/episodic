"use client";

/**
 * Explorar (B·4, Mira): «há alguma coisa nova para mim?» Título grande, a
 * pesquisa sempre à vista, a Triagem numa linha, as faixas de sugestões com
 * uma só ação por cartaz e as Listas. A Triagem (o baralho, uma sugestão de
 * cada vez) abre por cima, a ecrã cheio, e fecha para aqui.
 *
 * Sem ligação (B·E3) não há sugestões — não se guardam: a pesquisa desliga-se,
 * dizemo-lo às claras e as Listas, que são locais, continuam.
 */

import Acao from "@/components/mira/Acao";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
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
import Poster from "@/components/Poster";
import TituloGrande from "@/components/mira/TituloGrande";
import Segmentado from "@/components/mira/Segmentado";
import { Grupo, Linha } from "@/components/mira/Grupo";
import { useListas } from "@/lib/cache";
import { useOnline } from "@/lib/useOnline";
import { ChevronLeft, ChevronRight, Search, WifiOff } from "lucide-react";
import DiscoverSwipeCard, { type DeckItem } from "@/components/DiscoverSwipeCard";
import SwipeCoach, { EXPLORAR_COACH_KEY } from "@/components/SwipeCoach";
import { useExploreAcoes } from "@/lib/useExploreAcoes";
import { usePref } from "@/lib/prefs";
import { CloseIcon, CompassIcon, PlusIcon } from "@/components/icons";
import { Bone, PosterRowBone, TitleBone } from "@/components/Skeleton";

type Kind = "tv" | "movie";
type Modo = "cartoes" | "grelha";
// «cartoes» = a Triagem aberta; guardado para sobreviver a espreitar outro separador
const MODOS: readonly Modo[] = ["cartoes", "grelha"];

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
        <CompassIcon className="h-10 w-10 text-label-3" />
        <p className="mt-4 text-[1.18rem] font-semibold text-label">
          Por agora é tudo
        </p>
        <p className="mt-1 max-w-xs text-[0.88rem] text-label-2">
          Passaste por {total} sugestões. Marca episódios e volta cá: o que aparece aqui muda
          com o que vais vendo.
        </p>
        <Acao onClick={() => setCursor(0)} className="mt-6">
          Rever outra vez
        </Acao>
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
          className="pointer-events-auto flex h-14 w-14 cursor-pointer items-center justify-center rounded-full vidro text-label transition active:scale-90"
        >
          <CloseIcon className="h-6 w-6" />
        </button>
        <Acao
          onClick={() => decidir(topo, true)}
          className="pointer-events-auto h-14 px-7"
          icone={<PlusIcon className="h-5 w-5" />}
        >
          Para ver
        </Acao>
      </div>

      {/* Progresso do baralho: faixa SMPTE a encher, com o contador em mono */}
      <div className="pointer-events-none absolute inset-x-5 bottom-[calc(var(--dock-h)+0.5rem)] z-20">
        <div className="flex items-center justify-between pb-1.5">
          <span className="ep-code text-[0.7rem] text-label-2">
            {cursor + 1} / {total}
          </span>
          <span className="text-[0.76rem] text-label-2">arrasta ou decide aqui</span>
        </div>
        <div className="h-[3px] overflow-hidden rounded-full bg-label/[0.14]">
          <div
            className="h-full rounded-full bg-label transition-[width] duration-300"
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

function TituloSecao({ children, direita }: { children: React.ReactNode; direita?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="min-w-0 text-[1.375rem] font-bold leading-tight text-label">{children}</h2>
      {direita}
    </div>
  );
}

/**
 * Uma secção de sugestões. Em faixa (para espreitar, com encaixe) ou, com
 * «Ver tudo», em mosaico — e na pesquisa é sempre mosaico: numa faixa,
 * «matrix» eram 2400px de conteúdo numa janela de 390 (medido).
 */
function Secao({
  section,
  onGuardar,
  onSeguir,
  mostrarTipo = false,
  mosaico = false,
}: {
  section: ExploreSection;
  onGuardar: (item: DiscoverItem) => Promise<void>;
  onSeguir?: (item: DiscoverItem) => Promise<void>;
  mostrarTipo?: boolean;
  /** força o mosaico (pesquisa), sem «Ver tudo» */
  mosaico?: boolean;
}) {
  const [aberta, setAberta] = useState(false);
  const emMosaico = mosaico || aberta;
  return (
    <section>
      <TituloSecao
        direita={
          mosaico ? undefined : (
            <button
              type="button"
              onClick={() => setAberta((v) => !v)}
              aria-expanded={aberta}
              className="tap-44 relative shrink-0 cursor-pointer text-base text-label-2"
            >
              {aberta ? "Ver menos" : "Ver tudo"}
            </button>
          )
        }
      >
        {section.title}
      </TituloSecao>
      {section.reason && <p className="mt-0.5 text-[0.88rem] text-label-2">{section.reason}</p>}
      <div
        className={
          emMosaico
            ? "mt-3 grid grid-cols-3 gap-x-3 gap-y-5"
            : "-mx-4 mt-3 flex scroll-px-4 snap-x snap-mandatory gap-3.5 overflow-x-auto px-4 pb-1"
        }
      >
        {section.items.map((item, i) => (
          <div key={`${item.kind}-${item.tmdbId}`} className={emMosaico ? "" : "snap-start"}>
            <DiscoverCard
              item={item}
              index={i}
              onSave={onGuardar}
              onFollow={item.kind === "tv" ? onSeguir : undefined}
              mostrarTipo={mostrarTipo}
              fluida={emMosaico}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

/** A linha da Triagem (B·4): duas capas sobrepostas e inclinadas, o nome e quantas há. */
function LinhaTriagem({
  capas,
  total,
  onAbrir,
}: {
  capas: (string | null)[];
  total: number;
  onAbrir: () => void;
}) {
  return (
    <Grupo className="mt-4">
      <button
        type="button"
        onClick={onAbrir}
        className="flex min-h-[76px] w-full cursor-pointer items-center gap-4 px-4 text-left transition-colors active:bg-fill"
      >
        <span aria-hidden className="relative h-[52px] w-[60px] shrink-0">
          {capas.slice(0, 2).map((capa, i) => (
            <span
              key={i}
              className={`absolute top-0 h-[52px] w-9 overflow-hidden rounded-md bg-elevated shadow-[0_0_0_1.5px_var(--m-group)] ${
                i === 0 ? "left-0 -rotate-6" : "left-[22px] rotate-[7deg]"
              }`}
            >
              <Poster path={capa} alt="" fill sizes="36px" className="object-cover" priority />
            </span>
          ))}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-label">Triagem</span>
          <span className="block text-[0.88rem] text-label-2">
            {total} sugestões, uma de cada vez
          </span>
        </span>
        <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-label-3" strokeWidth={2.4} />
      </button>
    </Grupo>
  );
}

/** B·E3: sem rede. Honesto e curto — o que funciona, o que volta com a rede. */
function SemLigacao() {
  return (
    <div className="mt-4" role="status">
      <Grupo>
        <div className="flex items-start gap-3 px-4 py-4">
          <WifiOff aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-label-2" strokeWidth={2} />
          <div className="min-w-0">
            <p className="text-base font-semibold text-label">Sem ligação</p>
            <p className="mt-0.5 text-[0.88rem] text-label-2">
              A biblioteca e as marcações funcionam. O que marcares sobe sozinho quando a rede
              voltar.
            </p>
          </div>
        </div>
      </Grupo>
      <p className="mt-2 px-4 text-[0.8125rem] text-label-2">
        «Onde ver» e a Triagem voltam com a rede.
      </p>
    </div>
  );
}

function ListasDoExplorar() {
  const listas = useListas();
  if (!listas) return null;
  return (
    <section className="mt-8">
      <TituloSecao>Listas</TituloSecao>
      <Grupo className="mt-3">
        {listas.length === 0 ? (
          <Linha titulo="Ainda sem listas" depois="Criar" href="/library?tipo=listas" />
        ) : (
          listas.map((l) => (
            <Linha key={l.id} titulo={l.name} depois={l.items.length} href={`/listas/${l.id}`} />
          ))
        )}
      </Grupo>
    </section>
  );
}

function ExplorarContent({ kind, procurar }: { kind: Kind; procurar: boolean }) {
  const router = useRouter();
  const { guardar, seguir, naoInteressa } = useExploreAcoes();
  const online = useOnline();

  const [data, setData] = useState<ExploreData | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // A Triagem aberta ou não; a escolha fica guardada entre visitas.
  const [modo, setModo] = usePref<Modo>("explorar-modo", "grelha", MODOS);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchState, setSearchState] = useState<{ query: string; items: DiscoverItem[] } | null>(
    null,
  );

  useEffect(() => {
    if (!online) return; // sem rede não há nada a pedir; o estado diz-o
    let vivo = true;
    void loadExplore(kind)
      .then((d) => {
        if (vivo) {
          setData(d);
          setErro(null);
        }
      })
      .catch(() => {
        if (vivo) setErro("Não foi possível carregar. Verifica a ligação.");
      });
    return () => {
      vivo = false;
    };
  }, [kind, online]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  const termo = debouncedQuery.trim();
  const searching = online && termo.length >= 2;

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
    router.replace(next === "movie" ? "/explorar?tipo=filmes" : "/explorar", { scroll: false });
  };

  const sections: ExploreSection[] = searching
    ? searchResults
      ? [{ id: "pesquisa", title: `Resultados para "${termo}"`, items: searchResults }]
      : []
    : (data?.sections ?? []);
  const carregando = online && (searching ? searchResults === null : data === null && !erro);
  const totalItens = sections.reduce((n, s) => n + s.items.length, 0);

  // A Triagem: a ecrã cheio, com o seu próprio cabeçalho. Não há triagem sem
  // sugestões — se a lista esvaziou (ou a rede caiu), volta-se ao Explorar.
  if (modo === "cartoes" && !searching && online && totalItens > 0) {
    return (
      <main className="tela-cheia page-enter mx-auto flex w-full max-w-md flex-col overflow-hidden pt-[max(0.25rem,env(safe-area-inset-top))]">
        <div className="relative z-30 flex h-11 shrink-0 items-center gap-1 px-2">
          <button
            type="button"
            onClick={() => setModo("grelha")}
            aria-label="Fechar a Triagem"
            className="tap-44 relative flex h-11 cursor-pointer items-center gap-0.5 rounded-full pl-1 pr-3 text-base text-label"
          >
            <ChevronLeft aria-hidden className="h-6 w-6" strokeWidth={2.2} />
            Explorar
          </button>
          <h1 className="flex-1 pr-16 text-center text-base font-semibold text-label">Triagem</h1>
        </div>
        <Baralho
          key={termo}
          chave={`${kind}:${termo}`}
          sections={sections}
          onGuardar={(item) => void guardar(item)}
          onDispensar={(item) => void naoInteressa(item)}
        />
      </main>
    );
  }

  const primeiras = sections.flatMap((s) => s.items).slice(0, 2);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-[var(--topo-pagina)] pb-8">
      <TituloGrande titulo="Explorar" />

      <div className={`relative mt-3 ${online ? "" : "opacity-50"}`}>
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-label-2"
          strokeWidth={2.2}
        />
        <input
          type="search"
          aria-label="Procurar séries e filmes"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={online ? "Séries e filmes" : "A pesquisa precisa de rede"}
          disabled={!online}
          autoFocus={procurar}
          enterKeyHint="search"
          className="min-h-11 w-full rounded-[22px] bg-fill py-2 pl-10 pr-4 text-base text-label outline-none placeholder:text-label-2"
        />
      </div>

      <Segmentado
        className="mt-3"
        rotulo="Catálogo"
        valor={kind}
        onChange={escolherKind}
        opcoes={[
          { valor: "tv", nome: "Séries" },
          { valor: "movie", nome: "Filmes" },
        ]}
      />

      {!online && <SemLigacao />}

      {online && !searching && data && totalItens > 0 && (
        <LinhaTriagem
          capas={primeiras.map((i) => i.posterPath)}
          total={totalItens}
          onAbrir={() => setModo("cartoes")}
        />
      )}

      {!searching && data?.taste.isEmpty && (
        <p className="mt-3 px-1 text-[0.88rem] text-label-2">
          Ainda não sei do que gostas — isto afina-se à medida que marcares episódios.
        </p>
      )}

      {erro ? (
        <div className="mt-12 flex flex-col items-center px-8 text-center">
          <p className="text-base font-semibold text-label">Não deu para carregar</p>
          <p className="mt-1 max-w-xs text-[0.88rem] text-label-2">{erro}</p>
        </div>
      ) : carregando ? (
        <div className="mt-8 space-y-7">
          {[0, 1].map((s) => (
            <div key={s}>
              <Bone className="h-6 w-40 rounded" />
              <PosterRowBone />
            </div>
          ))}
        </div>
      ) : online && totalItens === 0 ? (
        <div className="mt-12 flex flex-col items-center px-8 text-center">
          <CompassIcon className="mb-3 h-10 w-10 text-label-2" />
          <p className="text-base font-semibold text-label">
            {searching ? "Nada encontrado" : "Nada para mostrar agora"}
          </p>
          <p className="mt-1 max-w-xs text-[0.88rem] text-label-2">
            {searching
              ? `Sem resultados para "${termo}".`
              : isCloudConfigured()
                ? "Tenta outra vez daqui a pouco."
                : "A TMDB não está configurada nesta instalação."}
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {sections.map((section) => (
            <Secao
              key={section.id}
              section={section}
              onGuardar={guardar}
              onSeguir={searching ? seguir : undefined}
              mostrarTipo={searching}
              mosaico={searching}
            />
          ))}
        </div>
      )}

      {!searching && <ListasDoExplorar />}
    </main>
  );
}

function ExplorarSwitcher() {
  const params = useSearchParams();
  const kind: Kind = params.get("tipo") === "filmes" ? "movie" : "tv";
  return <ExplorarContent key={kind} kind={kind} procurar={params.has("procurar")} />;
}

export default function ExplorarPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-2xl px-4 pt-2">
          <TitleBone />
          <Bone className="mt-3 h-[60vh] w-full rounded-none" />
        </main>
      }
    >
      <ExplorarSwitcher />
    </Suspense>
  );
}
