"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  episodeKey,
  getShow,
  getWatchedForShow,
  markWatched,
  unmarkWatched,
  updateShow,
  type StoredShow,
  type WatchedEpisode,
} from "@/lib/db";
import { enrichShow, getEpisodesOfSeason, getSeasons, type MetaEpisode } from "@/lib/metadata";
import { findNextUnwatched, formatEpCode } from "@/lib/watchnext";
import { pushUndo } from "@/lib/undo";
import ProgressRing from "@/components/ProgressRing";
import AddToListButton from "@/components/AddToListButton";
import StreamingBadges from "@/components/StreamingBadges";
import Poster from "@/components/Poster";
import BotaoVoltar from "@/components/BotaoVoltar";
import { Bone, CardsBone, DetailHeaderBone } from "@/components/Skeleton";
import { ArrowLeftIcon, CheckIcon } from "@/components/icons";

interface SeasonView {
  /** posição na lista (1, 2, 3…) — a numeração que o TV Time assume e que
   * guardamos localmente; nunca o número literal do fornecedor (ver nota em
   * watchnext.ts sobre animes longos indexados por ano de emissão) */
  number: number;
  /** número real a pedir ao fornecedor (TMDB/TVmaze) — só para buscar dados */
  providerNumber: number;
  name: string;
  episodeCount: number;
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
  return ENDED_STATUSES.has(status ?? "") ? "#d24bd2" : "#37c837";
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

