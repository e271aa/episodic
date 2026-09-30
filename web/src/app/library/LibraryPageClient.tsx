"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { kvGet, kvSet, type StoredMovie } from "@/lib/db";
import type { ShowWithProgress } from "@/lib/shows";
import {
  recursoFilmes,
  recursoSeries,
  useFilmes,
  useListas,
  useNextUp,
  useSeries,
} from "@/lib/cache";
import { formatEpCode } from "@/lib/watchnext";
import { estaParada } from "@/lib/queue";
import { backfillMovies, backfillShows } from "@/lib/backfill";
import { curarNumeracao } from "@/lib/numeracao";
import { usePref } from "@/lib/prefs";
import {
  searchMovies,
  searchShows,
  type MetaMovieResult,
  type MetaSearchResult,
} from "@/lib/metadata";
import {
  decadeLabel,
  groupByBucket,
  groupSorted,
  letterLabel,
  periodLabel,
} from "@/lib/grouping";
import StickySectionHeader from "@/components/StickySectionHeader";
import ShowPoster from "@/components/ShowPoster";
import MovieCard from "@/components/MovieCard";
import ShowResultCard from "@/components/ShowResultCard";
import MovieResultCard from "@/components/MovieResultCard";
import LibraryEmptyState from "@/components/LibraryEmptyState";
import ListasConteudo from "@/components/ListasConteudo";
import Acao from "@/components/mira/Acao";
import MenuFiltro from "@/components/mira/MenuFiltro";
import Segmentado from "@/components/mira/Segmentado";
import TituloGrande from "@/components/mira/TituloGrande";
import { PosterGridBone, TitleBone } from "@/components/Skeleton";
import { ChevronDown, Search } from "lucide-react";

type Segment = "series" | "filmes" | "listas";
type SeriesFilter =
  | "tudo"
  | "a-ver"
  | "retomar"
  | "por-comecar"
  | "completas"
  | "para-ver"
  | "arquivadas"
  | "parei";
type MovieFilter = "vistos" | "para-ver" | "todos";
/** Filmes não têm "estado" como as séries — o eixo útil é quando saíram */
type MovieSort = "vistos" | "recentes" | "antigos" | "az";
type SeriesSort = "vistos" | "progresso" | "az" | "adicionadas";

const SERIES_SORTS: { id: SeriesSort; label: string }[] = [
  { id: "vistos", label: "Última vista" },
  { id: "progresso", label: "Mais episódios vistos" },
  { id: "az", label: "A–Z" },
  { id: "adicionadas", label: "Adicionada" },
];

const MOVIE_SORTS: { id: MovieSort; label: string }[] = [
  { id: "vistos", label: "Última vista" },
  { id: "recentes", label: "Estreia mais recente" },
  { id: "antigos", label: "Estreia mais antiga" },
  { id: "az", label: "A–Z" },
];

/** Três colunas (B·3), com 18px entre linhas e 10px entre colunas. A escolha
 *  de «Cartazes grandes / pequenos / Lista» saiu: o desenho não a tem, e a
 *  procura por nome passou a ser a pesquisa, sempre à vista no topo. */
const CLASSE_GRELHA = "grid grid-cols-3 gap-x-2.5 gap-y-[18px] sm:grid-cols-4 md:grid-cols-5";

/** A ordem por que as secções de estado aparecem, e a cor de cada uma.
 *  "Em curso" é o próprio branco-projetor — a mesma regra da barra de
 *  progresso: a meio de ver não tem cor, só progresso. "Completas" usa o
 *  magenta de sinal, a mesma cor da barra quando uma série terminada está em
 *  dia. O resto não tem sinal: cinza neutro (Ronda 12, Fase 5b — a versão
 *  anterior deste comentário dizia "verde = a andar", que contradizia o que
 *  o código fazia; medido na Fase 4).
 *
 *  A ordem é a da atenção que cada uma pede, e mudou por medição: com
 *  "Completas" em segundo lugar, 9377px dos 12311px da Biblioteca (76%)
 *  eram séries já acabadas, e tudo o que vinha depois — o que ainda não
 *  começou, o que se deixou a meio — ficava atrás de catorze ecrãs de
 *  arquivo. Primeiro o que se está a ver, depois o que espera, e só então
 *  o que já acabou. */
