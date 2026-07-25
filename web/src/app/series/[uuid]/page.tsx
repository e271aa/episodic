"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
import { imageUrl } from "@/lib/tmdb";
import { enrichShow, getEpisodesOfSeason, getSeasons, type MetaEpisode } from "@/lib/metadata";
import { findNextUnwatched, formatEpCode } from "@/lib/watchnext";
import { pushUndo } from "@/lib/undo";
import ProgressRing from "@/components/ProgressRing";
import AddToListButton from "@/components/AddToListButton";
import { CheckIcon } from "@/components/icons";

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
  const [pulseNext, setPulseNext] = useState(false);
  const pulseTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(pulseTimeout.current), []);

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

      // Enriquecimento sob demanda: séries importadas antes de guardarmos
      // estreia/estado/géneros não têm esses campos — completa-os agora.
      if (
        stored.status === undefined &&
        stored.firstAired === undefined &&
        stored.genres === undefined
      ) {
        const patch = await enrichShow(stored);
        if (patch) {
          const updated = await updateShow(uuid, patch);
          if (updated) setShow(updated);
        }
      }

      // Temporadas: do fornecedor quando possível; senão do histórico local.
      const providerSeasons = await getSeasons(stored);
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
        if (!stored.totalEpisodes) {
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
    [uuid, watched, show, syncWatched],
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

  const watchedCount = watched.size;
  const backdrop = imageUrl(show?.backdropPath ?? null, "w780");
  const poster = imageUrl(show?.posterPath ?? null, "w342");
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
        <div className="h-44 animate-pulse bg-panel sm:h-56" />
        <div className="space-y-3 px-4 pt-6">
          <div className="h-6 w-48 animate-pulse rounded-lg bg-panel" />
          <div className="h-4 w-32 animate-pulse rounded-lg bg-panel" />
        </div>
      </main>
    );
  }
  if (show === null) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-dim">Série não encontrada.</p>
        <Link href="/series" className="mt-4 inline-block cursor-pointer text-ink underline">
          Voltar às séries
        </Link>
      </main>
    );
  }

  const year = show.firstAired?.slice(0, 4);
  const metaBits = [year, show.genres?.slice(0, 2).join(" · ")].filter(Boolean);
  const showComplete =
    show.totalEpisodes != null && watchedCount >= show.totalEpisodes;
  const accent = stateColor(showComplete, show.status);

  return (
    <main className="mx-auto w-full max-w-2xl pb-8">
      <div className="relative">
        {backdrop ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={backdrop} alt="" className="h-44 w-full object-cover sm:h-56" />
            <div className="absolute inset-0 bg-gradient-to-t from-tube via-tube/40 to-transparent" />
          </>
        ) : (
          <div className="h-28 w-full bg-gradient-to-r from-raised to-panel" />
        )}
        {/* fio de cor — a assinatura, consistente com o "A seguir" e o perfil */}
        <div className="bars absolute inset-x-0 top-0 h-[3px]" />
        <Link
          href="/series"
          className="absolute left-3 top-3 cursor-pointer rounded-full bg-black/50 px-3 py-1.5 text-sm text-white backdrop-blur"
        >
          ← Séries
        </Link>
      </div>

      {/* relative: sem isto, o gradiente absoluto da subcapa pinta por cima do poster */}
      <div className="relative px-4">
        <div className="-mt-10 flex items-end gap-4">
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={poster}
              alt={show.name}
              className="w-24 shrink-0 rounded-xl shadow-lg"
            />
          ) : (
            <div className="flex h-36 w-24 shrink-0 items-center justify-center rounded-xl bg-raised p-2 text-center font-display text-sm font-bold text-dim shadow-lg">
              {show.name}
            </div>
          )}
          <div className="flex flex-1 items-end justify-between gap-3 pb-1">
            <div className="min-w-0">
              <h1 className="font-display text-xl font-bold leading-tight">{show.name}</h1>
              {metaBits.length > 0 && (
                <p className="ep-code mt-1 truncate text-xs text-dim">
                  {metaBits.join("  ·  ")}
                </p>
              )}
              <p className="ep-code mt-1 text-sm text-dim" data-testid="show-progress">
                {watchedCount}
                {show.totalEpisodes ? `/${show.totalEpisodes}` : ""} episódios vistos
              </p>
            </div>
            {percent !== null && <ProgressRing percent={percent} color={accent} />}
          </div>
        </div>

        {/* Ação principal — a decisão nº 1 na página de série */}
        <div className="mt-5">
          {nextUp === undefined ? (
            <div className="h-14 animate-pulse rounded-2xl bg-panel" />
          ) : nextUp ? (
            <button
              onClick={() => void markNext()}
              data-testid="mark-next"
              className="flex w-full cursor-pointer items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-left text-tube transition hover:brightness-110 active:scale-[0.99]"
            >
              <CheckIcon className={`h-6 w-6 shrink-0 ${pulseNext ? "check-pop" : ""}`} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Marcar próximo episódio</span>
                <span className="ep-code block truncate text-xs opacity-80">
                  {formatEpCode(nextUp.season, nextUp.episode)} · {nextUp.name}
                </span>
              </span>
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-dim">
              <CheckIcon className="h-5 w-5" style={{ color: accent }} />
              Estás em dia com esta série
            </div>
          )}
        </div>

        <div className="mt-3">
          <AddToListButton kind="show" refId={uuid} />
        </div>

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
              className={`-mb-px flex min-h-11 cursor-pointer items-center border-b-2 px-3 text-sm transition-colors ${
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
            <div className="flex flex-col gap-2">
              {seasons.length === 0 && (
                <p className="text-sm text-dim">Sem informação de temporadas.</p>
              )}
              {seasons.map((season) => {
                const seen = seasonWatchedCount.get(season.number) ?? 0;
                const complete = season.episodeCount > 0 && seen >= season.episodeCount;
                const episodes = episodesBySeason.get(season.number);
                const open = openSeason === season.number;
                return (
                  <div
                    key={season.number}
                    className="overflow-hidden rounded-xl border border-line bg-panel"
                  >
                    <button
                      onClick={() => void toggleSeason(season)}
                      className="flex min-h-12 w-full cursor-pointer items-center justify-between px-4 py-3 text-left"
                      data-testid={`season-${season.number}`}
                    >
                      <span className="font-medium">{season.name}</span>
                      <span
                        className={`ep-code text-sm ${complete ? "font-semibold text-ink" : "text-dim"}`}
                      >
                        {seen}/{season.episodeCount} {open ? "▴" : "▾"}
                      </span>
                    </button>

                    {open && (
                      <div className="border-t border-line px-2 py-2">
                        {!complete && season.episodeCount > 0 && (
                          <button
                            onClick={() => void markSeasonAll(season)}
                            className="mb-2 ml-2 cursor-pointer text-xs font-semibold text-ink hover:underline"
                          >
                            Marcar temporada como vista
                          </button>
                        )}
                        {Array.from({ length: season.episodeCount }, (_, i) => i + 1).map(
                          (epNumber) => {
                            const metaEp = episodes?.find((e) => e.episode === epNumber);
                            const key = episodeKey(uuid, season.number, epNumber);
                            const isSeen = watched.has(key);
                            const isPulsing = pulseEp === key;
                            return (
                              <button
                                key={epNumber}
                                onClick={() =>
                                  void toggleEpisode(season.number, epNumber)
                                }
                                className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-raised"
                                data-testid={`ep-${season.number}-${epNumber}`}
                              >
                                <span
                                  aria-hidden
                                  className={`relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
                                    isSeen
                                      ? "border-ink bg-ink text-tube"
                                      : "border-line text-transparent"
                                  } ${isPulsing ? "check-pop check-ring" : ""}`}
                                >
                                  ✓
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm">
                                    <span className="ep-code mr-2 text-faint">
                                      {String(epNumber).padStart(2, "0")}
                                    </span>
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
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {tab === "sobre" && (
          <section className="mt-4 space-y-4">
            {show.overview ? (
              <p className="text-sm leading-relaxed text-dim">{show.overview}</p>
            ) : (
              <p className="text-sm text-dim">Sem sinopse disponível.</p>
            )}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
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
                className="inline-block cursor-pointer text-sm text-ink hover:underline"
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
                <p className="text-sm text-dim">episódios vistos</p>
                {activity && (
                  <p className="ep-code mt-1 text-xs text-faint">
                    {activity.first === activity.last
                      ? activity.first
                      : `${activity.first} → ${activity.last}`}
                  </p>
                )}
              </div>
            </div>

            <h3 className="mt-6 font-display text-sm font-semibold text-dim">
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
                        className="h-full rounded-full transition-[width] duration-500"
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
