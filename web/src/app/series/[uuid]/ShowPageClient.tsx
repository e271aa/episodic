"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  episodeKey,
  getShow,
  getWatchedForShow,
  markWatched,
  markWatchedMany,
  unmarkWatched,
  unmarkWatchedMany,
  updateShow,
  type StoredShow,
  type WatchedEpisode,
} from "@/lib/db";
import { enrichShow, getEpisodesOfSeason, getSeasons, type MetaEpisode } from "@/lib/metadata";
import { findNextUnwatched, formatEpCode } from "@/lib/watchnext";
import { contarEpisodios, encontrarBuracos } from "@/lib/buracos";
import { agruparEpisodios } from "@/lib/episodeRuns";
import { pushUndo } from "@/lib/undo";
import ProgressRing from "@/components/ProgressRing";
import AddToListButton from "@/components/AddToListButton";
import StreamingBadges from "@/components/StreamingBadges";
import Poster from "@/components/Poster";
import BotaoVoltar from "@/components/BotaoVoltar";
import { Bone, CardsBone, DetailHeaderBone } from "@/components/Skeleton";
import { ArrowLeftIcon, CheckIcon, ChevronDownIcon } from "@/components/icons";
import { curta, porExtenso } from "@/lib/datas";
import { translateGenre } from "@/lib/stats";

/**
 * Uma linha de episódio, repetida em dois sítios: sozinha na lista, e dentro
 * de uma corrida aberta. Visto e por ver distinguem-se sem depender só do
 * círculo de 26px — a linha toda de um episódio visto fica mais apagada, a
 * de um por ver fica a negrito. Antes as duas liam-se igual a um metro de
 * distância, numa lista de 51 linhas quase idênticas.
 */