const ESTADOS = [
  "Em curso",
  "Retomar",
  "Por começar",
  "Para ver",
  "Completas",
  "Já não sigo",
  "Arquivadas",
];
/** A partir de quantas séries é que a secção das completas se dobra. Abaixo
 *  disto, o botão de abrir custa mais do que a lista que esconde. */
const DOBRAR_A_PARTIR_DE = 12;

// Sobe quando a forma de escolher o filme no TMDB muda: obriga a rever os
// filmes já enriquecidos uma vez, em vez de deixar os erros antigos fossilizados.
const ENRICH_VERSION = 2;
const ENRICH_KEY = "movies:enrich-v";

// Normaliza para pesquisar sem acentos nem maiúsculas — "pokemon" encontra "Pokémon"
function norm(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const SERIES_SORT_IDS = new Set(SERIES_SORTS.map((s) => s.id));
const MOVIE_SORT_IDS = new Set(MOVIE_SORTS.map((s) => s.id));

const completa = (s: ShowWithProgress) =>
  s.totalEpisodes != null && s.watchedCount >= s.totalEpisodes;
/** Seguida, com episódios vistos e por acabar — parada ou não. */
const aMeio = (s: ShowWithProgress) =>
  s.followed && !s.archived && !completa(s) && s.watchedCount > 0;

function LibraryContent() {
  const router = useRouter();
  const params = useSearchParams();

  // O estado de navegação vive no URL: partilhável, sobrevive a recargas e
  // faz o gesto de recuar funcionar dentro da própria Biblioteca.
  const tipo = params.get("tipo");
  const segment: Segment = tipo === "filmes" || tipo === "listas" ? tipo : "series";
  const rawFiltro = params.get("filtro") as SeriesFilter | null;
  const filter: SeriesFilter =
    rawFiltro &&
    ["a-ver", "retomar", "por-comecar", "completas", "para-ver", "arquivadas", "parei"].includes(
      rawFiltro,
    )
      ? rawFiltro
      : "tudo";
  const movieFilter: MovieFilter =
    rawFiltro && ["vistos", "para-ver", "todos"].includes(rawFiltro)
      ? (rawFiltro as MovieFilter)
      : // "Todos" por omissão: com "Vistos", a Biblioteca dizia "Filmes 14" e
        // mostrava 10, sem dizer que os 4 "para ver" estavam de fora (Ronda
        // 12, Fase 4, achado #12)
        "todos";
  const rawOrdem = params.get("ordem");
  const seriesSort: SeriesSort =
    rawOrdem && SERIES_SORT_IDS.has(rawOrdem as SeriesSort)
      ? (rawOrdem as SeriesSort)
      : "vistos";
  const movieSort: MovieSort =
    rawOrdem && MOVIE_SORT_IDS.has(rawOrdem as MovieSort)
      ? (rawOrdem as MovieSort)
      : "vistos";
  const decade = Number(params.get("decada")) || null;

  // Trocar de separador empilha uma entrada (o gesto de recuar volta ao
  // anterior); filtro, ordem e pesquisa **substituem** a atual. Substituem-se
  // com `history.replaceState` (o Next integra-o em `useSearchParams`) e não
  // com `router.replace`: este entra numa fila de navegações em que uma nova
  // descarta a anterior ainda pendente — escrever, tocar numa série e
  // recuar chegava a perder a pesquisa. E lê-se o URL de agora, não o do
  // último render, para dois toques seguidos não se pisarem.
  const setParams = useCallback(
    (patch: Record<string, string | null>, push = false) => {
      const next = new URLSearchParams(window.location.search);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      const url = next.size > 0 ? `/library?${next}` : "/library";
      if (push) router.push(url, { scroll: false });
      else window.history.replaceState(null, "", url);
    },
    [router],
  );

  // Da cache partilhada, e não de uma leitura só desta página: ao voltar de
  // uma série ou de um filme, a grelha tem de estar montada no primeiro
  // instante. É isso — e não o scroll em si — que faz a posição aguentar
  // (ver a nota longa em `lib/cache.ts`).
  const shows = useSeries();
  const movies = useFilmes();
  const listas = useListas();
  // «Parada» = sem marcar há mais de 30 dias, a mesma regra do «Retomar» da
  // casa (`estaParada`). Fixa-se ao abrir: uma série não muda de secção a meio
  // de uma visita.
  const [agora] = useState(() => Date.now());
  const parada = useCallback(
    (s: ShowWithProgress) => aMeio(s) && estaParada(s.lastWatchedAt || null, agora),
    [agora],
  );
  // O próximo episódio de cada série, se a fila do «A seguir» já o calculou
  const nextUp = useNextUp();
  const proximo = (s: ShowWithProgress): string | null => {
    const e = nextUp?.get(s.uuid)?.episode;
    return e ? formatEpCode(e.season, e.episode) : null;
  };
  // O que se procurou também vive no URL (`q`): «onde está aquela série?» acaba
  // quase sempre em abri-la e recuar, e a pesquisa não pode ter-se perdido.
  // O estado local é a fonte de verdade enquanto se escreve; o URL segue-o.
  const [query, setQuery] = useState(() => params.get("q") ?? "");
  const campoPesquisa = useRef<HTMLInputElement>(null);
  /**
   * As completas dobradas. É `usePref` e não estado local pela mesma razão
   * que a densidade: quem as fechou não as quer abertas outra vez ao voltar
   * de uma série. Reordenar não chegava — 57 séries acabadas são catorze
   * ecrãs de rolagem entre o que interessa e o resto, estejam em que
   * posição estiverem.
   */
  const [completas, setCompletas] = usePref<"dobradas" | "abertas">(
    "biblioteca-completas",
    "dobradas",
    ["dobradas", "abertas"],
  );
  // Pesquisa remota é secundária: só corre quando o utilizador a pede
  const [remote, setRemote] = useState<MetaSearchResult[] | null>(null);
  const [remoteMovies, setRemoteMovies] = useState<MetaMovieResult[] | null>(null);
  const [remoteBusy, setRemoteBusy] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const enriching = useRef(false);

  const reloadMovies = useCallback(() => {
    void recursoFilmes.revalidar();
  }, []);

  // Enriquecer o que falta (capas, datas, totais) arranca assim que a cache
  // traz a biblioteca, e uma vez só por visita — a bandeira nunca volta a
  // `false`: cada lote revalida a cache, o que muda `shows`/`movies` e faria
  // este efeito correr outra vez em cima de si próprio.
  useEffect(() => {
    if (!shows || !movies || enriching.current) return;
    enriching.current = true;
    void (async () => {
      // Primeiro a numeração: é a única destas coisas que, errada, muda o
      // que as tuas marcações querem dizer (ver lib/numeracao.ts)
      if ((await curarNumeracao()) > 0) void recursoSeries.revalidar();

      // As séries também se completam aqui, não só no "A seguir": quem entra
      // direto na Biblioteca — que é onde as capas se veem todas de uma vez —
      // não disparava enriquecimento nenhum, e ficava à espera de uma visita
      // a outro ecrã que podia nunca acontecer.
      await backfillShows(shows, () => {
        void recursoSeries.revalidar();
      });

      // Completa capas e datas de estreia em falta via TMDB. A capa vivia na
      // antiga página /movies, que quase não tinha entradas — filmes sem capa
      // nunca eram enriquecidos. A data de estreia é a mesma história: muitos
      // filmes importados do TV Time nunca a trouxeram, e sem ela o filtro de
      // décadas usava a data em que marcaste como visto (errado).
      //
      // Uma revisão em massa quando a regra de escolha do filme muda: os que
      // já estavam enriquecidos guardaram o filme ERRADO (o "Ciao Alberto"
      // ficou com o homónimo de 2003 em vez do spin-off do Luca de 2021) e
      // como têm capa e data nunca mais seriam tocados.
      const rever = ((await kvGet<number>(ENRICH_KEY)) ?? 0) < ENRICH_VERSION;
      await backfillMovies(movies, rever, () => {
        void recursoFilmes.revalidar();
      });
      if (rever) await kvSet(ENRICH_KEY, ENRICH_VERSION);
    })();
  }, [shows, movies]);

  // Filtrar o que já tens é instantâneo (é tudo local) — sem botão, sem espera
  const q = norm(query.trim());

  const filteredShows = useMemo(() => {
    if (!shows) return [];
    const complete = completa;
    let list = shows;
    if (filter === "a-ver") {
      // Sem as paradas (têm balde próprio, «Retomar») nem as que ainda não
      // começaram: a conta da pastilha tem de dizer o mesmo que a secção.
      list = list.filter((s) => aMeio(s) && !parada(s));
    } else if (filter === "retomar") {
      list = list.filter(parada);
    } else if (filter === "por-comecar") {
      list = list.filter(
        (s) => s.followed && !s.archived && !complete(s) && s.watchedCount === 0,
      );
    } else if (filter === "completas") {
      list = list.filter((s) => complete(s));
    } else if (filter === "para-ver") {
      list = list.filter((s) => s.inWatchlist && !s.followed);
    } else if (filter === "arquivadas") {
      list = list.filter((s) => s.archived);
    } else if (filter === "parei") {
      list = list.filter((s) => !s.followed && !s.inWatchlist);
    }
    // o nome do TV Time e os da TMDB — procurar "Ruptura Total" tem de
    // encontrar o "Breaking Bad" que já lá está
    if (q)
      list = list.filter((s) => [s.name, ...(s.tmdbAliases ?? [])].some((n) => norm(n).includes(q)));
    const sorted = [...list];
    if (seriesSort === "vistos") {
      sorted.sort((a, b) => b.lastWatchedAt.localeCompare(a.lastWatchedAt));
    } else if (seriesSort === "progresso") {
      sorted.sort((a, b) => b.watchedCount - a.watchedCount);
    } else if (seriesSort === "az") {
      sorted.sort((a, b) => a.name.localeCompare(b.name, "pt"));
    } else {
      sorted.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
    }
    return sorted;
  }, [shows, filter, q, seriesSort, parada]);

  // Ano do filme: preferimos a estreia; sem ela, o ano em que o viste (um
  // filme "para ver" pode não ter nenhuma das duas ainda)
  const movieYear = (m: StoredMovie): number =>
    Number((m.releaseDate ?? m.watchedAt ?? "").slice(0, 4));

  /** Décadas presentes na coleção, da mais recente para a mais antiga */
  const decades = useMemo(() => {
    if (!movies) return [];
    const set = new Set<number>();
    for (const m of movies) {
      const year = movieYear(m);
      if (Number.isFinite(year)) set.add(Math.floor(year / 10) * 10);
    }
    return [...set].sort((a, b) => b - a);
  }, [movies]);

  const filteredMovies = useMemo(() => {
    if (!movies) return [];
    let list = movies;
    if (movieFilter === "vistos") list = list.filter((m) => m.watchedAt);
    else if (movieFilter === "para-ver") list = list.filter((m) => !m.watchedAt);
    if (decade !== null) {
      list = list.filter((m) => {
        const year = movieYear(m);
        return year >= decade && year < decade + 10;
      });
    }
    if (q)
      list = list.filter((m) => [m.name, ...(m.aliases ?? [])].some((n) => norm(n).includes(q)));
    const sorted = [...list];
    if (movieSort === "vistos") {
      // Os "para ver" primeiro — é o que pede atenção, como o "Em curso" nas
      // séries — pela data em que entraram; depois o que já viste, do mais
      // recente para o mais antigo.
      sorted.sort((a, b) => {
        if (!a.watchedAt !== !b.watchedAt) return a.watchedAt ? 1 : -1;
        return (b.watchedAt ?? b.addedAt ?? "").localeCompare(a.watchedAt ?? a.addedAt ?? "");
      });
    } else if (movieSort === "recentes") {
      sorted.sort((a, b) => movieYear(b) - movieYear(a));
    } else if (movieSort === "antigos") {
      sorted.sort((a, b) => movieYear(a) - movieYear(b));
    } else {
      sorted.sort((a, b) => a.name.localeCompare(b.name, "pt"));
    }
    return sorted;
  }, [movies, q, decade, movieSort, movieFilter]);

  const counts = useMemo(() => {
    const complete = completa;
    return {
      tudo: shows?.length ?? 0,
      "a-ver": shows?.filter((s) => aMeio(s) && !parada(s)).length ?? 0,
      retomar: shows?.filter(parada).length ?? 0,
      "por-comecar":
        shows?.filter((s) => s.followed && !s.archived && !complete(s) && s.watchedCount === 0)
          .length ?? 0,
      completas: shows?.filter(complete).length ?? 0,
      "para-ver": shows?.filter((s) => s.inWatchlist && !s.followed).length ?? 0,
      arquivadas: shows?.filter((s) => s.archived).length ?? 0,
      parei: shows?.filter((s) => !s.followed && !s.inWatchlist).length ?? 0,
    } as Record<SeriesFilter, number>;
  }, [shows, parada]);

  const movieCounts = useMemo(
    () => ({
      vistos: movies?.filter((m) => m.watchedAt).length ?? 0,
      "para-ver": movies?.filter((m) => !m.watchedAt).length ?? 0,
      todos: movies?.length ?? 0,
    }),
    [movies],
  );

  // Procura no catálogo do segmento em que estás: séries na aba das séries,
  // filmes na aba dos filmes.
  const searchRemote = useCallback(async () => {
    const term = query.trim();
    if (!term) return;
    setRemoteBusy(true);
    setRemoteError(null);
    try {
      if (segment === "series") setRemote(await searchShows(term));
      else setRemoteMovies(await searchMovies(term));
    } catch {
      if (segment === "series") setRemote([]);
      else setRemoteMovies([]);
      setRemoteError("Não foi possível pesquisar — verifica a ligação à internet.");
    } finally {
      setRemoteBusy(false);
    }
  }, [query, segment]);

  // Mudar o texto invalida os resultados remotos anteriores (é um evento,
  // não um efeito — o estado deriva diretamente da ação do utilizador)
  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value);
      setRemote(null);
      setRemoteMovies(null);
      setRemoteError(null);
      setParams({ q: value.trim() ? value : null });
    },
    [setParams],
  );

  // Trocar de segmento também invalida: os resultados eram do outro catálogo.
  // push (e não replace) para o gesto de recuar voltar ao segmento anterior.
  const changeSegment = useCallback(
    (id: Segment) => {
      setRemote(null);
      setRemoteMovies(null);
      setRemoteError(null);
      setParams(
        { tipo: id === "series" ? null : id, filtro: null, ordem: null, decada: null },
        true,
      );
    },
    [setParams],
  );

  const loading = shows === null || movies === null;
  const showing = segment === "series" ? filteredShows.length : filteredMovies.length;

  // Secções derivadas da ordem ativa: por tempo dá períodos, A–Z dá letras,
  // estreia dá décadas. A pesquisar não se agrupa — são poucos resultados e
  // as bandas só atrapalhavam.
  /** O estado da série, para as secções da grelha. É o agrupamento por
   *  omissão: sem filtro aplicado, "o que estou a ver", "o que ainda não
   *  comecei" e "o que já acabei" são as perguntas que a Biblioteca responde.
   *
   *  "Por começar" saiu de dentro do "A ver": uma série seguida com zero
   *  episódios marcados não está a ser vista, está à espera — e ficava
   *  escondida no meio das que estão mesmo a andar (medido: 17 no balde,
   *  5 delas sem nada visto). */
  const estadoLabel = (s: ShowWithProgress): string => {
    if (s.archived) return "Arquivadas";
    if (!s.followed) return s.inWatchlist ? "Para ver" : "Já não sigo";
    if (s.totalEpisodes && s.watchedCount >= s.totalEpisodes) return "Completas";
    // "Em curso" e não "A ver": ao lado de "Para ver" liam-se quase iguais
    // (Ronda 12, Fase 5 — palavra escolhida pelo Ruben).
    if (s.watchedCount === 0) return "Por começar";
    return parada(s) ? "Retomar" : "Em curso";
  };

  const showGroups = useMemo(
    () =>
      q
        ? null
        : filter === "tudo" && seriesSort === "vistos"
          ? groupByBucket(filteredShows, estadoLabel, ESTADOS)
          : groupSorted(filteredShows, {
            vistos: (s: ShowWithProgress) => periodLabel(s.lastWatchedAt || null),
            adicionadas: (s: ShowWithProgress) => periodLabel(s.addedAt),
            az: (s: ShowWithProgress) => letterLabel(s.name),
            progresso: null,
          }[seriesSort]),
    [filteredShows, seriesSort, filter, q, parada],
  );

  const movieGroups = useMemo(
    () =>
      q
        ? null
        : groupSorted(filteredMovies, {
            vistos: (m: StoredMovie) => (m.watchedAt ? periodLabel(m.watchedAt) : "Para ver"),
            recentes: (m: StoredMovie) => decadeLabel(movieYear(m)),
            antigos: (m: StoredMovie) => decadeLabel(movieYear(m)),
            az: (m: StoredMovie) => letterLabel(m.name),
          }[movieSort]),
    [filteredMovies, movieSort, q],
  );
  /** resultados remotos do segmento atual — null enquanto ninguém pesquisou */
  const searched = segment === "series" ? remote : remoteMovies;

  const FILTERS: { valor: SeriesFilter; nome: string; contagem: number }[] = (
    [
      ["tudo", "Todas"],
      ["a-ver", "Em curso"],
      ["retomar", "Retomar"],
      ["por-comecar", "Por começar"],
      ["completas", "Completas"],
      ["para-ver", "Para ver"],
      ["arquivadas", "Arquivadas"],
      ["parei", "Já não sigo"],
    ] as const
  ).map(([valor, nome]) => ({ valor, nome, contagem: counts[valor] }));

  const MOVIE_FILTERS: { valor: MovieFilter; nome: string; contagem: number }[] = (
    [
      ["todos", "Todos"],
      ["vistos", "Vistos"],
      ["para-ver", "Para ver"],
    ] as const
  ).map(([valor, nome]) => ({ valor, nome, contagem: movieCounts[valor] }));

  // A linha que a barra compacta mostra quando o título grande sai do ecrã
  // («Todas · 138»): o filtro em que se está e quantas séries mostra.
  const resumo =
    segment === "listas"
      ? `Listas · ${listas?.length ?? 0}`
      : `${
          (segment === "series" ? FILTERS : MOVIE_FILTERS).find(
            (f) => f.valor === (segment === "series" ? filter : movieFilter),
          )?.nome
        } · ${showing}`;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-[var(--topo-pagina)] pb-8">
      <TituloGrande titulo="Biblioteca" resumo={resumo} />

      {segment !== "listas" && (
        <div className="relative mt-3">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-label-2"
            strokeWidth={2.2}
          />
          <input
            ref={campoPesquisa}
            type="search"
            aria-label="Procurar na biblioteca"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Procurar na biblioteca"
            enterKeyHint="search"
            className="min-h-11 w-full rounded-[22px] bg-fill py-2 pl-10 pr-4 text-base text-label outline-none placeholder:text-label-2"
            data-testid="search-input"
          />
        </div>
      )}

      <Segmentado
        className="mt-3"
        rotulo="Tipo de biblioteca"
        valor={segment}
        onChange={changeSegment}
        opcoes={[
          { valor: "series", nome: "Séries", contagem: shows?.length ?? 0 },
          { valor: "filmes", nome: "Filmes", contagem: movies?.length ?? 0 },
          { valor: "listas", nome: "Listas" },
        ]}
      />

      {segment !== "listas" && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          {segment === "series" ? (
            <MenuFiltro
              rotulo="Filtrar séries"
              valor={filter}
              opcoes={FILTERS}
              onChange={(v) => setParams({ filtro: v === "tudo" ? null : v })}
            />
          ) : (
            <MenuFiltro
              rotulo="Filtrar filmes"
              valor={movieFilter}
              opcoes={MOVIE_FILTERS}
              onChange={(v) => setParams({ filtro: v === "todos" ? null : v })}
            />
          )}
          <div className="ml-auto flex items-center gap-1">
            {segment === "filmes" && decades.length > 1 && (
              <MenuFiltro
                simples
                alinhar="direita"
                rotulo="Década"
                valor={decade === null ? "todas" : String(decade)}
                opcoes={[
                  { valor: "todas", nome: "Todas as décadas" },
                  ...decades.map((d) => ({ valor: String(d), nome: decadeLabel(d) })),
                ]}
                onChange={(v) => setParams({ decada: v === "todas" ? null : v })}
              />
            )}
            {segment === "series" ? (
              <MenuFiltro
                simples
                alinhar="direita"
                rotulo="Ordenar séries"
                valor={seriesSort}
                opcoes={SERIES_SORTS.map((o) => ({ valor: o.id, nome: o.label }))}
                onChange={(v) => setParams({ ordem: v === "vistos" ? null : v })}
              />
            ) : (
              <MenuFiltro
                simples
                alinhar="direita"
                rotulo="Ordenar filmes"
                valor={movieSort}
                opcoes={MOVIE_SORTS.map((o) => ({ valor: o.id, nome: o.label }))}
                onChange={(v) => setParams({ ordem: v === "vistos" ? null : v })}
              />
            )}
          </div>
        </div>
      )}

      {segment === "listas" ? (
        <div className="mt-4">
          <ListasConteudo />
        </div>
      ) : loading ? (
        <PosterGridBone count={9} />
      ) : showing > 0 ? (
        segment === "series" ? (
          showGroups ? (
            <div data-testid="library-grid">
              {showGroups.map((g) => {
                const dobravel =
                  g.label === "Completas" && g.items.length >= DOBRAR_A_PARTIR_DE;
                const dobrada = dobravel && completas === "dobradas";
                return (
                  <section key={g.label}>
                    <StickySectionHeader label={g.label} count={g.items.length} />
                    {dobravel && (
                      <button
                        onClick={() =>
                          setCompletas(dobrada ? "abertas" : "dobradas")
                        }
                        aria-expanded={!dobrada}
                        data-testid="dobrar-completas"
                        className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-xl px-1 text-left text-[0.88rem] text-label-2 transition-colors active:bg-fill"
                      >
                        <span className="flex-1">
                          {dobrada
                            ? `Ver as ${g.items.length} que já acabaste`
                            : "Esconder as que já acabaste"}
                        </span>
                        <ChevronDown
                          aria-hidden
                          className={`h-4 w-4 shrink-0 transition-transform ${
                            dobrada ? "" : "rotate-180"
                          }`}
                        />
                      </button>
                    )}
                    {!dobrada && (
                      <div className={CLASSE_GRELHA}>
                        {g.items.map((s, i) => (
                          <ShowPoster key={s.uuid} show={s} index={i} proximo={proximo(s)} />
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          ) : (
            <div className={`mt-3 ${CLASSE_GRELHA}`} data-testid="library-grid">
              {filteredShows.map((s, i) => (
                <ShowPoster key={s.uuid} show={s} index={i} proximo={proximo(s)} />
              ))}
            </div>
          )
        ) : movieGroups ? (
          <div data-testid="library-grid">
            {movieGroups.map((g) => (
              <section key={g.label}>
                <StickySectionHeader label={g.label} count={g.items.length} />
                <div className={CLASSE_GRELHA}>
                  {g.items.map((m, i) => (
                    <MovieCard key={m.key} movie={m} index={i} onChanged={reloadMovies} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className={`mt-3 ${CLASSE_GRELHA}`} data-testid="library-grid">
            {filteredMovies.map((m, i) => (
              <MovieCard key={m.key} movie={m} index={i} onChanged={reloadMovies} />
            ))}
          </div>
        )
      ) : (
        <LibraryEmptyState
          query={q ? query.trim() : null}
          segment={segment}
          filter={filter}
          onClearFilter={() => setParams({ filtro: null, decada: null })}
          onProcurar={() => campoPesquisa.current?.focus()}
        />
      )}

      {/* Adicionar o que ainda não tens — o catálogo do segmento onde estás */}
      {q && (
        <div className="mt-6 border-t-[0.5px] border-separator pt-5">
          {searched === null ? (
            <Acao
              // sem nada na biblioteca, adicionar é a ação óbvia (a cápsula);
              // com resultados, é uma saída discreta
              tipo={showing === 0 ? "principal" : "secundaria"}
              grande={showing === 0}
              onClick={() => void searchRemote()}
              disabled={remoteBusy}
              className="w-full"
              data-testid="remote-search-button"
            >
              {remoteBusy && (
                <span className="spinner h-4 w-4 rounded-full border-2 border-separator border-t-label" />
              )}
              {remoteBusy
                ? "A procurar…"
                : segment === "series"
                  ? `Procurar “${query.trim()}” em todas as séries`
                  : `Procurar “${query.trim()}” em todos os filmes`}
            </Acao>
          ) : (
            <>
              <h2 className="text-[1.3rem] font-bold text-label">
                {segment === "series" ? "Séries encontradas" : "Filmes encontrados"}
              </h2>
              <div className="mt-3 flex flex-col gap-3" data-testid="search-results">
                {searched.length === 0 && !remoteError && (
                  <p className="text-center text-[0.88rem] text-label-2">
                    Sem resultados. Tenta o nome original
                    {segment === "series" ? " da série" : " do filme"}.
                  </p>
                )}
                {segment === "series"
                  ? remote?.map((result) => (
                      <ShowResultCard
                        key={`${result.provider}-${result.providerId}`}
                        result={result}
                      />
                    ))
                  : remoteMovies?.map((result) => (
                      <MovieResultCard
                        key={result.tmdbId}
                        result={result}
                        onAdded={reloadMovies}
                      />
                    ))}
              </div>
            </>
          )}
          {remoteError && (
            <p className="page-enter mt-3 text-center text-[0.88rem] text-danger">{remoteError}</p>
          )}
        </div>
      )}
    </main>
  );
}

// useSearchParams exige uma fronteira de Suspense para a rota poder ser
// pré-renderizada; sem ela o build falha.
export default function LibraryPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-2xl px-4 py-8">
          <TitleBone />
          <PosterGridBone count={9} />
        </main>
      }
    >
      <LibraryContent />
    </Suspense>
  );
}
