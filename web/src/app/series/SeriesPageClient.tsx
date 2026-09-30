"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getAllWatched, getWatchedForShow, kvGet, kvSet, markWatched, unmarkWatched, updateShow } from "@/lib/db";
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
import TonightHero from "@/components/TonightHero";
import OuEntao, { type Alternativa } from "@/components/OuEntao";
import Poster from "@/components/Poster";
import { Check, ChevronDown, Search } from "lucide-react";
import { Bone } from "@/components/Skeleton";
import TituloGrande from "@/components/mira/TituloGrande";
import { Grupo, Linha } from "@/components/mira/Grupo";
import Codigo from "@/components/mira/Codigo";
import LinhaFila from "@/components/mira/LinhaFila";
import DicaInstalar from "@/components/mira/DicaInstalar";

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
  // O diário no cabeçalho (a assinatura, Fase 3): quantos episódios viste hoje.
  // A noite acaba em «viste», não só em «falta». Lido uma vez; cada marcação
  // soma, cada anulação tira.
  const [vistosHoje, setVistosHoje] = useState(0);
  useEffect(() => {
    const dia = new Date(now).toDateString();
    void getAllWatched().then((todos) =>
      setVistosHoje(todos.filter((w) => new Date(w.watchedAt).toDateString() === dia).length),
    );
  }, [now]);
  const rotulo = (
    <>
      {hoje}
      {vistosHoje > 0 && (
        <span key={vistosHoje} className="diario-entra" data-testid="diario">
          {" · "}
          <Codigo className="font-semibold">{vistosHoje}</Codigo> {vistosHoje === 1 ? "episódio" : "episódios"}
        </span>
      )}
    </>
  );
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

      setVistosHoje((n) => n + 1);
      // «S01·E04 visto», e o nome por baixo; fechar uma temporada diz-se
      const temporadaFechada = next ? next.episode.season > season : false;
      const nestaTemporada = watched.filter((w) => w.season === season).length;
      pushUndo({
        label: temporadaFechada
          ? `T${season} completa · ${nestaTemporada} ${nestaTemporada === 1 ? "episódio" : "episódios"}`
          : `${formatEpCode(season, episode)} visto`,
        detail: show.name,
        undo: async () => {
          await unmarkWatched(showUuid, season, episode);
          setVistosHoje((n) => Math.max(0, n - 1));
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
      <main className="mx-auto w-full max-w-2xl px-4 pt-[var(--topo-pagina)]">
        <TituloGrande titulo="A seguir" rotulo={rotulo} />
        {esqueleto && (
          <div className="mt-5 overflow-hidden rounded-[28px] bg-group" data-testid="esqueleto-casa">
            <Bone className="h-44 w-full rounded-none" />
            <div className="flex flex-col gap-3.5 px-[18px] pb-[18px] pt-4">
              <Bone className="h-8 w-2/3 rounded-[8px]" />
              <Bone className="h-5 w-1/2 rounded-[6px]" />
              <Bone className="h-1 w-full rounded-[2px]" />
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
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pt-[var(--topo-pagina)]">
        <TituloGrande titulo="A seguir" rotulo={rotulo} />
        {/* A carta de teste: um dos dois sítios da mira (Regra da mira) — aqui
            quer dizer «ainda não há nada a passar». Composta a sério, como a
            SMPTE: as sete barras em cima, e por baixo a fila de acerto
            (azul, preto, magenta, preto, ciano, preto, cinza). Cores fixas:
            uma carta de teste não muda com o modo. 132px; num ecrã baixo
            (Safari com as barras, 664px), 96, para as portas ficarem acima
            do degradê ao chegar. */}
        <div
          aria-hidden
          className="mt-5 grid h-[132px] grid-rows-[3fr_1fr] overflow-hidden rounded-[24px] shadow-[inset_0_0_0_0.5px_var(--m-separator)] [@media(max-height:700px)]:h-24"
          data-testid="mira-sem-sinal"
        >
          <div className="grid grid-cols-7">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <span key={n} style={{ background: `var(--mira-${n})` }} />
            ))}
          </div>
          <div className="grid grid-cols-7">
            {["--mira-7", "--mira-preto", "--mira-5", "--mira-preto", "--mira-3", "--mira-preto", "--mira-1"].map((c, i) => (
              <span key={i} style={{ background: `var(${c})` }} />
            ))}
          </div>
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
        <div className="mt-auto flex flex-col gap-2.5 pb-4 pt-5">
          <Link
            href="/explorar?procurar=1"
            className="flex min-h-[52px] cursor-pointer items-center justify-center rounded-full bg-acao text-base font-semibold text-on-label transition-transform active:scale-[0.97]"
          >
            Procurar uma série
          </Link>
          <Link
            href="/import"
            className="flex min-h-[52px] cursor-pointer items-center justify-center rounded-full bg-fill-strong text-base font-semibold text-label transition-transform active:scale-[0.97]"
          >
            Vens do TV Time? Importar
          </Link>
          <DicaInstalar />
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
    <div className="mt-2 overflow-hidden rounded-[26px] bg-group">
      {list.map((show) => (
        <LinhaFila
          key={show.uuid}
          showUuid={show.uuid}
          showName={show.name}
          posterPath={show.posterPath}
          episode={nextUp!.get(show.uuid)!.episode}
          watchedCount={show.watchedCount}
          totalEpisodes={show.totalEpisodes}
          onCheck={(season, episode) => handleCheck(show.uuid, season, episode)}
        />
      ))}
    </div>
  );

  // «Retomar» e «Por começar» fecham-se, como no TV Time: o título da secção
  // é o botão, com a contagem em mono e o porquê numa linha por baixo (a 5b.4
  // cortava-o a meio, «nenhu…»).
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
      className="flex min-h-11 w-full cursor-pointer items-center gap-3 px-1 text-left"
    >
      <span className="min-w-0 flex-1">
        <h2 className="text-[1.3rem] font-bold leading-tight text-label">
          {title} <Codigo className="text-[0.94rem] font-medium text-label-2">{count}</Codigo>
        </h2>
        <span className="block text-[0.88rem] leading-snug text-label-2">{hint}</span>
      </span>
      <ChevronDown
        aria-hidden
        strokeWidth={2.4}
        className={`h-5 w-5 shrink-0 text-label-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      />
    </button>
  );

  // A linha de contexto do cartão: sempre presente e com a mesma altura, para
  // o botão nunca saltar debaixo do polegar (crítica da Fase 3)
  const contextoDe = (s: ShowWithProgress, tipo: "a-seguir" | "retomar" | "comecar") => {
    if (tipo === "comecar") return "Ainda não viste nenhum episódio";
    const ultimo = nextUp?.get(s.uuid)?.lastWatchedAt;
    if (!ultimo) return tipo === "retomar" ? "Parada há mais de 30 dias" : "Na tua fila";
    const dias = Math.max(
      0,
      Math.round((new Date(now).setHours(0, 0, 0, 0) - new Date(ultimo).setHours(0, 0, 0, 0)) / 864e5),
    );
    if (tipo === "retomar") return `Parada há ${dias} dias`;
    if (dias === 0) return "Viste o anterior hoje";
    if (dias === 1) return "Viste o anterior ontem";
    return `Viste o anterior há ${dias} dias`;
  };

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
  // A que sobe para o «Ou então» sai da secção de baixo, como a do cartão:
  // a mesma série duas vezes na casa lia-se como um erro (Ruben, 29-09).
  const naOuEntao = outraSerie?.[1].uuid;
  const semOuEntao = (lista: ShowWithProgress[]) => lista.filter((s) => s.uuid !== naOuEntao);
  const continuarLista = semOuEntao(restActive);
  const retomarLista = semOuEntao(staleRest);
  const porComecarLista = semOuEntao(notStartedRest);
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
      subtitulo: ep ? (
        <>
          {porque} · <Codigo>{formatEpCode(ep.season, ep.episode)}</Codigo>
        </>
      ) : (
        porque
      ),
      posterPath: s.posterPath,
    });
  }
  if (filmeParaVer) {
    const ano = filmeParaVer.releaseDate?.slice(0, 4);
    alternativas.push({
      href: `/movies/${filmeParaVer.key}`,
      titulo: filmeParaVer.name,
      // o estado primeiro: estreito, «Filme · 2023 · par…» cortava o que importa
      subtitulo: ano ? (
        <>
          Para ver · filme de <Codigo>{ano}</Codigo>
        </>
      ) : (
        "Para ver · filme"
      ),
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
    <main className="mx-auto w-full max-w-2xl px-4 pt-[var(--topo-pagina)] pb-8">
      <TituloGrande titulo="A seguir" rotulo={rotulo} direita={porEmDia} />
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
              quebra
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
              contexto={contextoDe(heroShow, heroKind)}
              onCheck={(season, episode) => handleCheck(heroShow.uuid, season, episode)}
            />
          </div>
          <OuEntao alternativas={alternativas} />
          {continuarLista.length > 0 && (
            <section className="mt-8">
              <h2 className="px-1 text-[1.3rem] font-bold leading-tight text-label">
                Continuar <Codigo className="text-[0.94rem] font-medium text-label-2">{continuarLista.length}</Codigo>
              </h2>
              {queueCards(continuarLista)}
            </section>
          )}
        </>
      )}

      {retomarLista.length > 0 && (
        <section className="mt-8">
          {sectionToggle(
            "Retomar",
            "paradas há mais de 30 dias",
            retomarLista.length,
            showStale,
            () => setShowStale((v) => !v),
          )}
          {showStale && queueCards(retomarLista)}
        </section>
      )}

      {porComecarLista.length > 0 && (
        <section className="mt-8">
          {sectionToggle(
            "Por começar",
            "segues, mas ainda não viste nenhum episódio",
            porComecarLista.length,
            showNotStarted,
            () => setShowNotStarted((v) => !v),
          )}
          {showNotStarted && queueCards(porComecarLista)}
        </section>
      )}

      {/* "Esta semana" — o que vem a seguir ao que estás a ver. Era um ecrã
          próprio ("A estrear") quase sempre vazio; aqui responde à pergunta
          seguinte à do cartão e não custa um destino na navegação. Sem cor
          no cabeçalho: a v2 punha-lhe uma barrinha da mira, e a mira é só do
          ritual e do «sem sinal» (Regra da mira). */}
      {upcoming && upcoming.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center justify-between gap-3 px-1">
            <h2 className="text-[1.3rem] font-bold leading-tight text-label">Esta semana</h2>
            <Link
              href="/estrear"
              className="tap-44 relative text-[0.88rem] font-semibold text-label-2 active:opacity-70"
            >
              {estaSemana.length > 0 ? (
                <>
                  <Codigo>{estaSemana.length}</Codigo> · ver tudo
                </>
              ) : (
                "ver tudo"
              )}
            </Link>
          </div>
          {estaSemana.length === 0 ? (
            <p className="mt-2 px-1 text-[0.88rem] leading-snug text-label-2">
              Nada esta semana. O próximo é {upcoming[0].show.name}, a{" "}
              <Codigo>{curta(upcoming[0].episode.airDate as string)}</Codigo>.
            </p>
          ) : (
            <div className="mt-2 overflow-hidden rounded-[26px] bg-group">
              {estaSemana.slice(0, 10).map(({ show, episode }) => (
                <Linha
                  key={`${show.uuid}-${episode.season}-${episode.episode}`}
                  href={`/series/${show.uuid}`}
                  alta
                  titulo={show.name}
                  subtitulo={
                    <>
                      <Codigo className="text-label">{formatEpCode(episode.season, episode.episode)}</Codigo>
                      {episode.airDate && (
                        <>
                          {" · "}
                          <Codigo>{curta(episode.airDate)}</Codigo>
                        </>
                      )}
                    </>
                  }
                  antes={
                    <span className="relative block h-[52px] w-9 overflow-hidden rounded-[8px] bg-elevated">
                      <Poster path={show.posterPath} alt="" size="w185" fill sizes="36px" className="object-cover" />
                    </span>
                  }
                />
              ))}
            </div>
          )}
        </section>
      )}

      <DicaInstalar />
    </main>
  );
}