function EpisodeRow({
  season,
  epNumber,
  metaEp,
  isSeen,
  isPulsing,
  accent,
  onToggle,
}: {
  season: number;
  epNumber: number;
  metaEp: MetaEpisode | undefined;
  isSeen: boolean;
  isPulsing: boolean;
  accent: string;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      data-testid={`ep-${season}-${epNumber}`}
      className={`flex h-[52px] w-full cursor-pointer items-center gap-3 rounded-lg px-2 text-left transition-colors hover:bg-raised ${
        isSeen ? "opacity-60" : ""
      }`}
    >
      <span className="ep-code w-[34px] shrink-0 text-[0.8125rem] text-faint">
        E{String(epNumber).padStart(2, "0")}
      </span>
      <span
        aria-hidden
        className={`relative flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
          isPulsing ? "check-pop check-ring" : ""
        }`}
        style={
          isSeen
            ? { borderColor: accent, background: accent, color: "var(--color-tube)" }
            : { borderColor: "var(--color-line)", color: "transparent" }
        }
      >
        ✓
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-base ${isSeen ? "text-dim" : "font-medium text-ink"}`}
        >
          {metaEp?.name ?? `Episódio ${epNumber}`}
        </span>
        {metaEp?.airDate && (
          <span className="ep-code block text-xs text-faint">{porExtenso(metaEp.airDate)}</span>
        )}
      </span>
    </button>
  );
}

interface SeasonView {
  /** posição na lista (1, 2, 3…) — a numeração que o TV Time assume e que
   * guardamos localmente; nunca o número literal do fornecedor (ver nota em
   * watchnext.ts sobre animes longos indexados por ano de emissão) */
  number: number;
  /** número real a pedir ao fornecedor (TMDB/TVmaze) — só para buscar dados */
  providerNumber: number;
  name: string;
  /**
   * Os que já estrearam. Contava os anunciados também, e uma série em dia
   * passava a "10 por ver" no dia em que a temporada seguinte era anunciada.
   * Tudo neste ecrã que diz "completa", "por ver" ou "marcar temporada" lê
   * daqui (Ronda 12).
   */
  episodeCount: number;
  /** anunciados, ainda por estrear — mostram-se, não se contam */
  anunciados: number;
  fromProvider: boolean;
}

type Tab = "episodios" | "sobre" | "estatisticas";

const STATUS_PT: Record<string, string> = {
  Running: "Em emissão",
  Ended: "Terminada",
  Canceled: "Cancelada",
  Cancelled: "Cancelada",
  "In Development": "Em desenvolvimento",
  "To Be Determined": "Por determinar",
  "Returning Series": "Em emissão",
};

const ENDED_STATUSES = new Set(["Ended", "Canceled", "Cancelled"]);

// Mesma semântica de cor das capas: verde = em dia e ainda vem mais,
// roxo = em dia mas terminou, branco = a meio.
function stateColor(complete: boolean, status: string | null | undefined): string {
  if (!complete) return "var(--color-ink)";
  return ENDED_STATUSES.has(status ?? "") ? "var(--color-smpte-magenta)" : "var(--color-smpte-green)";
}

/** O rótulo que acompanha a barra de cor no cabeçalho — diz em palavras o
 *  que a cor já diz em cor, para quem não distingue as duas ao relance. */
function stateLabel(
  complete: boolean,
  remaining: number,
  status: string | null | undefined,
): string {
  if (!complete) return `${remaining} por ver`;
  return ENDED_STATUSES.has(status ?? "") ? "Em dia · terminada" : "Em dia";
}

export default function ShowPage() {
  const { uuid } = useParams<{ uuid: string }>();
  const [show, setShow] = useState<StoredShow | null | undefined>(undefined);
  const [watched, setWatched] = useState<Map<string, WatchedEpisode>>(new Map());
  const [seasons, setSeasons] = useState<SeasonView[]>([]);
  const [openSeason, setOpenSeason] = useState<number | null>(null);
  const [episodesBySeason, setEpisodesBySeason] = useState<Map<number, MetaEpisode[]>>(
    new Map(),
  );
  // Corridas de episódios vistos que o utilizador abriu à mão — chave
  // "temporada-início-fim". Fecha-se sozinha ao trocar de temporada por
  // omissão; não há razão para lembrar uma corrida aberta de uma série
  // diferente da que se está a ver agora.
  const [corridasAbertas, setCorridasAbertas] = useState<Set<string>>(new Set());
  const [providerMissing, setProviderMissing] = useState(false);
  const [nextUp, setNextUp] = useState<MetaEpisode | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("episodios");
  // Chave (season-episode) do episódio a "saltar" no momento em que é
  // marcado como visto, e flag equivalente para o botão de ação principal.
  const [pulseEp, setPulseEp] = useState<string | null>(null);
  // temporada que fechou agora — a faixa SMPTE atravessa-a uma vez
  const [sweepSeason, setSweepSeason] = useState<number | null>(null);
  const sweepTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [pulseNext, setPulseNext] = useState(false);
  const pulseTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /**
   * A pastilha da temporada aberta. Com seis ou mais, a faixa rola de lado e
   * abrir a última deixava-a fora do ecrã: a lista de episódios aparecia por
   * baixo sem se ver de qual temporada era.
   */
  const chipAberto = useRef<HTMLButtonElement | null>(null);

  useEffect(() => () => clearTimeout(pulseTimeout.current), []);
  useEffect(() => () => clearTimeout(sweepTimeout.current), []);

  // Só de lado: `block: "nearest"` para não puxar a página verticalmente
  // por baixo dos pés de quem acabou de tocar.
  useEffect(() => {
    if (openSeason === null) return;
    chipAberto.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [openSeason]);

  // Recarrega o mapa de vistos e recalcula qual o próximo episódio por ver.
  const syncWatched = useCallback(
    async (current: StoredShow) => {
      const list = await getWatchedForShow(uuid);
      setWatched(new Map(list.map((w) => [w.id, w])));
      const next = await findNextUnwatched(current, list);
      setNextUp(next?.episode ?? null);
    },
    [uuid],
  );

  useEffect(() => {
    void (async () => {
      const stored = await getShow(uuid);
      setShow(stored ?? null);
      if (!stored) return;
      await syncWatched(stored);

      /**
       * Enriquecimento sob demanda, como na página do filme: quem abriu esta
       * página está à espera de a ver **agora**, e não que uma passagem de
       * fundo noutro ecrã lhe chegue um dia.
       *
       * Duas razões para correr, e a segunda faltava:
       *  · faltam estreia/estado/géneros — séries importadas antes de esses
       *    campos existirem;
       *  · falta o id do TMDB — sem ele não há "Onde ver". Medido: 69 das 74
       *    séries da biblioteca estavam assim, e o portão antigo (que só
       *    olhava para os três campos acima) nunca disparava para nenhuma
       *    delas, porque a TVmaze já lhos tinha dado todos.
       *
       * `refresh` ignora a memória de "falhou há pouco" pela mesma razão que
       * o filme o faz: é uma série só, e é um pedido explícito de quem está
       * a olhar para ela.
       */
      const semTmdb = !stored.tmdbId;
      const semCampos =
        stored.status === undefined &&
        stored.firstAired === undefined &&
        stored.genres === undefined;

      let atual = stored;
      if (semTmdb || semCampos) {
        const patch = await enrichShow(stored, semTmdb);
        if (patch) {
          const updated = await updateShow(uuid, patch);
          if (updated) {
            atual = updated;
            setShow(updated);
          }
        }
      }

      // Temporadas: do fornecedor quando possível; senão do histórico local.
      // Com o registo já enriquecido — senão uma série que acabou de ganhar
      // fornecedor continuava a ser lida pelo registo velho, sem ele.
      const providerSeasons = await getSeasons(atual);
      if (providerSeasons && providerSeasons.length > 0) {
        setSeasons(
          providerSeasons.map((s, i) => ({
            number: i + 1,
            providerNumber: s.number,
            name: s.name,
            episodeCount: s.estreados,
            anunciados: s.episodeCount - s.estreados,
            fromProvider: true,
          })),
        );
        // O total guardado é o que a Biblioteca e o "A seguir" leem. Só se
        // escrevia quando faltava, e ficava para sempre com o valor de quando
        // a série foi importada — nem os episódios novos entravam, nem os
        // anunciados saíam. Abrir a série é o momento em que se sabe.
        const total = providerSeasons.reduce((sum, s) => sum + s.estreados, 0) || null;
        if (total !== atual.totalEpisodes) {
          const atualizada = await updateShow(uuid, { totalEpisodes: total });
          if (atualizada) setShow(atualizada);
        }
        return;
      }
      setProviderMissing(true);

      const local = await getWatchedForShow(uuid);
      const maxEp = new Map<number, number>();
      for (const w of local) {
        maxEp.set(w.season, Math.max(maxEp.get(w.season) ?? 0, w.episode));
      }
      setSeasons(
        [...maxEp.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([number, count]) => ({
            number,
            providerNumber: number, // sem fornecedor, é sempre a mesma numeração
            name: `Temporada ${number}`,
            episodeCount: count,
            anunciados: 0,
            fromProvider: false,
          })),
      );
    })();
  }, [uuid, syncWatched]);

  // Carrega os nomes/datas dos episódios de uma temporada (uma vez cada).
  // Pede ao fornecedor pelo número real dele, mas guarda pela posição local
  // (a mesma numeração usada nas chaves de "visto").
  const loadSeasonEpisodes = useCallback(
    async (season: SeasonView) => {
      if (episodesBySeason.has(season.number) || !show) return;
      const eps = await getEpisodesOfSeason(show, season.providerNumber);
      if (eps.length > 0) {
        setEpisodesBySeason((m) => new Map(m).set(season.number, eps));
      }
    },
    [episodesBySeason, show],
  );

  const toggleSeason = useCallback(
    async (season: SeasonView) => {
      setOpenSeason((cur) => (cur === season.number ? null : season.number));
      setCorridasAbertas(new Set());
      await loadSeasonEpisodes(season);
    },
    [loadSeasonEpisodes],
  );

  const toggleCorrida = useCallback((chave: string) => {
    setCorridasAbertas((cur) => {
      const seguinte = new Set(cur);
      if (seguinte.has(chave)) seguinte.delete(chave);
      else seguinte.add(chave);
      return seguinte;
    });
  }, []);

  const toggleEpisode = useCallback(
    async (season: number, episode: number) => {
      if (!show) return;
      const key = episodeKey(uuid, season, episode);
      const wasWatched = watched.has(key);
      if (wasWatched) {
        await unmarkWatched(uuid, season, episode);
      } else {
        await markWatched(uuid, season, episode);
        setPulseEp(key);
        clearTimeout(pulseTimeout.current);
        pulseTimeout.current = setTimeout(() => setPulseEp(null), 450);

        // Este era o último que faltava? Então a temporada fechou.
        const total = seasons.find((sv) => sv.number === season)?.episodeCount ?? 0;
        const antes = [...watched.values()].filter((w) => w.season === season).length;
        if (total > 0 && antes + 1 >= total) {
          setSweepSeason(season);
          clearTimeout(sweepTimeout.current);
          sweepTimeout.current = setTimeout(() => setSweepSeason(null), 560);
        }
      }
      await syncWatched(show);
      pushUndo({
        label: wasWatched ? "Desmarcado" : "Marcado como visto",
        detail: `${show.name} · ${formatEpCode(season, episode)}`,
        undo: async () => {
          if (wasWatched) await markWatched(uuid, season, episode);
          else await unmarkWatched(uuid, season, episode);
          await syncWatched(show);
        },
      });
    },
    [uuid, watched, show, syncWatched, seasons],
  );

  /**
   * Episódios por marcar que têm outros vistos DEPOIS deles — quase de
   * certeza esquecimentos, não pendências. Ver `lib/buracos.ts`.
   */
  const buracos = useMemo(
    () => encontrarBuracos(seasons, (t, e) => watched.has(episodeKey(uuid, t, e))),
    [seasons, watched, uuid],
  );

  const openSeasonView = useMemo(
    () => seasons.find((s) => s.number === openSeason) ?? null,
    [seasons, openSeason],
  );

  /**
   * Colapsa as corridas de episódios vistos da temporada aberta. Ver
   * `lib/episodeRuns.ts` — é o que faz o Naruto T2 passar de 51 linhas
   * (3609px, 5,5 ecrãs) para uma que cabe num ecrã.
   */
  const blocosEpisodios = useMemo(() => {
    if (!openSeasonView) return [];
    return agruparEpisodios(openSeasonView.episodeCount, (ep) =>
      watched.has(episodeKey(uuid, openSeasonView.number, ep)),
    );
  }, [openSeasonView, watched, uuid]);

  /**
   * Marca de uma vez os episódios que ficaram por marcar **atrás** do ponto
   * onde a pessoa já vai. Uma anulação só para todos: foi um gesto, desfaz-se
   * como um gesto.
   *
   * Não decide nada sozinho — só existe atrás de um botão que diz exatamente
   * quantos são e onde estão.
   */
  const marcarBuracos = useCallback(async () => {
    if (!show || buracos.total === 0) return;
    const marcados = buracos.porTemporada.flatMap((t) =>
      t.episodios.map((e) => ({ season: t.temporada, episode: e })),
    );
    if (marcados.length === 0) return;
    // Sem data certa: sabes que os viste, não quando. Com a data de hoje, as
    // estatísticas contavam-nos todos como vistos hoje (Ronda 12).
    await markWatchedMany(uuid, marcados, { exata: false });
    await syncWatched(show);
    pushUndo({
      label: `${contarEpisodios(marcados.length)} marcados`,
      detail: show.name,
      undo: async () => {
        await unmarkWatchedMany(uuid, marcados);
        await syncWatched(show);
      },
    });
  }, [show, buracos, uuid, syncWatched]);

  const markSeasonAll = useCallback(
    async (season: SeasonView) => {
      if (!show) return;
      // guarda só os que esta ação marcou — anular não pode apagar episódios
      // que já estavam vistos antes
      const marked: number[] = [];
      for (let ep = 1; ep <= season.episodeCount; ep++) {
        if (!watched.has(episodeKey(uuid, season.number, ep))) {
          await markWatched(uuid, season.number, ep);
          marked.push(ep);
        }
      }
      await syncWatched(show);
      if (marked.length === 0) return;
      pushUndo({
        label: `Temporada ${season.number} marcada`,
        detail: `${show.name} · ${marked.length} episódio${marked.length === 1 ? "" : "s"}`,
        undo: async () => {
          for (const ep of marked) await unmarkWatched(uuid, season.number, ep);
          await syncWatched(show);
        },
      });
    },
    [uuid, watched, show, syncWatched],
  );

  const markNext = useCallback(async () => {
    if (!nextUp || !show) return;
    setPulseNext(true);
    clearTimeout(pulseTimeout.current);
    pulseTimeout.current = setTimeout(() => setPulseNext(false), 450);
    const { season, episode } = nextUp;
    await markWatched(uuid, season, episode);
    // abre a temporada do próximo (com os nomes dos episódios) para dar
    // feedback visual do avanço
    setOpenSeason(season);
    const seasonView = seasons.find((s) => s.number === season);
    if (seasonView) await loadSeasonEpisodes(seasonView);
    await syncWatched(show);
    pushUndo({
      label: "Marcado como visto",
      detail: `${show.name} · ${formatEpCode(season, episode)}`,
      undo: async () => {
        await unmarkWatched(uuid, season, episode);
        await syncWatched(show);
      },
    });
  }, [nextUp, show, uuid, syncWatched, loadSeasonEpisodes, seasons]);

  const toggleWatchlist = useCallback(async () => {
    if (!show) return;
    const inWatchlist = !show.inWatchlist;
    const updated = await updateShow(uuid, { inWatchlist });
    if (updated) setShow(updated);
    pushUndo({
      label: inWatchlist ? "Adicionado a para ver" : "Removido de para ver",
      detail: show.name,
      undo: async () => {
        const reverted = await updateShow(uuid, { inWatchlist: !inWatchlist });
        if (reverted) setShow(reverted);
      },
    });
  }, [show, uuid]);

  // Sem as especiais (temporada 0): o total do fornecedor só conta episódios
  // regulares, por isso incluí-las dava "90/88" no Prison Break. Continuam
  // marcadas e continuam a contar nas estatísticas do perfil.
  const watchedCount = useMemo(
    () => [...watched.values()].filter((w) => w.season !== 0).length,
    [watched],
  );
  const backdropPath = show?.backdropPath ?? null;
  const percent = show?.totalEpisodes
    ? (watchedCount / show.totalEpisodes) * 100
    : null;

  const seasonWatchedCount = useMemo(() => {
    const counts = new Map<number, number>();
    for (const w of watched.values()) {
      counts.set(w.season, (counts.get(w.season) ?? 0) + 1);
    }
    return counts;
  }, [watched]);

  const temporadasComBuraco = useMemo(
    () => new Set(buracos.porTemporada.map((t) => t.temporada)),
    [buracos],
  );

  const activity = useMemo(() => {
    const dates = [...watched.values()].map((w) => w.watchedAt).sort();
    if (dates.length === 0) return null;
    // Comparar os ISO crus (ordenam bem na mesma) e só formatar no fim —
    // "2024-06-26 → 2024-07-01" tinha escapado à limpeza da 5b.1.
    const primeiro = dates[0].slice(0, 10);
    const ultimo = dates[dates.length - 1].slice(0, 10);
    return {
      mesmoDia: primeiro === ultimo,
      first: curta(dates[0]),
      last: curta(dates[dates.length - 1]),
    };
  }, [watched]);

  if (show === undefined) {
    return (
      <main className="mx-auto w-full max-w-2xl">
        <DetailHeaderBone />
        <div className="px-4">
          <Bone className="mt-5 h-14 w-full rounded-2xl" />
          <CardsBone count={4} height="h-14" />
        </div>
      </main>
    );
  }
  if (show === null) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-dim">Série não encontrada.</p>
        <BotaoVoltar
          label="Voltar às séries"
          fallback="/series"
          className="mt-4 inline-block cursor-pointer text-ink underline"
        >
          Voltar às séries
        </BotaoVoltar>
      </main>
    );
  }

  const year = show.firstAired?.slice(0, 4);
  const genreBits = show.genres
    ?.slice(0, 2)
    .map(translateGenre)
    .join(" · ")
    .toUpperCase();
  const showComplete =
    show.totalEpisodes != null && watchedCount >= show.totalEpisodes;
  const accent = stateColor(showComplete, show.status);
  const remaining = show.totalEpisodes != null ? show.totalEpisodes - watchedCount : 0;
  /**
   * "22 por ver" era a mesma frase para duas coisas diferentes: episódios que
   * faltam mesmo ver, e episódios que já foram vistos e ficaram por marcar.
   * Quem tem 22 buracos atrás não tem 22 por ver — tem 22 por arrumar.
   */
  const porVerAFrente = Math.max(0, remaining - buracos.total);
  const label =
    buracos.total > 0
      ? porVerAFrente > 0
        ? `${porVerAFrente} por ver · ${buracos.total} por marcar`
        : `${buracos.total} por marcar`
      : stateLabel(showComplete, remaining, show.status);
  const metaLine = [
    year,
    genreBits,
    show.totalEpisodes != null
      ? `${watchedCount}/${show.totalEpisodes} EP`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    // Sem padding em baixo: a moldura (layout.tsx) já reserva o espaço da
    // dock, e reservá-lo aqui outra vez deixava 188px de nada por baixo das
    // temporadas fechadas (medido — Ronda 12, Fase 5b.3)
    <main className="mx-auto w-full max-w-2xl">
      {/* O backdrop É a identidade — sem cartaz sobreposto. O título vive no
          terço de baixo, por cima do gradiente, tal como no herói do "A
          seguir": a arte respira em cima, o texto lê-se em baixo. */}
      {/* Sem `-mx-4`: o `<main>` acima não tem padding horizontal, por isso a
          margem negativa não tinha nada para cancelar — esticava o herói 16px
          para fora e a página inteira rolava de lado. Medido: documento a
          406px num ecrã de 390. Os blocos a seguir trazem o seu próprio
          `px-4`; este é de bordo a bordo por natureza. */}
      {/* A altura era 420px fixos, e num ecrã de 664px isso é 63% de arte
          antes de uma única informação — medido. `min(52vh, 420px)` mantém
          os 420 nos telemóveis grandes e encolhe nos pequenos, que é onde
          o problema existia. */}
      <div className="relative h-[min(52vh,420px)] overflow-hidden bg-panel">
        {backdropPath ? (
          <Poster
            path={backdropPath}
            alt=""
            size="w780"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-raised to-panel" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-tube via-tube/75 via-45% to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-tube/70 to-transparent" />
        {/* Barra de estado e de progresso, na fronteira entre a arte e o
            conteúdo. Estava no topo, encostada ao entalhe e por cima da
            parte mais clara do backdrop, onde não se via; e dizia só "como
            está esta série" (a cor), nunca "onde vou nela". Agora a cor
            continua a dizer o estado e o **preenchimento** diz o progresso:
            198/220 lia-se em texto mono de 13px e mais nada. */}
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-line">
          <div
            className="h-full transition-[width] duration-[320ms] ease-out"
            style={{ width: `${percent ?? 0}%`, background: accent }}
            data-testid="heroi-progresso"
          />
        </div>

        <BotaoVoltar
          label="Voltar às séries"
          fallback="/series"
          className="absolute left-4 top-4 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-tube/60 text-ink backdrop-blur transition active:scale-90"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </BotaoVoltar>

        <div className="absolute inset-x-4 bottom-5">
          <div className="flex items-center gap-2.5">
            {/* Com buracos para trás, o traço é o ciano dos buracos — o
                rótulo diz "por marcar", e a cor tem de dizer o mesmo. */}
            <span
              aria-hidden
              data-testid="heroi-traco"
              className="h-[14px] w-[3px] shrink-0 rounded-full"
              style={{ background: buracos.total > 0 ? "var(--color-smpte-cyan)" : accent }}
            />
            <p className="ep-code text-[0.8125rem] text-dim">{label}</p>
          </div>
          <h1 className="mt-1.5 font-display text-[2.25rem] font-bold leading-[1] text-ink [font-stretch:110%]">
            {show.name}
          </h1>
          {metaLine && <p className="ep-code mt-2 text-sm text-dim">{metaLine}</p>}
        </div>
      </div>

      <div className="px-4">
        {/* Episódios por marcar ATRÁS do ponto onde já se vai. Fica antes da
            ação principal de propósito: não faz sentido propor o próximo
            episódio a quem tem 22 esquecidos para trás — e era exatamente
            isso que a app fazia, sem nunca dizer que eles existiam.

            Repara no que NÃO diz: não afirma que os viste. Diz onde estão e
            oferece-se para os marcar. A decisão é tua. */}
        {buracos.total > 0 && (
          <div
            className="page-enter mt-4 rounded-2xl border border-line bg-raised/60 p-4"
            data-testid="aviso-buracos"
          >
            <p className="font-display text-[0.9375rem] font-semibold text-ink">
              {contarEpisodios(buracos.total)} por marcar mais atrás
            </p>
            <p className="mt-1 text-[0.9375rem] text-dim">
              {buracos.porTemporada
                .map((t) => `T${t.temporada}: ${t.episodios.length}`)
                .join(" · ")}
              {" — já viste episódios depois destes."}
            </p>
            <button
              onClick={() => void marcarBuracos()}
              data-testid="marcar-buracos"
              className="mt-3 flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-ink text-[0.9375rem] font-semibold text-tube transition hover:brightness-110 active:scale-[0.99]"
            >
              <CheckIcon className="h-4 w-4" />
              Marcar {buracos.total === 1 ? "o episódio" : `os ${buracos.total}`}
            </button>
          </div>
        )}

        {/* Ação principal — a decisão nº 1 na página de série. Sem episódio
            por marcar não há ação nenhuma a propor: o cabeçalho já disse "Em
            dia" a par do título, repetir num cartão por baixo era a mesma
            frase duas vezes na mesma página.

            Com buracos por marcar deixa de ser a principal: eram dois blocos
            brancos iguais empilhados, os dois a pedir o toque com o mesmo
            peso, e a página tem uma decisão nº 1 de cada vez. Quem tem 22
            esquecidos atrás arruma-os primeiro — foi essa a ordem decidida
            na Fase 1, e o desenho passa a dizer o mesmo que a ordem. */}
        {nextUp === undefined ? (
          <Bone className="mt-4 h-14 w-full rounded-2xl" />
        ) : nextUp ? (
          <button
            onClick={() => void markNext()}
            data-testid="mark-next"
            className={`mt-4 flex w-full cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-left transition active:scale-[0.99] ${
              buracos.total > 0
                ? "border border-line text-ink hover:border-ink/40 hover:bg-raised"
                : "bg-ink text-tube hover:brightness-110"
            }`}
          >
            <CheckIcon className={`h-6 w-6 shrink-0 ${pulseNext ? "check-pop" : ""}`} />
            <span className="min-w-0 flex-1">
              <span className="block text-[0.9375rem] font-semibold">Marcar próximo episódio</span>
              <span className="ep-code block truncate text-xs opacity-80">
                {formatEpCode(nextUp.season, nextUp.episode)} · {nextUp.name}
              </span>
            </span>
          </button>
        ) : null}

        {/* Lista e Onde ver DEPOIS de marcar (escolhido pelo Ruben a 27-09,
            Ronda 12, Fase 5b.3): marcar é a razão de se abrir uma série, e
            com buracos o "Marcar próximo episódio" ficava 20% livre ao
            chegar — o resto debaixo da dock. Agora as duas ações de marcar
            estão inteiras à vista. */}
        {/* Duas ações, sempre as mesmas duas perguntas: juntar a uma lista,
            ver onde passa. Lado a lado, mesmo peso — nenhuma é secundária
            da outra. */}
        <div className="mt-4 flex gap-2.5">
          <AddToListButton
            kind="show"
            refId={uuid}
            label="Lista"
            wrapperClassName="relative flex-1"
            className="flex h-12 w-full cursor-pointer items-center justify-center rounded-full border border-line bg-raised/60 text-[0.9375rem] font-medium text-ink backdrop-blur transition active:scale-95"
          />
          <StreamingBadges kind="tv" tmdbId={show.tmdbId} variant="action" />
        </div>

        {/* só faz sentido para quem não está a seguir ativamente — uma série
            já em acompanhamento não precisa de "para ver" a redundar */}
        {!show.followed && (
          <button
            onClick={() => void toggleWatchlist()}
            className={`mt-2.5 flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-full border px-4 text-[0.9375rem] font-medium transition active:scale-95 ${
              show.inWatchlist
                ? "border-ink/60 bg-raised text-ink"
                : "border-line text-dim hover:border-ink hover:text-ink"
            }`}
          >
            {show.inWatchlist && <CheckIcon className="h-3.5 w-3.5" />}
            {show.inWatchlist ? "Na lista para ver" : "Para ver"}
          </button>
        )}

        {/* Separadores. Com o texto grande não cabem os três numa linha
            ("Estatísticas" chegava aos 428px num ecrã de 390, 5b.4): rolam
            de lado dentro da própria faixa, em vez de alargar a página. */}
        <div
          className="mt-6 flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none]"
          role="tablist"
        >
          {(
            [
              ["episodios", "Episódios"],
              ["sobre", "Sobre"],
              ["estatisticas", "Estatísticas"],
            ] as const
          ).map(([id, label], i, todos) => (
            <button
              key={id}
              role="tab"
              id={`tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`painel-${id}`}
              // Um `role="tab"` sem isto é meio padrão: o leitor de ecrã
              // anuncia "separador" e depois o teclado percorre-os um a um
              // como se fossem botões soltos. Setas andam entre eles, e só
              // o ativo é que entra na ordem do Tab (WAI-ARIA).
              tabIndex={tab === id ? 0 : -1}
              onKeyDown={(e) => {
                const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
                if (!delta) return;
                e.preventDefault();
                const proximo = todos[(i + delta + todos.length) % todos.length][0];
                setTab(proximo);
                document.getElementById(`tab-${proximo}`)?.focus();
              }}
              onClick={() => setTab(id)}
              data-testid={`tab-${id}`}
              className={`-mb-px flex min-h-11 shrink-0 cursor-pointer items-center border-b-2 px-3 text-[0.9375rem] whitespace-nowrap transition-colors ${
                tab === id
                  ? "border-ink font-semibold text-ink"
                  : "border-transparent text-dim hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "episodios" && (
          <section className="mt-4" id="painel-episodios" role="tabpanel" aria-labelledby="tab-episodios">
            {providerMissing && (
              <p className="mb-3 rounded-lg border border-line bg-raised p-3 text-xs text-dim">
                Não foi possível obter a lista completa de episódios (série não mapeada
                ou sem ligação) — mostramos só as temporadas com episódios vistos.
              </p>
            )}

            {seasons.length === 0 ? (
              <p className="text-[0.9375rem] text-dim">Sem informação de temporadas.</p>
            ) : (
              <>
                {/* Temporadas como faixas: cinco toques em vez de uma lista de
                    cinco cartões, e o estado de todas lê-se de uma vez, sem
                    abrir nada. Até 5 dividem o espaço todo; mais do que isso
                    (animes longos, séries de 20 temporadas) passam a scroll
                    horizontal com largura fixa — cinco a espremer-se até à
                    ilegibilidade não é "ver tudo de uma vez", é o oposto. */}
                <div
                  className={
                    seasons.length > 5
                      ? "-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1"
                      : "flex gap-2"
                  }
                >
                  {seasons.map((season) => {
                    const seen = seasonWatchedCount.get(season.number) ?? 0;
                    const complete = season.episodeCount > 0 && seen >= season.episodeCount;
                    const cor = stateColor(complete, show.status);
                    const selected = openSeason === season.number;
                    // `29/51` servia para "faltam 22 no fim" e para "faltam 22
                    // no meio" — e são coisas diferentes. O ponto diz qual é.
                    const temBuraco = temporadasComBuraco.has(season.number);
                    return (
                      <button
                        key={season.number}
                        onClick={() => void toggleSeason(season)}
                        data-testid={`season-${season.number}`}
                        aria-pressed={selected}
                        aria-label={
                          season.episodeCount === 0
                            ? `Temporada ${season.number}, ainda não estreou`
                            : `Temporada ${season.number}, ${seen} de ${season.episodeCount} vistos` +
                              (temBuraco ? ", com episódios por marcar mais atrás" : "")
                        }
                        ref={(el) => {
                          if (selected) chipAberto.current = el;
                        }}
                        className={`relative h-[72px] shrink-0 cursor-pointer snap-start overflow-hidden rounded-xl border transition-colors ${
                          seasons.length > 5 ? "w-16" : "flex-1"
                        } ${
                          selected
                            ? "border-ink/40 bg-raised"
                            : "border-line bg-panel hover:border-ink/25"
                        } ${sweepSeason === season.number ? "season-sweep" : ""}`}
                      >
                        {temBuraco && (
                          <span
                            aria-hidden
                            className="absolute right-1.5 top-[7px] h-[7px] w-[7px] rounded-full"
                            style={{ background: "var(--color-smpte-cyan)" }}
                          />
                        )}
                        <span className="flex h-full flex-col items-center justify-center gap-0.5">
                          <span className="ep-code text-[0.9375rem] font-semibold text-ink">
                            {season.number}
                          </span>
                          <span className="ep-code text-[0.6875rem] text-faint">
                            {season.episodeCount === 0 ? "breve" : `${seen}/${season.episodeCount}`}
                          </span>
                        </span>
                        {/* O quanto da temporada já foi visto, em largura.
                            `29/51` e `50/50` desenhavam-se iguais — o mesmo
                            retângulo, a mesma pastilha — e a diferença ficava
                            num texto de 11px. Com o preenchimento, a faixa
                            toda passa a ler-se de relance como a forma do
                            percurso pela série.

                            Uma barra só, em baixo: havia outra igual em cima
                            a dizer o estado pela cor, e numa temporada
                            completa as duas ficavam idênticas — o chip com
                            uma moldura verde em cima e em baixo, que se lê
                            como caixa e não como informação. A cor aqui diz
                            o estado, a largura diz o progresso. */}
                        <span
                          aria-hidden
                          className="absolute inset-x-0 bottom-0 h-[3px] bg-line"
                        >
                          <span
                            className="block h-full transition-[width] duration-[320ms] ease-out"
                            style={{
                              width:
                                season.episodeCount > 0
                                  ? `${Math.min(100, (seen / season.episodeCount) * 100)}%`
                                  : "0%",
                              background: cor,
                            }}
                          />
                        </span>
                      </button>
                    );
                  })}
                </div>

                {(() => {
                  const season = openSeasonView;
                  if (!season) return null;
                  const seen = seasonWatchedCount.get(season.number) ?? 0;
                  const complete = season.episodeCount > 0 && seen >= season.episodeCount;
                  const episodes = episodesBySeason.get(season.number);
                  return (
                    <div className="mt-4">
                      {/* Fixo ao rolar: à 3ª linha já se tinha perdido de
                          vista em que temporada se estava, numa lista que
                          agora pode ter dezenas de linhas por baixo. O
                          respiro do topo repete o da barra do estado do
                          telemóvel — aqui é que fica flush com o topo do
                          ecrã, o herói é que normalmente o cobre. */}
                      <div className="sticky top-0 z-10 -mx-4 bg-tube px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-display text-[0.9375rem] font-semibold">
                            {season.name}
                          </p>
                          {!complete && season.episodeCount > 0 && (
                            <button
                              onClick={() => void markSeasonAll(season)}
                              className="cursor-pointer text-xs font-semibold text-ink hover:underline"
                            >
                              Marcar temporada como vista
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col">
                        {blocosEpisodios.map((bloco) => {
                          if (bloco.tipo === "unico") {
                            const metaEp = episodes?.find((e) => e.episode === bloco.episodio);
                            const key = episodeKey(uuid, season.number, bloco.episodio);
                            return (
                              <EpisodeRow
                                key={bloco.episodio}
                                season={season.number}
                                epNumber={bloco.episodio}
                                metaEp={metaEp}
                                isSeen={watched.has(key)}
                                isPulsing={pulseEp === key}
                                accent={accent}
                                onToggle={() => void toggleEpisode(season.number, bloco.episodio)}
                              />
                            );
                          }

                          const chave = `${season.number}-${bloco.inicio}-${bloco.fim}`;
                          const contagem = bloco.fim - bloco.inicio + 1;
                          const codigo = `E${String(bloco.inicio).padStart(2, "0")}–E${String(bloco.fim).padStart(2, "0")}`;

                          if (corridasAbertas.has(chave)) {
                            return (
                              <div key={chave}>
                                <button
                                  onClick={() => toggleCorrida(chave)}
                                  className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg px-2 text-left text-xs font-semibold text-faint hover:bg-raised"
                                >
                                  <ChevronDownIcon className="h-3.5 w-3.5 rotate-180" />
                                  Fechar {codigo}
                                </button>
                                {Array.from(
                                  { length: contagem },
                                  (_, i) => bloco.inicio + i,
                                ).map((epNumber) => {
                                  const metaEp = episodes?.find((e) => e.episode === epNumber);
                                  const key = episodeKey(uuid, season.number, epNumber);
                                  return (
                                    <EpisodeRow
                                      key={epNumber}
                                      season={season.number}
                                      epNumber={epNumber}
                                      metaEp={metaEp}
                                      isSeen={watched.has(key)}
                                      isPulsing={pulseEp === key}
                                      accent={accent}
                                      onToggle={() => void toggleEpisode(season.number, epNumber)}
                                    />
                                  );
                                })}
                              </div>
                            );
                          }

                          return (
                            <button
                              key={chave}
                              onClick={() => toggleCorrida(chave)}
                              data-testid={`corrida-${chave}`}
                              className="flex h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-2 text-left text-dim transition-colors hover:bg-raised"
                            >
                              <span className="ep-code w-[70px] shrink-0 text-[0.75rem] text-faint">
                                {codigo}
                              </span>
                              <span
                                aria-hidden
                                className="flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-bold"
                                style={{ background: accent, color: "var(--color-tube)" }}
                              >
                                ✓
                              </span>
                              <span className="flex-1 text-[0.9375rem]">
                                {contagem} episódios vistos
                              </span>
                              <ChevronDownIcon className="h-4 w-4 shrink-0 text-faint" />
                            </button>
                          );
                        })}
                        {/* Anunciados: mostram-se, com a data, mas não se
                            marcam nem contam — ninguém viu um episódio que
                            ainda não estreou. */}
                        {Array.from(
                          { length: season.anunciados },
                          (_, i) => season.episodeCount + i + 1,
                        ).map((epNumber) => {
                          const metaEp = episodes?.find((e) => e.episode === epNumber);
                          return (
                            <div
                              key={epNumber}
                              data-testid={`anunciado-${season.number}-${epNumber}`}
                              className="flex h-[52px] items-center gap-3 px-2 text-faint"
                            >
                              <span className="ep-code w-[34px] shrink-0 text-[0.8125rem]">
                                E{String(epNumber).padStart(2, "0")}
                              </span>
                              <span className="h-[26px] w-[26px] shrink-0 rounded-full border-2 border-dashed border-line" aria-hidden />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-base">
                                  {metaEp?.name ?? `Episódio ${epNumber}`}
                                </span>
                                <span className="ep-code block text-xs">
                                  {metaEp?.airDate
                                    ? `estreia a ${curta(metaEp.airDate)}`
                                    : "por estrear"}
                                </span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </section>
        )}

        {tab === "sobre" && (
          <section className="mt-4 space-y-4" id="painel-sobre" role="tabpanel" aria-labelledby="tab-sobre">
            {show.overview ? (
              <p className="text-base leading-relaxed text-dim">{show.overview}</p>
            ) : (
              <p className="text-[0.9375rem] text-dim">Sem sinopse disponível.</p>
            )}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[0.9375rem]">
              {show.firstAired && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-faint">Estreia</dt>
                  <dd className="ep-code mt-0.5">{porExtenso(show.firstAired)}</dd>
                </div>
              )}
              {show.status && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-faint">Estado</dt>
                  <dd className="mt-0.5">{STATUS_PT[show.status] ?? show.status}</dd>
                </div>
              )}
              {show.totalEpisodes != null && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-faint">
                    Episódios
                  </dt>
                  <dd className="ep-code mt-0.5">{show.totalEpisodes}</dd>
                </div>
              )}
              {show.genres && show.genres.length > 0 && (
                <div className="col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-faint">Géneros</dt>
                  <dd className="mt-1 flex flex-wrap gap-1.5">
                    {show.genres.map((g) => (
                      <span
                        key={g}
                        className="rounded-full bg-raised px-2.5 py-0.5 text-xs text-dim"
                      >
                        {translateGenre(g)}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
            {show.imdbId && (
              <a
                href={`https://www.imdb.com/title/${show.imdbId}/`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 cursor-pointer items-center text-[0.9375rem] text-ink hover:underline"
              >
                Ver no IMDb ↗
              </a>
            )}
          </section>
        )}

        {tab === "estatisticas" && (
          <section className="mt-4" id="painel-estatisticas" role="tabpanel" aria-labelledby="tab-estatisticas">
            <div className="flex items-center gap-4 rounded-2xl border border-line bg-panel p-4">
              {percent !== null ? (
                <ProgressRing percent={percent} size={72} stroke={6} color={accent} />
              ) : (
                <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 border-line">
                  <span className="ep-code text-lg font-bold">{watchedCount}</span>
                </div>
              )}
              <div>
                <p className="ep-code text-2xl font-bold text-ink">
                  {watchedCount}
                  {show.totalEpisodes ? ` / ${show.totalEpisodes}` : ""}
                </p>
                <p className="text-[0.9375rem] text-dim">episódios vistos</p>
                {activity && (
                  <p className="ep-code mt-1 text-xs text-faint">
                    {activity.mesmoDia ? activity.first : `${activity.first} → ${activity.last}`}
                  </p>
                )}
              </div>
            </div>

            <h3 className="mt-6 font-display text-[0.9375rem] font-semibold text-dim">
              Progresso por temporada
            </h3>
            <div className="mt-3 space-y-2.5">
              {seasons.map((season) => {
                const seen = seasonWatchedCount.get(season.number) ?? 0;
                const pct =
                  season.episodeCount > 0 ? (seen / season.episodeCount) * 100 : 0;
                return (
                  <div key={season.number}>
                    <div className="flex justify-between text-xs">
                      <span className="text-dim">{season.name}</span>
                      <span className="ep-code text-faint">
                        {seen}/{season.episodeCount}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-raised">
                      <div
                        className="h-full rounded-full transition-[width] duration-[240ms] ease-out"
                        style={{
                          width: `${pct}%`,
                          background: pct >= 100 ? accent : "var(--color-ink)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
