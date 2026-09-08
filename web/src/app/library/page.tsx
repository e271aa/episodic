"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getMovies, kvGet, kvSet, type StoredMovie } from "@/lib/db";
import { loadShows, type ShowWithProgress } from "@/lib/shows";
import { backfillMovies, backfillShows } from "@/lib/backfill";
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
import SectionHeader from "@/components/SectionHeader";
import StickySectionHeader from "@/components/StickySectionHeader";
import ShowPoster from "@/components/ShowPoster";
import MovieCard from "@/components/MovieCard";
import ShowResultCard from "@/components/ShowResultCard";
import MovieResultCard from "@/components/MovieResultCard";
import LibraryEmptyState from "@/components/LibraryEmptyState";
import LibraryControls from "@/components/LibraryControls";
import SheetPanel from "@/components/SheetPanel";
import { PosterGridBone, TitleBone } from "@/components/Skeleton";
import { SearchIcon } from "@/components/icons";

type Segment = "series" | "filmes";
type SeriesFilter = "tudo" | "a-ver" | "completas" | "para-ver" | "arquivadas" | "parei";
type MovieFilter = "vistos" | "para-ver" | "todos";
/** Filmes não têm "estado" como as séries — o eixo útil é quando saíram */
type MovieSort = "vistos" | "recentes" | "antigos" | "az";
type SeriesSort = "vistos" | "progresso" | "az" | "adicionadas";

const SERIES_SORTS: { id: SeriesSort; label: string }[] = [
  { id: "vistos", label: "Vistos há pouco" },
  { id: "progresso", label: "Mais episódios vistos" },
  { id: "az", label: "A–Z" },
  { id: "adicionadas", label: "Adicionadas há pouco" },
];

const MOVIE_SORTS: { id: MovieSort; label: string }[] = [
  { id: "vistos", label: "Vistos há pouco" },
  { id: "recentes", label: "Estreia mais recente" },
  { id: "antigos", label: "Estreia mais antiga" },
  { id: "az", label: "A–Z" },
];

/**
 * Quão junto se arruma a biblioteca. Dois cartazes por linha mostram bem a
 * arte, mas com 136 séries e 239 filmes é muito rolar para pouca coisa;
 * a lista troca a arte por velocidade a procurar.
 *
 * É preferência de apresentação, não de navegação — por isso vive no
 * `usePref` e não no URL, ao contrário do filtro e da ordem, que se
 * partilham e sobrevivem ao gesto de recuar.
 */
type Densidade = "grande" | "compacta" | "lista";
const DENSIDADES: readonly Densidade[] = ["grande", "compacta", "lista"];

const DENSIDADE_LABEL: Record<Densidade, string> = {
  grande: "Cartazes grandes",
  compacta: "Cartazes pequenos",
  lista: "Lista",
};

const CLASSE_GRELHA: Record<Densidade, string> = {
  grande: "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4",
  compacta: "grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6",
  lista: "flex flex-col",
};

/** A ordem por que as secções de estado aparecem, e a cor de cada uma. As
 *  cores são as mesmas da barra de progresso do cartaz: verde = a andar,
 *  roxo = acabou. Cor com significado, não decoração. */
const ESTADOS = ["A ver", "Completas", "Para ver", "Já não sigo", "Arquivadas"];
const COR_ESTADO: Record<string, string> = {
  "A ver": "#37c837",
  Completas: "#d24bd2",
  "Para ver": "#3fd2c8",
  "Já não sigo": "#8a8880",
  Arquivadas: "#8a8880",
};

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

