"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getWatchedForShow, kvGet, kvSet, markWatched, unmarkWatched, updateShow } from "@/lib/db";
import { loadShows, type ShowWithProgress } from "@/lib/shows";
import { useNextUp, useSeries } from "@/lib/cache";
import { buildUpcomingCalendar, type UpcomingEntry } from "@/lib/upcoming";
import { hasTmdb } from "@/lib/metadata";
import { backfillShows } from "@/lib/backfill";
import { findShowByTvdbId } from "@/lib/tmdb";
import { findNextUnwatched, formatEpCode } from "@/lib/watchnext";
import {
  classifyQueue,
  lastWatchDate,
  loadCachedNextUp,
  persistNextUp,
  type NextUpMap,
  type QueueEntry,
} from "@/lib/queue";
import { pushUndo } from "@/lib/undo";
import WatchNextCard from "@/components/WatchNextCard";
import TonightHero from "@/components/TonightHero";
import Poster from "@/components/Poster";
import SectionHeader from "@/components/SectionHeader";
import { CheckIcon, SearchIcon } from "@/components/icons";
import { Bone, CardsBone, TitleBone } from "@/components/Skeleton";

// Preenche o id TMDB em falta, uma vez só. Sem ele, o Explorar volta a
// sugerir séries que já tens sempre que o título guardado não bate com
// nenhum dos títulos da TMDB — é o caso dos animes guardados em romaji
// ("Boku Dake ga Inai Machi" contra "Erased" e "僕だけがいない街").
const TMDB_BACKFILL_KEY = "shows:tmdb-backfill-v";
const TMDB_BACKFILL_VERSION = 1;

