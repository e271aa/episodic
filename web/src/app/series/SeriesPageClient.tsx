"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getWatchedForShow, kvGet, kvSet, markWatched, unmarkWatched, updateShow } from "@/lib/db";
import { loadShows, type ShowWithProgress } from "@/lib/shows";
import { useFilmes, useNextUp, useSeries } from "@/lib/cache";
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
import { curta } from "@/lib/datas";
import WatchNextCard from "@/components/WatchNextCard";
import TonightHero from "@/components/TonightHero";
import OuEntao, { type Alternativa } from "@/components/OuEntao";
import Poster from "@/components/Poster";
import SectionHeader from "@/components/SectionHeader";
import { Check, Search } from "lucide-react";
import { Bone } from "@/components/Skeleton";
import TituloGrande from "@/components/mira/TituloGrande";
import { Grupo, Linha } from "@/components/mira/Grupo";

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
  // só para o "Ou então": o filme mais recente da lista "para ver"
  const filmes = useFilmes();
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
  // «TERÇA, 29 DE SETEMBRO» por cima do título (em maiúsculas pelo CSS)
  const hoje = new Date(now)
    .toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" })
    .replace("-feira", "");
  // o esqueleto só depois de 300ms: abaixo disso é um piscar (estado B·E2)
  const [esqueleto, setEsqueleto] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setEsqueleto(true), 300);
    return () => clearTimeout(t);
  }, []);
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
    // A carregar (estado B·E2 da Mira): o título aparece logo; o esqueleto
    // só se a base local demorar mais de 300ms — abaixo disso um esqueleto
    // é só um piscar. Com a forma exata do cartão, para nada saltar.
    return (
      <main className="mx-auto w-full max-w-2xl px-4 pt-[max(12px,env(safe-area-inset-top))]">
        <TituloGrande titulo="A seguir" rotulo={hoje} />
        {esqueleto && (
          <div className="mt-5 overflow-hidden rounded-[28px] bg-group" data-testid="esqueleto-casa">
            <Bone className="h-44 w-full rounded-none" />
            <div className="flex flex-col gap-3.5 px-[18px] pb-[18px] pt-4">
              <Bone className="h-8 w-2/3 rounded-lg" />
              <Bone className="h-5 w-1/2 rounded-md" />
              <Bone className="h-1 w-full rounded-sm" />
              <Bone className="h-[52px] w-full rounded-full" />
            </div>
          </div>
        )}
      </main>
    );
  }

  if (shows.length === 0) {
    // Primeira utilização (estado B·E1 da Mira): «sem sinal». É um dos dois
    // sítios onde a mira aparece — aqui quer dizer que ainda não há nada a
    // passar. As duas portas ficam na zona do polegar, acima da barra: a
    // primeira é a que toda a gente pode fazer; importar é para quem vem do
    // TV Time (os amigos nunca o tiveram — Ronda 12, Fase 4).
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pt-[max(12px,env(safe-area-inset-top))]">
        <TituloGrande titulo="A seguir" rotulo={hoje} />
        {/* 132px como no desenho; num ecrã baixo (Safari com as barras à vista,
            664px) 96, para as duas portas ficarem acima do degradê ao chegar */}
        <div aria-hidden className="mt-5 grid h-[132px] grid-cols-7 overflow-hidden rounded-3xl [@media(max-height:700px)]:h-24" data-testid="mira-sem-sinal">
          {["bg-smpte-gray", "bg-smpte-yellow", "bg-[#64d2ff]", "bg-[#30d158]", "bg-[#da5ce8]", "bg-smpte-red", "bg-smpte-blue"].map(
            (c) => (
              <span key={c} className={c} />
            ),
          )}
        </div>
        <h2 className="mt-6 text-[1.65rem] font-bold leading-[1.1] text-label">Ainda sem sinal.</h2>
        <p className="mt-2 text-base leading-snug text-label-2">
          Segue uma série e o próximo episódio aparece aqui, todas as noites. Se vens do TV Time,
          trazes o histórico inteiro, com as datas originais.
        </p>
        {/* O que a Ronda 12 aprendeu com o primeiro uso de um amigo (5c, P1 #6):
            dizer onde está o Seguir, e o que fazer a quem já vai a meio */}
        <p className="mt-2 text-[0.88rem] leading-snug text-label-2" data-testid="dicas-primeiro-uso">
          O Seguir está na pesquisa. Já vais a meio de uma série? Marca o último episódio que
          viste: a app oferece-se para marcar os de trás.
        </p>
        <div className="mt-auto flex flex-col gap-2.5 pb-4 pt-8">
          <Link
            href="/explorar?procurar=1"
            className="flex min-h-[52px] cursor-pointer items-center justify-center rounded-full bg-label text-base font-semibold text-on-label transition-transform active:scale-[0.97]"
          >
            Procurar uma série
          </Link>
          <Link
            href="/import"
            className="flex min-h-[52px] cursor-pointer items-center justify-center rounded-full bg-fill-strong text-base font-semibold text-label transition-transform active:scale-[0.97]"
          >
            Vens do TV Time? Importar
          </Link>
        </div>
      </main>
    );
  }

  // "Esta semana" promete sete dias — mostrava o que estreasse daqui a 17
  // (Ronda 12, 5b.4). O resto está a um toque, no A estrear.
  const limiteSemana = new Date(now + 7 * 864e5).toISOString().slice(0, 10);
  const estaSemana = (upcoming ?? []).filter((e) => (e.episode.airDate ?? "") <= limiteSemana);

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

  // "Ou então" (variante C, escolhida pelo Ruben a 27-09): a próxima série
  // da fila, fora a do herói, e o filme que entrou mais recentemente na
  // lista "para ver". O herói dava uma resposta só — e os filmes nunca
  // entravam na decisão da noite.
  const outraSerie = (
    [
      ...restActive.map((s) => ["continuar", s] as const),
      ...staleRest.map((s) => ["retomar", s] as const),
      ...notStartedRest.map((s) => ["começar", s] as const),
    ] as const
  )[0];
  const filmeParaVer = (filmes ?? [])
    .filter((m) => !m.watchedAt)
    .sort((a, b) => (b.addedAt ?? "").localeCompare(a.addedAt ?? ""))[0];
  const alternativas: Alternativa[] = [];
  if (outraSerie) {
    const [tipo, s] = outraSerie;
    const ep = nextUp?.get(s.uuid)?.episode;
    const porque = tipo === "continuar" ? "Continuar" : tipo === "retomar" ? "Retomar" : "Começar";
    alternativas.push({
      href: `/series/${s.uuid}`,
      titulo: s.name,
      subtitulo: ep ? `${porque} · ${formatEpCode(ep.season, ep.episode)}` : porque,
      posterPath: s.posterPath,
    });
  }
  if (filmeParaVer) {
    const ano = filmeParaVer.releaseDate?.slice(0, 4);
    alternativas.push({
      href: `/movies/${filmeParaVer.key}`,
      titulo: filmeParaVer.name,
      subtitulo: ano ? `Filme · ${ano} · para ver` : "Filme · para ver",
      posterPath: filmeParaVer.posterPath ?? null,
    });
  }

  // «Pôr em dia» ao lado do título: quantas SÉRIES têm episódios por ver.
  // Sem o disco da mira — cor numa ação é o que a Regra da ação proíbe (F4).
  const porEmDia =
    queue.length > 0 ? (
      <Link
        href="/em-dia"
        aria-label={`Pôr em dia: ${queue.length} ${queue.length === 1 ? "série" : "séries"} com episódios por ver`}
        className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-fill px-4 text-[0.88rem] font-semibold text-label transition-transform active:scale-[0.97]"
      >
        Pôr em dia
        <span className="ep-code font-medium text-label-2">{queue.length}</span>
      </Link>
    ) : undefined;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-[max(12px,env(safe-area-inset-top))] pb-8">
      <TituloGrande titulo="A seguir" rotulo={hoje} direita={porEmDia} />
      {nextUp === null ? (
        <div className="mt-5 space-y-3">
          {watching.slice(0, 1).map((s) => (
            <Bone key={s.uuid} className="h-[360px] w-full rounded-[28px]" />
          ))}
        </div>
      ) : queue.length === 0 ? (
        <Grupo className="mt-5">
          {/* Sem nenhuma série seguida, "estás em dia" era falso: não há nada
              na fila porque nada entrou nela. Quem só guardou séries em
              "Para ver" ficava aqui sem saber porquê. */}
          {watching.length === 0 ? (
            <Linha
              alta
              href="/explorar?procurar=1"
              antes={<Search aria-hidden className="h-6 w-6 text-label-2" strokeWidth={1.8} />}
              titulo="Ainda não segues nenhuma série"
              subtitulo="Segue uma e ela entra aqui. O que está em «Para ver» fica fora da fila."
            />
          ) : (
            <Linha
              alta
              href="/library"
              antes={<Check aria-hidden className="h-6 w-6 text-em-dia" strokeWidth={2.2} />}
              titulo="Estás em dia"
              subtitulo="Nenhum episódio por ver nas séries que segues."
            />
          )}
        </Grupo>
      ) : (
        <>
          <div className="mt-5">
            <TonightHero
              key={heroShow.uuid}
              show={heroShow}
              episode={nextUp.get(heroShow.uuid)!.episode}
              watchedCount={heroShow.watchedCount}
              totalEpisodes={heroShow.totalEpisodes}
              eyebrow={
                heroKind === "retomar"
                  ? "Retomar onde ficaste"
                  : heroKind === "comecar"
                    ? "Começar do início"
                    : undefined
              }
              onCheck={(season, episode) => handleCheck(heroShow.uuid, season, episode)}
            />
          </div>
          <OuEntao alternativas={alternativas} />
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
              cabeçalho onde vivia o atalho. Sem cor própria: um cabeçalho
              usa as neutras da mira (tinha o ciano dos buracos). */}
          <SectionHeader
            label="Esta semana"
            meta={
              <Link
                href="/estrear"
                className="tap-44 relative hover:text-ink hover:underline"
              >
                {estaSemana.length > 0 ? `${estaSemana.length} · ver tudo` : "ver tudo"}
              </Link>
            }
          />
          {estaSemana.length === 0 ? (
            <p className="mt-3 text-[0.9375rem] text-dim">
              Nada esta semana — o próximo é {upcoming[0].show.name}, a{" "}
              {curta(upcoming[0].episode.airDate as string)}.
            </p>
          ) : (
          <div className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-2">
            {estaSemana.slice(0, 10).map(({ show, episode }) => (
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
                  <p className="truncate text-[0.9375rem] font-semibold leading-tight">
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
          )}
        </section>
      )}

      <p className="mt-10 text-center">
        <Link
          href="/library"
          className="inline-flex min-h-11 cursor-pointer items-center px-3 text-[0.9375rem] font-semibold text-dim hover:text-ink hover:underline"
        >
          Ver toda a biblioteca ({shows.length}) →
        </Link>
      </p>
    </main>
  );
}