function LibraryContent() {
  const router = useRouter();
  const params = useSearchParams();

  // O estado de navegação vive no URL: partilhável, sobrevive a recargas e
  // faz o gesto de recuar funcionar dentro da própria Biblioteca.
  const segment: Segment = params.get("tipo") === "filmes" ? "filmes" : "series";
  const rawFiltro = params.get("filtro") as SeriesFilter | null;
  const filter: SeriesFilter =
    rawFiltro && ["a-ver", "completas", "para-ver", "arquivadas", "parei"].includes(rawFiltro)
      ? rawFiltro
      : "tudo";
  const movieFilter: MovieFilter =
    rawFiltro && ["vistos", "para-ver", "todos"].includes(rawFiltro)
      ? (rawFiltro as MovieFilter)
      : "vistos";
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

  const setParams = useCallback(
    (patch: Record<string, string | null>, push = false) => {
      const next = new URLSearchParams(params);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      const url = next.size > 0 ? `/library?${next}` : "/library";
      if (push) router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    },
    [params, router],
  );

  const [shows, setShows] = useState<ShowWithProgress[] | null>(null);
  const [movies, setMovies] = useState<StoredMovie[] | null>(null);
  const [query, setQuery] = useState("");
  // A pesquisa e os filtros saíram do cabeçalho; vivem atrás dos ícones da
  // barra flutuante e abrem por cima do conteúdo.
  const [pesquisaAberta, setPesquisaAberta] = useState(false);
  const [densidade, setDensidade] = usePref<Densidade>(
    "biblioteca-densidade",
    "grande",
    DENSIDADES,
  );
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  // Pesquisa remota é secundária: só corre quando o utilizador a pede
  const [remote, setRemote] = useState<MetaSearchResult[] | null>(null);
  const [remoteMovies, setRemoteMovies] = useState<MetaMovieResult[] | null>(null);
  const [remoteBusy, setRemoteBusy] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const enriching = useRef(false);

  // "Para ver" não tem watchedAt — cai para o fim numa ordenação por "vistos"
  const byWatchedDesc = (a: StoredMovie, b: StoredMovie) =>
    (b.watchedAt ?? "").localeCompare(a.watchedAt ?? "");

  const reloadMovies = useCallback(() => {
    void getMovies().then((list) => setMovies(list.sort(byWatchedDesc)));
  }, []);

  useEffect(() => {
    void (async () => {
      const [listaShows, listaMovies] = await Promise.all([loadShows(), getMovies()]);
      setShows(listaShows);
      setMovies(listaMovies.sort(byWatchedDesc));

      if (enriching.current) return;
      enriching.current = true;
      try {
        // As séries também se completam aqui, não só no "A seguir": quem
        // entra direto na Biblioteca — que é onde as capas se veem todas de
        // uma vez — não disparava enriquecimento nenhum, e ficava à espera
        // de uma visita a outro ecrã que podia nunca acontecer.
        await backfillShows(listaShows, () => {
          void loadShows().then(setShows);
        });

        // Completa capas e datas de estreia em falta via TMDB. A capa vivia na
        // antiga página /movies, que quase não tinha entradas — filmes sem
        // capa nunca eram enriquecidos. A data de estreia é a mesma história:
        // muitos filmes importados do TV Time nunca a trouxeram, e sem ela o
        // filtro de décadas usava a data em que marcaste como visto (errado).
        //
        // Uma revisão em massa quando a regra de escolha do filme muda: os que
        // já estavam enriquecidos guardaram o filme ERRADO (o "Ciao Alberto"
        // ficou com o homónimo de 2003 em vez do spin-off do Luca de 2021) e
        // como têm capa e data nunca mais seriam tocados.
        const rever = ((await kvGet<number>(ENRICH_KEY)) ?? 0) < ENRICH_VERSION;
        await backfillMovies(listaMovies, rever, () => {
          void getMovies().then((fresh) => setMovies(fresh.sort(byWatchedDesc)));
        });
        if (rever) await kvSet(ENRICH_KEY, ENRICH_VERSION);
      } finally {
        enriching.current = false;
      }
    })();
  }, []);

  // Filtrar o que já tens é instantâneo (é tudo local) — sem botão, sem espera
  const q = norm(query.trim());

  const filteredShows = useMemo(() => {
    if (!shows) return [];
    const complete = (s: ShowWithProgress) =>
      s.totalEpisodes != null && s.watchedCount >= s.totalEpisodes;
    let list = shows;
    if (filter === "a-ver") {
      list = list.filter((s) => s.followed && !s.archived && !complete(s));
    } else if (filter === "completas") {
      list = list.filter((s) => complete(s));
    } else if (filter === "para-ver") {
      list = list.filter((s) => s.inWatchlist && !s.followed);
    } else if (filter === "arquivadas") {
      list = list.filter((s) => s.archived);
    } else if (filter === "parei") {
      list = list.filter((s) => !s.followed && !s.inWatchlist);
    }
    if (q) list = list.filter((s) => norm(s.name).includes(q));
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
  }, [shows, filter, q, seriesSort]);

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
    if (q) list = list.filter((m) => norm(m.name).includes(q));
    const sorted = [...list];
    if (movieSort === "vistos") {
      // sem data de visto (para ver), cai para a data em que adicionaste
      sorted.sort(
        (a, b) =>
          (b.watchedAt ?? b.addedAt ?? "").localeCompare(a.watchedAt ?? a.addedAt ?? ""),
      );
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
    const complete = (s: ShowWithProgress) =>
      s.totalEpisodes != null && s.watchedCount >= s.totalEpisodes;
    return {
      tudo: shows?.length ?? 0,
      "a-ver": shows?.filter((s) => s.followed && !s.archived && !complete(s)).length ?? 0,
      completas: shows?.filter(complete).length ?? 0,
      "para-ver": shows?.filter((s) => s.inWatchlist && !s.followed).length ?? 0,
      arquivadas: shows?.filter((s) => s.archived).length ?? 0,
      parei: shows?.filter((s) => !s.followed && !s.inWatchlist).length ?? 0,
    } as Record<SeriesFilter, number>;
  }, [shows]);

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
  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    setRemote(null);
    setRemoteMovies(null);
    setRemoteError(null);
  }, []);

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
   *  omissão: sem filtro aplicado, "o que estou a ver" e "o que já acabei"
   *  são as duas perguntas que a Biblioteca responde. */
  const estadoLabel = (s: ShowWithProgress): string => {
    if (s.archived) return "Arquivadas";
    if (!s.followed) return s.inWatchlist ? "Para ver" : "Já não sigo";
    if (s.totalEpisodes && s.watchedCount >= s.totalEpisodes) return "Completas";
    return "A ver";
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
    [filteredShows, seriesSort, filter, q],
  );

  const movieGroups = useMemo(
    () =>
      q
        ? null
        : groupSorted(filteredMovies, {
            vistos: (m: StoredMovie) => periodLabel(m.watchedAt),
            recentes: (m: StoredMovie) => decadeLabel(movieYear(m)),
            antigos: (m: StoredMovie) => decadeLabel(movieYear(m)),
            az: (m: StoredMovie) => letterLabel(m.name),
          }[movieSort]),
    [filteredMovies, movieSort, q],
  );
  /** resultados remotos do segmento atual — null enquanto ninguém pesquisou */
  const searched = segment === "series" ? remote : remoteMovies;

  const FILTERS: { id: SeriesFilter; label: string }[] = [
    { id: "tudo", label: "Tudo" },
    { id: "a-ver", label: "A ver" },
    { id: "completas", label: "Completas" },
    { id: "para-ver", label: "Para ver" },
    { id: "arquivadas", label: "Arquivadas" },
    { id: "parei", label: "Já não sigo" },
  ];

  const MOVIE_FILTERS: { id: MovieFilter; label: string }[] = [
    { id: "vistos", label: "Vistos" },
    { id: "para-ver", label: "Para ver" },
    { id: "todos", label: "Todos" },
  ];

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-10 pb-[calc(var(--dock-h)+5.5rem)]">

      {loading ? (
        <PosterGridBone count={9} />
      ) : showing > 0 ? (
        segment === "series" ? (
          showGroups ? (
            <div data-testid="library-grid">
              {showGroups.map((g) => (
                <section key={g.label}>
                  <StickySectionHeader
                    label={g.label}
                    count={g.items.length}
                    color={COR_ESTADO[g.label]}
                  />
                  <div className={CLASSE_GRELHA[densidade]}>
                    {g.items.map((s, i) => (
                      <ShowPoster key={s.uuid} show={s} index={i} densidade={densidade} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className={`mt-3 ${CLASSE_GRELHA[densidade]}`} data-testid="library-grid">
              {filteredShows.map((s, i) => (
                <ShowPoster key={s.uuid} show={s} index={i} densidade={densidade} />
              ))}
            </div>
          )
        ) : movieGroups ? (
          <div data-testid="library-grid">
            {movieGroups.map((g) => (
              <section key={g.label}>
                <StickySectionHeader label={g.label} count={g.items.length} />
                <div className={CLASSE_GRELHA[densidade]}>
                  {g.items.map((m, i) => (
                    <MovieCard
                      key={m.key}
                      movie={m}
                      index={i}
                      onChanged={reloadMovies}
                      densidade={densidade}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className={`mt-3 ${CLASSE_GRELHA[densidade]}`} data-testid="library-grid">
            {filteredMovies.map((m, i) => (
              <MovieCard
                key={m.key}
                movie={m}
                index={i}
                onChanged={reloadMovies}
                densidade={densidade}
              />
            ))}
          </div>
        )
      ) : (
        <LibraryEmptyState
          query={q ? query.trim() : null}
          segment={segment}
          filter={filter}
          onClearFilter={() => setParams({ filtro: null, decada: null })}
        />
      )}

      {/* Adicionar o que ainda não tens — o catálogo do segmento onde estás */}
      {q && (
        <div className="mt-6 border-t border-line pt-5">
          {searched === null ? (
            <button
              onClick={() => void searchRemote()}
              disabled={remoteBusy}
              className={`flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full text-[15px] font-semibold transition active:scale-95 disabled:opacity-50 ${
                // sem nada na biblioteca, adicionar é a ação óbvia — deixa de
                // ser um botão discreto no fundo da página
                showing === 0
                  ? "bg-ink text-tube hover:brightness-110"
                  : "border border-line text-dim hover:border-ink hover:text-ink"
              }`}
              data-testid="remote-search-button"
            >
              {remoteBusy && (
                <span className="spinner h-4 w-4 rounded-full border-2 border-line border-t-ink" />
              )}
              {remoteBusy
                ? "A procurar…"
                : segment === "series"
                  ? `Procurar “${query.trim()}” em todas as séries`
                  : `Procurar “${query.trim()}” em todos os filmes`}
            </button>
          ) : (
            <>
              <SectionHeader
                label={segment === "series" ? "Séries encontradas" : "Filmes encontrados"}
              />
              <div className="mt-3 flex flex-col gap-3" data-testid="search-results">
                {searched.length === 0 && !remoteError && (
                  <p className="text-center text-[15px] text-dim">
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
            <p className="page-enter mt-3 text-center text-[15px] text-danger">{remoteError}</p>
          )}
        </div>
      )}

      <LibraryControls
        segment={segment}
        counts={{ series: shows?.length ?? 0, filmes: movies?.length ?? 0 }}
        onSegment={changeSegment}
        onSearch={() => setPesquisaAberta(true)}
        onFilters={() => setFiltrosAbertos(true)}
        filtrosAtivos={
          segment === "series"
            ? filter !== "tudo" || seriesSort !== "vistos"
            : movieFilter !== "vistos" || movieSort !== "vistos" || decade !== null
        }
      />

      {/* A pesquisa sobe por cima de tudo: enquanto se procura, procurar é a
          única coisa que interessa no ecrã. */}
      <SheetPanel
        titulo="Procurar"
        aberto={pesquisaAberta}
        onFechar={() => setPesquisaAberta(false)}
      >
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Procurar na biblioteca…"
            className="min-h-12 w-full rounded-full border border-line bg-tube py-2.5 pl-10 pr-4 outline-none transition-colors focus:border-ink"
            data-testid="search-input"
          />
        </div>
        <p className="mt-3 text-[15px] text-dim">
          {q
            ? `${showing} ${segment === "series" ? "séries" : "filmes"} na biblioteca`
            : "Escreve para filtrar o que já tens. Procurar títulos novos é o passo seguinte, no fim da lista."}
        </p>
        {q && (
          <button
            onClick={() => setPesquisaAberta(false)}
            className="mt-4 flex min-h-12 w-full cursor-pointer items-center justify-center rounded-full bg-ink text-[15px] font-semibold text-tube transition active:scale-95"
          >
            Ver resultados
          </button>
        )}
      </SheetPanel>

      <SheetPanel
        titulo="Filtros e ordenação"
        aberto={filtrosAbertos}
        onFechar={() => setFiltrosAbertos(false)}
      >
        {segment === "series" && (
          <>
            <SectionHeader label="Mostrar" />
            <div className="mt-3 flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setParams({ filtro: f.id === "tudo" ? null : f.id })}
                  className={`flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-[15px] transition active:scale-95 ${
                    filter === f.id
                      ? "border-ink bg-ink text-tube"
                      : "border-line text-dim hover:border-ink hover:text-ink"
                  }`}
                >
                  {f.label}
                  <span
                    className={`ep-code text-xs ${filter === f.id ? "opacity-70" : "text-faint"}`}
                  >
                    {counts[f.id]}
                  </span>
                </button>
              ))}
            </div>
            <SectionHeader label="Ordenar por" className="mt-6" />
            <div className="mt-3 flex flex-wrap gap-2">
              {SERIES_SORTS.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setParams({ ordem: o.id === "vistos" ? null : o.id })}
                  className={`min-h-11 cursor-pointer rounded-full border px-3.5 text-[15px] transition active:scale-95 ${
                    seriesSort === o.id
                      ? "border-ink bg-ink text-tube"
                      : "border-line text-dim hover:border-ink hover:text-ink"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </>
        )}

        {segment === "filmes" && (
          <>
            <SectionHeader label="Mostrar" />
            <div className="mt-3 flex flex-wrap gap-2">
              {MOVIE_FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setParams({ filtro: f.id === "vistos" ? null : f.id })}
                  className={`flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-[15px] transition active:scale-95 ${
                    movieFilter === f.id
                      ? "border-ink bg-ink text-tube"
                      : "border-line text-dim hover:border-ink hover:text-ink"
                  }`}
                >
                  {f.label}
                  <span
                    className={`ep-code text-xs ${movieFilter === f.id ? "opacity-70" : "text-faint"}`}
                  >
                    {movieCounts[f.id]}
                  </span>
                </button>
              ))}
            </div>
            <SectionHeader label="Ordenar por" className="mt-6" />
            <div className="mt-3 flex flex-wrap gap-2">
              {MOVIE_SORTS.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setParams({ ordem: o.id === "vistos" ? null : o.id })}
                  className={`min-h-11 cursor-pointer rounded-full border px-3.5 text-[15px] transition active:scale-95 ${
                    movieSort === o.id
                      ? "border-ink bg-ink text-tube"
                      : "border-line text-dim hover:border-ink hover:text-ink"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {decades.length > 1 && (
              <>
                <SectionHeader label="Década" className="mt-6" />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => setParams({ decada: null })}
                    className={`min-h-11 cursor-pointer rounded-full border px-3.5 text-[15px] transition active:scale-95 ${
                      decade === null
                        ? "border-ink bg-ink text-tube"
                        : "border-line text-dim hover:border-ink hover:text-ink"
                    }`}
                  >
                    Todas
                  </button>
                  {decades.map((d) => (
                    <button
                      key={d}
                      onClick={() => setParams({ decada: d === decade ? null : String(d) })}
                      className={`ep-code min-h-11 cursor-pointer rounded-full border px-3.5 text-sm transition active:scale-95 ${
                        decade === d
                          ? "border-ink bg-ink text-tube"
                          : "border-line text-dim hover:border-ink hover:text-ink"
                      }`}
                    >
                      {decadeLabel(d)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* Vista fica fora do `segment`: é a mesma escolha para séries e
            filmes, e mudá-la ao passar de um para o outro seria uma
            surpresa. A barra flutuante já tem quatro alvos — cabia lá um
            quinto, mas isto não é uma coisa que se mexa a toda a hora. */}
        <SectionHeader label="Vista" className="mt-6" />
        <div className="mt-3 flex flex-wrap gap-2">
          {DENSIDADES.map((d) => (
            <button
              key={d}
              onClick={() => setDensidade(d)}
              aria-pressed={densidade === d}
              className={`min-h-11 cursor-pointer rounded-full border px-3.5 text-[15px] transition active:scale-95 ${
                densidade === d
                  ? "border-ink bg-ink text-tube"
                  : "border-line text-dim hover:border-ink hover:text-ink"
              }`}
            >
              {DENSIDADE_LABEL[d]}
            </button>
          ))}
        </div>

        {/* As Listas perderam a entrada que tinham no cabeçalho quando o
            cabeçalho saiu de cena (Fase T). Ficam aqui — são outra forma de
            ver a mesma biblioteca, não um filtro dela, mas é o painel que
            sobrou depois do cromo todo ter descido para a barra flutuante. */}
        <SectionHeader label="Coleções" className="mt-6" />
        <Link
          href="/listas"
          className="mt-3 flex min-h-11 w-full cursor-pointer items-center justify-between rounded-full border border-line px-4 text-[15px] text-dim transition hover:border-ink hover:text-ink"
        >
          As tuas listas
          <span className="text-faint">→</span>
        </Link>
      </SheetPanel>
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