  useEffect(() => () => clearTimeout(pulseTimeout.current), []);
  useEffect(() => () => clearTimeout(sweepTimeout.current), []);

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
            episodeCount: s.episodeCount,
            fromProvider: true,
          })),
        );
        if (!atual.totalEpisodes) {
          const total = providerSeasons.reduce((sum, s) => sum + s.episodeCount, 0);
          await updateShow(uuid, { totalEpisodes: total || null });
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
      await loadSeasonEpisodes(season);
    },
    [loadSeasonEpisodes],
  );

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

  const activity = useMemo(() => {
    const dates = [...watched.values()].map((w) => w.watchedAt).sort();
    if (dates.length === 0) return null;
    return { first: dates[0].slice(0, 10), last: dates[dates.length - 1].slice(0, 10) };
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
  const genreBits = show.genres?.slice(0, 2).join(" · ").toUpperCase();
  const showComplete =
    show.totalEpisodes != null && watchedCount >= show.totalEpisodes;
  const accent = stateColor(showComplete, show.status);
  const remaining = show.totalEpisodes != null ? show.totalEpisodes - watchedCount : 0;
  const label = stateLabel(showComplete, remaining, show.status);
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
    <main className="mx-auto w-full max-w-2xl pb-[calc(var(--dock-h)+2rem)]">
      {/* O backdrop É a identidade — sem cartaz sobreposto. O título vive no
          terço de baixo, por cima do gradiente, tal como no herói do "A
          seguir": a arte respira em cima, o texto lê-se em baixo. */}
      <div className="relative -mx-4 h-[420px] overflow-hidden bg-panel sm:mx-0">
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
        {/* barra de estado — a mesma cor da barra de progresso, não a SMPTE:
            aqui diz "como está esta série", não "isto é o Episodic" */}
        <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: accent }} />

        <BotaoVoltar
          label="Voltar às séries"
          fallback="/series"
          className="absolute left-4 top-4 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-tube/60 text-ink backdrop-blur transition active:scale-90"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </BotaoVoltar>

        <div className="absolute inset-x-4 bottom-5">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="h-[14px] w-[3px] shrink-0 rounded-full"
              style={{ background: accent }}
            />
            <p className="ep-code text-[13px] text-dim">{label}</p>
          </div>
          <h1 className="mt-1.5 font-display text-[36px] font-bold leading-[1] text-ink [font-stretch:110%]">
            {show.name}
          </h1>
          {metaLine && <p className="ep-code mt-2 text-sm text-dim">{metaLine}</p>}
        </div>
      </div>

      <div className="px-4">
        {/* Duas ações, sempre as mesmas duas perguntas: juntar a uma lista,
            ver onde passa. Lado a lado, mesmo peso — nenhuma é secundária
            da outra. */}
        <div className="mt-4 flex gap-2.5">
          <AddToListButton
            kind="show"
            refId={uuid}
            label="Lista"
            wrapperClassName="relative flex-1"
            className="flex h-12 w-full cursor-pointer items-center justify-center rounded-full border border-line bg-raised/60 text-[15px] font-medium text-ink backdrop-blur transition active:scale-95"
          />
          <StreamingBadges kind="tv" tmdbId={show.tmdbId} variant="action" />
        </div>

        {/* só faz sentido para quem não está a seguir ativamente — uma série
            já em acompanhamento não precisa de "para ver" a redundar */}
        {!show.followed && (
          <button
            onClick={() => void toggleWatchlist()}
            className={`mt-2.5 flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-full border px-4 text-[15px] font-medium transition active:scale-95 ${
              show.inWatchlist
                ? "border-ink bg-ink text-tube"
                : "border-line text-dim hover:border-ink hover:text-ink"
            }`}
          >
            {show.inWatchlist && <CheckIcon className="h-3.5 w-3.5" />}
            {show.inWatchlist ? "Na lista para ver" : "Para ver"}
          </button>
        )}

        {/* Ação principal — a decisão nº 1 na página de série. Sem episódio
            por marcar não há ação nenhuma a propor: o cabeçalho já disse "Em
            dia" a par do título, repetir num cartão por baixo era a mesma
            frase duas vezes na mesma página. */}
        {nextUp === undefined ? (
          <Bone className="mt-4 h-14 w-full rounded-2xl" />
        ) : nextUp ? (
          <button
            onClick={() => void markNext()}
            data-testid="mark-next"
            className="mt-4 flex w-full cursor-pointer items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-left text-tube transition hover:brightness-110 active:scale-[0.99]"
          >
            <CheckIcon className={`h-6 w-6 shrink-0 ${pulseNext ? "check-pop" : ""}`} />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">Marcar próximo episódio</span>
              <span className="ep-code block truncate text-xs opacity-80">
                {formatEpCode(nextUp.season, nextUp.episode)} · {nextUp.name}
              </span>
            </span>
          </button>
        ) : null}

        {/* Separadores */}
        <div className="mt-6 flex gap-1 border-b border-line" role="tablist">
          {(
            [
              ["episodios", "Episódios"],
              ["sobre", "Sobre"],
              ["estatisticas", "Estatísticas"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              data-testid={`tab-${id}`}
              className={`-mb-px flex min-h-11 cursor-pointer items-center border-b-2 px-3 text-[15px] transition-colors ${
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
          <section className="mt-4">
            {providerMissing && (
              <p className="mb-3 rounded-lg border border-line bg-raised p-3 text-xs text-dim">
                Não foi possível obter a lista completa de episódios (série não mapeada
                ou sem ligação) — mostramos só as temporadas com episódios vistos.
              </p>
            )}

            {seasons.length === 0 ? (
              <p className="text-[15px] text-dim">Sem informação de temporadas.</p>
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
                      ? "-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
                      : "flex gap-2"
                  }
                >
                  {seasons.map((season) => {
                    const seen = seasonWatchedCount.get(season.number) ?? 0;
                    const complete = season.episodeCount > 0 && seen >= season.episodeCount;
                    const cor = stateColor(complete, show.status);
                    const selected = openSeason === season.number;
                    return (
                      <button
                        key={season.number}
                        onClick={() => void toggleSeason(season)}
                        data-testid={`season-${season.number}`}
                        aria-pressed={selected}
                        className={`relative h-[72px] shrink-0 cursor-pointer overflow-hidden rounded-xl border transition-colors ${
                          seasons.length > 5 ? "w-16" : "flex-1"
                        } ${
                          selected
                            ? "border-ink/40 bg-raised"
                            : "border-line bg-panel hover:border-ink/25"
                        } ${sweepSeason === season.number ? "season-sweep" : ""}`}
                      >
                        <span
                          aria-hidden
                          className="absolute inset-x-0 top-0 h-[3px]"
                          style={{ background: cor }}
                        />
                        <span className="flex h-full flex-col items-center justify-center gap-0.5">
                          <span className="ep-code text-[15px] font-semibold text-ink">
                            {season.number}
                          </span>
                          <span className="ep-code text-[11px] text-faint">
                            {seen}/{season.episodeCount}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {(() => {
                  const season = seasons.find((s) => s.number === openSeason);
                  if (!season) return null;
                  const seen = seasonWatchedCount.get(season.number) ?? 0;
                  const complete = season.episodeCount > 0 && seen >= season.episodeCount;
                  const episodes = episodesBySeason.get(season.number);
                  return (
                    <div className="mt-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-display text-[15px] font-semibold">
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
                      <div className="mt-2 flex flex-col">
                        {Array.from({ length: season.episodeCount }, (_, i) => i + 1).map(
                          (epNumber) => {
                            const metaEp = episodes?.find((e) => e.episode === epNumber);
                            const key = episodeKey(uuid, season.number, epNumber);
                            const isSeen = watched.has(key);
                            const isPulsing = pulseEp === key;
                            return (
                              <button
                                key={epNumber}
                                onClick={() => void toggleEpisode(season.number, epNumber)}
                                className="flex h-[52px] w-full cursor-pointer items-center gap-3 rounded-lg px-2 text-left transition-colors hover:bg-raised"
                                data-testid={`ep-${season.number}-${epNumber}`}
                              >
                                <span className="ep-code w-[34px] shrink-0 text-[13px] text-faint">
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
                                  <span className="block truncate text-base">
                                    {metaEp?.name ?? `Episódio ${epNumber}`}
                                  </span>
                                  {metaEp?.airDate && (
                                    <span className="ep-code block text-xs text-faint">
                                      {metaEp.airDate}
                                    </span>
                                  )}
                                </span>
                              </button>
                            );
                          },
                        )}
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </section>
        )}

        {tab === "sobre" && (
          <section className="mt-4 space-y-4">
            {show.overview ? (
              <p className="text-base leading-relaxed text-dim">{show.overview}</p>
            ) : (
              <p className="text-[15px] text-dim">Sem sinopse disponível.</p>
            )}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[15px]">
              {show.firstAired && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-faint">Estreia</dt>
                  <dd className="ep-code mt-0.5">{show.firstAired}</dd>
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
                        {g}
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
                className="inline-flex min-h-11 cursor-pointer items-center text-[15px] text-ink hover:underline"
              >
                Ver no IMDb ↗
              </a>
            )}
          </section>
        )}

        {tab === "estatisticas" && (
          <section className="mt-4">
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
                <p className="text-[15px] text-dim">episódios vistos</p>
                {activity && (
                  <p className="ep-code mt-1 text-xs text-faint">
                    {activity.first === activity.last
                      ? activity.first
                      : `${activity.first} → ${activity.last}`}
                  </p>
                )}
              </div>
            </div>

            <h3 className="mt-6 font-display text-[15px] font-semibold text-dim">
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