export default function SeriesPage() {
  /**
   * A leitura própria desta página continua a mandar — é ela que o
   * `handleCheck` atualiza de forma otimista, e esse é o caminho mais quente
   * da app. A cache partilhada entra só como **o que se vê no primeiro
   * instante**, e é isso que faz o scroll voltar ao sítio.
   *
   * Medido antes: sair do "A seguir" a 683px e voltar dava **230px**. No
   * primeiro frame depois do recuo o documento tinha 894px (o esqueleto)
   * contra 2030px reais — e 894 − 664 (altura do ecrã) = 230, exatamente
   * onde ficava. O browser repõe a posição nesse instante e o que não cabe
   * é cortado; não é o scroll que se perde, é o documento que ainda não tem
   * altura. Com a cache, o conteúdo já lá está no primeiro frame.
   *
   * Sobreposição em vez de substituição de propósito: a Biblioteca podia ir
   * toda para a cache porque não tem estado otimista; aqui, trocar o
   * `setShows` por revalidações mexia no marcar episódio, que já teve uma
   * regressão a sério (Fase Y).
   */
  const cacheSeries = useSeries();
  const [proprias, setShows] = useState<ShowWithProgress[] | null>(null);
  const shows = proprias ?? cacheSeries;
  /** Mesma sobreposição das séries: a cache é o que se vê no primeiro frame. */
  const cacheNextUp = useNextUp();
  const [proprioNextUp, setNextUp] = useState<NextUpMap | null>(null);
  const nextUp = proprioNextUp ?? cacheNextUp;
  // Secções secundárias da fila (como no TV Time): fechadas por omissão
  const [showStale, setShowStale] = useState(false);
  const [showNotStarted, setShowNotStarted] = useState(false);
  // instante de referência para o corte de 30 dias, fixado ao montar
  const [now] = useState(() => Date.now());
  // "A estrear" era um ecrã à parte e quase sempre vazio. A mesma informação
  // aqui responde à pergunta seguinte à do herói: "e depois?".
  const [upcoming, setUpcoming] = useState<UpcomingEntry[] | null>(null);
  const enriching = useRef(false);
  const hadCache = useRef(false);

  // Passo 2 do arranque: com os metadados no lugar, calcula o próximo
  // episódio por ver de cada série seguida (a fila "A seguir").
  // 4 séries em paralelo: sequencial era demasiado lento com dezenas de
  // séries; mais que isto esbarra no rate limit da TVmaze (20 req/10s).
  const computeNextUp = useCallback(async (list: ShowWithProgress[]) => {
    const map: NextUpMap = new Map();
    const queue = list.filter((s) => s.followed && !s.archived);
    let cursor = 0;
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        for (let i = cursor++; i < queue.length; i = cursor++) {
          const show = queue[i];
          const watched = await getWatchedForShow(show.uuid);
          const next = await findNextUnwatched(show, watched);
          if (next) {
            map.set(show.uuid, {
              episode: next.episode,
              lastWatchedAt: lastWatchDate(watched),
            });
            // Sem cache prévia, cada cartão aparece assim que fica pronto —
            // melhor ver a fila a crescer do que um spinner parado
            if (!hadCache.current) setNextUp(new Map(map));
          }
        }
      }),
    );
    setNextUp(map);
    persistNextUp(map);
  }, []);

  // Completa séries com poster/sinopse/nº de episódios (TVmaze por defeito,
  // TMDB com chave). Persiste — nas visitas seguintes já está em cache.
  // Depois das séries, e sem bloquear o ecrã: o calendário é o extra do fim
  // da página, não pode atrasar o herói.
  useEffect(() => {
    if (!shows) return;
    let vivo = true;
    void buildUpcomingCalendar(shows)
      .then((e) => {
        if (vivo) setUpcoming(e);
      })
      .catch(() => {
        if (vivo) setUpcoming([]);
      });
    return () => {
      vivo = false;
    };
  }, [shows]);

  const enrich = useCallback(
    async (list: ShowWithProgress[]) => {
      if (enriching.current) return;
      enriching.current = true;
      try {
        let changed = false;

        // Passagem única: o enriquecimento normal salta séries que já têm
        // capa, e quase toda a biblioteca foi enriquecida pela TVmaze — por
        // isso o id TMDB ficava a null para sempre.
        const feito = ((await kvGet<number>(TMDB_BACKFILL_KEY)) ?? 0) >= TMDB_BACKFILL_VERSION;
        if (!feito && (await hasTmdb())) {
          for (const show of list) {
            if (show.tmdbId || !show.tvdbId) continue;
            const hit = await findShowByTvdbId(show.tvdbId).catch(() => null);
            if (hit) {
              // Guarda também os títulos: o id sozinho não chega quando a
              // TMDB tem a mesma série em duas entradas (o "Erased" existe
              // com dois ids diferentes).
              const aliases = [hit.name, hit.original_name].filter(
                (n): n is string => !!n,
              );
              await updateShow(show.uuid, { tmdbId: hit.id, tmdbAliases: aliases });
              changed = true;
            }
          }
          await kvSet(TMDB_BACKFILL_KEY, TMDB_BACKFILL_VERSION);
        }

        // A fila calcula-se duas vezes de propósito. À primeira, com o que já
        // está guardado: é instantâneo e é o que a pessoa veio ver. Mas uma
        // série ainda sem metadados não sabe qual é o próximo episódio e cai
        // fora da fila — daí a segunda passagem, depois de as capas e os
        // episódios chegarem. Sem ela, uma biblioteca acabada de importar
        // dizia "estás em dia" só porque ainda não sabia o contrário.
        await computeNextUp(changed ? await loadShows() : list);

        let entrouCoisaNova = false;
        await backfillShows(list, () => {
          entrouCoisaNova = true;
          void loadShows().then(setShows);
        });

        if (entrouCoisaNova) {
          const fresh = await loadShows();
          setShows(fresh);
          await computeNextUp(fresh);
        }
      } finally {
        enriching.current = false;
      }
    },
    [computeNextUp],
  );

  useEffect(() => {
    void (async () => {
      // Fila da última visita aparece de imediato; a versão fresca substitui-a
      // quando o recálculo em segundo plano terminar
      const cached = await loadCachedNextUp();
      if (cached) {
        hadCache.current = true;
        setNextUp(cached);
      }
      const list = await loadShows();
      setShows(list);
      void enrich(list);
    })();
  }, [enrich]);

  // Check no Watch Next: grava, avança o cartão para o episódio seguinte
  // e atualiza a contagem — tudo sem recarregar a página
  const handleCheck = useCallback(
    async (showUuid: string, season: number, episode: number) => {
      await markWatched(showUuid, season, episode);
      setShows(
        (current) =>
          current?.map((s) =>
            s.uuid === showUuid ? { ...s, watchedCount: s.watchedCount + 1 } : s,
          ) ?? null,
      );
      const show = shows?.find((s) => s.uuid === showUuid);
      if (!show) return;
      const watched = await getWatchedForShow(showUuid);
      const next = await findNextUnwatched(show, watched);
      // guarda a entrada anterior da fila para a poder repor tal e qual
      let previous: QueueEntry | undefined;
      setNextUp((current) => {
        // `current ?? cacheNextUp`: enquanto a leitura própria não chega, é a
        // cache que está a ser mostrada. Partir de `null` aqui esvaziava a
        // fila inteira para gravar uma entrada só.
        const map = new Map(current ?? cacheNextUp);
        previous = map.get(showUuid);
        // acabou de ver um episódio → a série volta (ou mantém-se) ativa
        if (next) {
          map.set(showUuid, {
            episode: next.episode,
            lastWatchedAt: new Date().toISOString(),
          });
        } else {
          map.delete(showUuid);
        }
        persistNextUp(map);
        return map;
      });

      pushUndo({
        label: "Marcado como visto",
        detail: `${show.name} · ${formatEpCode(season, episode)}`,
        undo: async () => {
          await unmarkWatched(showUuid, season, episode);
          setShows(
            (current) =>
              current?.map((s) =>
                s.uuid === showUuid
                  ? { ...s, watchedCount: Math.max(0, s.watchedCount - 1) }
                  : s,
              ) ?? null,
          );
          setNextUp((current) => {
            const map = new Map(current ?? cacheNextUp);
            if (previous) map.set(showUuid, previous);
            else map.delete(showUuid);
            persistNextUp(map);
            return map;
          });
        },
      });
    },
    [shows, cacheNextUp],
  );

  if (shows === null) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <TitleBone />
        {/* o herói é grande: o esqueleto tem de o anunciar, senão o salto
            quando os dados chegam é enorme */}
        <Bone className="mt-6 aspect-4/5 w-full rounded-3xl sm:aspect-video" />
        <CardsBone count={2} height="h-[104px]" />
      </main>
    );
  }

  if (shows.length === 0) {
    // Primeira utilização — o ecrã vazio é o onboarding. Começava por
    // "importa o ZIP do TV Time", que os amigos nunca tiveram (Ronda 12,
    // Fase 4): o primeiro passo é o que toda a gente pode fazer, e importar
    // fica como segunda porta, para quem vem de lá.
    const steps = [
      {
        n: "01",
        title: "Procura o que andas a ver",
        text: "Toca em Seguir e a série entra na tua fila.",
      },
      {
        n: "02",
        title: "Marca à medida que vês",
        text: "A fila “A seguir” diz-te sempre qual é o próximo episódio.",
      },
      {
        n: "03",
        title: "Guarda o resto para depois",
        text: "O que queres ver um dia fica em “Para ver”, fora da fila.",
      },
    ];
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-16">
        <div className="text-center">
          <p className="ep-code text-sm tracking-[0.3em] text-dim">EPISODIC</p>
          <h1 className="mt-3 font-display text-3xl font-bold">
            Tudo o que vês, num só sítio
          </h1>
          <p className="mt-3 text-dim">
            O teu registo de séries: o que viste, o que falta, o que vem a seguir.
          </p>
        </div>

        <ol className="mt-10 space-y-4">
          {steps.map((step) => (
            <li key={step.n} className="flex items-start gap-4">
              <span className="ep-code mt-0.5 shrink-0 text-lg font-bold text-ink">
                {step.n}
              </span>
              <div>
                <p className="font-display font-semibold">{step.title}</p>
                <p className="mt-0.5 text-[15px] text-dim">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-10 flex flex-col items-center gap-2">
          <Link
            href="/explorar?procurar=1"
            className="flex min-h-12 cursor-pointer items-center rounded-full bg-ink px-6 font-semibold text-tube transition hover:brightness-110 active:scale-95"
          >
            Procurar uma série
          </Link>
          <Link
            href="/import"
            className="flex min-h-11 cursor-pointer items-center px-3 text-[15px] text-dim transition hover:text-ink"
          >
            Vens do TV Time? Importar o histórico
          </Link>
        </div>
      </main>
    );
  }

  const watching = shows.filter((s) => s.followed && !s.archived);
  const queue = watching.filter((s) => nextUp?.has(s.uuid));

  const { active: activeQueue, stale: staleQueue, notStarted: notStartedQueue } =
    nextUp ? classifyQueue(shows, nextUp, now) : { active: [], stale: [], notStarted: [] };

  const queueCards = (list: ShowWithProgress[]) => (
    <div className="mt-3 space-y-3">
      {list.map((show) => (
        <WatchNextCard
          key={show.uuid}
          showUuid={show.uuid}
          showName={show.name}
          posterPath={show.posterPath}
          episode={nextUp!.get(show.uuid)!.episode}
          onCheck={(season, episode) => handleCheck(show.uuid, season, episode)}
        />
      ))}
    </div>
  );

  const sectionToggle = (
    title: string,
    hint: string,
    count: number,
    open: boolean,
    onToggle: () => void,
  ) => (
    <button
      onClick={onToggle}
      aria-expanded={open}
      className="flex min-h-11 w-full cursor-pointer items-center gap-2 text-left"
    >
      <h2 className="font-display text-lg font-semibold text-dim">{title}</h2>
      <span className="ep-code rounded-full bg-panel px-2 py-0.5 text-xs text-faint">
        {count}
      </span>
      <span className="flex-1 truncate text-xs text-faint">{hint}</span>
      <svg
        viewBox="0 0 24 24"
        className={`h-4 w-4 shrink-0 text-faint transition-transform ${open ? "rotate-180" : ""}`}
        aria-hidden
      >
        <path
          d="M6 9l6 6 6-6"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );

  // O herói nunca deve estar vazio se há episódios por ver: quando não há nada
  // "ativo" (nada marcado há 30 dias), promove a série parada mais recente —
  // a pergunta continua a ser "o que vejo a seguir?", só muda o enquadramento.
  const [activeHero, ...restActive] = activeQueue;
  const heroShow = activeHero ?? staleQueue[0] ?? notStartedQueue[0];
  const heroKind: "a-seguir" | "retomar" | "comecar" = activeHero
    ? "a-seguir"
    : staleQueue[0]
      ? "retomar"
      : "comecar";
  // a série promovida sai da secção de baixo, para não aparecer duas vezes
  const staleRest = activeHero ? staleQueue : staleQueue.slice(1);
  const notStartedRest =
    activeHero || staleQueue[0] ? notStartedQueue : notStartedQueue.slice(1);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      {nextUp === null ? (
        <>
          <p className="ep-code text-xs tracking-[0.3em] text-dim">EPISODIC</p>
          <h1 className="mt-1 font-display text-3xl font-bold">Séries</h1>
          <div className="mt-6 space-y-3">
            {watching.slice(0, 3).map((s) => (
              <Bone key={s.uuid} className="h-[104px] w-full rounded-2xl" />
            ))}
          </div>
        </>
      ) : queue.length === 0 ? (
        <>
          <p className="ep-code text-xs tracking-[0.3em] text-dim">EPISODIC</p>
          <h1 className="mt-1 font-display text-3xl font-bold">Séries</h1>
          <div className="ep-card mt-6 flex items-center gap-3 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-raised text-ink">
              {watching.length === 0 ? (
                <SearchIcon className="h-5 w-5" />
              ) : (
                <CheckIcon className="h-5 w-5" />
              )}
            </span>
            {/* Sem nenhuma série seguida, "estás em dia" era falso: não há
                nada na fila porque nada entrou nela. Quem só guardou
                séries em "Para ver" ficava aqui sem saber porquê. */}
            {watching.length === 0 ? (
              <>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium">Ainda não segues nenhuma série</p>
                  <p className="text-xs text-dim">
                    Segue uma e ela entra aqui. O que está em “Para ver” fica fora da fila.
                  </p>
                </div>
                <Link
                  href="/explorar?procurar=1"
                  className="-mr-2 inline-flex min-h-11 shrink-0 cursor-pointer items-center px-2 text-[15px] font-semibold text-ink hover:underline"
                >
                  Procurar
                </Link>
              </>
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium">Estás em dia</p>
                  <p className="text-xs text-dim">
                    Nenhum episódio por ver nas séries que segues.
                  </p>
                </div>
                <Link
                  href="/library"
                  className="-mr-2 inline-flex min-h-11 shrink-0 cursor-pointer items-center px-2 text-[15px] font-semibold text-ink hover:underline"
                >
                  Biblioteca
                </Link>
              </>
            )}
          </div>
        </>
      ) : (
        <>
          <TonightHero
            key={heroShow.uuid}
            showUuid={heroShow.uuid}
            showName={heroShow.name}
            backdropPath={heroShow.backdropPath}
            posterPath={heroShow.posterPath}
            episode={nextUp.get(heroShow.uuid)!.episode}
            watchedCount={heroShow.watchedCount}
            totalEpisodes={heroShow.totalEpisodes}
            seriesPorVer={queue.length}
            eyebrow={
              heroKind === "a-seguir"
                ? "Esta noite"
                : heroKind === "retomar"
                  ? "Retomar onde ficaste"
                  : "Começar do início"
            }
            onCheck={(season, episode) => handleCheck(heroShow.uuid, season, episode)}
          />
          {restActive.length > 0 && (
            <section className="mt-6">
<SectionHeader label="Continuar" meta={restActive.length} />
              {queueCards(restActive)}
            </section>
          )}
        </>
      )}

      {staleRest.length > 0 && (
        <section className="mt-8">
          {sectionToggle(
            "Retomar",
            "paradas há mais de 30 dias",
            staleRest.length,
            showStale,
            () => setShowStale((v) => !v),
          )}
          {showStale && queueCards(staleRest)}
        </section>
      )}

      {notStartedRest.length > 0 && (
        <section className="mt-8">
          {sectionToggle(
            "Por começar",
            "segues, mas ainda não viste nenhum episódio",
            notStartedRest.length,
            showNotStarted,
            () => setShowNotStarted((v) => !v),
          )}
          {showNotStarted && queueCards(notStartedRest)}
        </section>
      )}

      {/* "Esta semana" — o que vem a seguir ao que estás a ver. Era um ecrã
          próprio ("A estrear") quase sempre vazio; aqui responde à pergunta
          seguinte à do herói e não custa um destino na navegação. */}
      {upcoming && upcoming.length > 0 && (
        <section className="mt-8">
          {/* O "meta" é um link, não só o número: sem isto, "/estrear" ficou
              sem porta de entrada nenhuma depois de a Biblioteca perder o
              cabeçalho onde vivia o atalho. */}
          <SectionHeader
            label="Esta semana"
            meta={
              <Link
                href="/estrear"
                className="tap-44 relative hover:text-ink hover:underline"
              >
                {upcoming.length} · ver tudo
              </Link>
            }
            color="#3fd2c8"
          />
          <div className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-2">
            {upcoming.slice(0, 10).map(({ show, episode }) => (
              <Link
                key={`${show.uuid}-${episode.season}-${episode.episode}`}
                href={`/series/${show.uuid}`}
                className="ep-card w-[104px] shrink-0 overflow-hidden p-0"
              >
                <div className="relative h-[60px] w-full overflow-hidden bg-raised">
                  {show.backdropPath || show.posterPath ? (
                    <Poster
                      path={show.backdropPath ?? show.posterPath}
                      alt=""
                      size="w342"
                      fill
                      sizes="104px"
                      className="object-cover"
                    />
                  ) : null}
                </div>
                <div className="p-2">
                  <p className="truncate text-[15px] font-semibold leading-tight">
                    {show.name}
                  </p>
                  {/* duas linhas: num cartão de 104px o código e a data não
                      cabem lado a lado, e truncar a data tira-lhe o sentido */}
                  <p className="ep-code mt-0.5 truncate text-xs text-faint">
                    {formatEpCode(episode.season, episode.episode)}
                  </p>
                  {episode.airDate && (
                    <p className="ep-code truncate text-xs text-dim">
                      {episode.airDate.slice(8, 10)}/{episode.airDate.slice(5, 7)}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <p className="mt-10 text-center">
        <Link
          href="/library"
          className="inline-flex min-h-11 cursor-pointer items-center px-3 text-[15px] font-semibold text-dim hover:text-ink hover:underline"
        >
          Ver toda a biblioteca ({shows.length}) →
        </Link>
      </p>
    </main>
  );
}
