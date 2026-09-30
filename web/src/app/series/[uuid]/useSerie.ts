"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { curta } from "@/lib/datas";
import type { SeasonView } from "./serie";

/**
 * O estado e as ações do detalhe de uma série: o registo, os vistos, as
 * temporadas, o próximo episódio e as marcações (cada uma com a sua anulação).
 * O ecrã só desenha o que isto devolve.
 */
export function useSerie(uuid: string) {
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
  /** as temporadas já chegaram (do fornecedor ou do histórico) — antes disso
   *  «sem buracos» não quer dizer nada, só que ainda não se sabe */
  const [temporadasCarregadas, setTemporadasCarregadas] = useState(false);
  const [nextUp, setNextUp] = useState<MetaEpisode | null | undefined>(undefined);
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

  /**
   * Centra a pastilha aberta **só na faixa**, rolando a faixa e nunca a
   * página: a temporada em curso abre sozinha ao chegar (B·E5), e um
   * `scrollIntoView` puxava a página para baixo num ecrã pequeno, onde a
   * faixa ainda está fora de vista. A primeira vez é instantânea — abre-se
   * já centrada, não se vê a faixa a correr.
   */
  const jaCentrou = useRef(false);
  useEffect(() => {
    const chip = chipAberto.current;
    const faixa = chip?.parentElement;
    if (openSeason === null || !chip || !faixa || faixa.scrollWidth <= faixa.clientWidth) return;
    faixa.scrollTo({
      left: chip.offsetLeft - (faixa.clientWidth - chip.offsetWidth) / 2,
      behavior: jaCentrou.current ? "smooth" : "auto",
    });
    jaCentrou.current = true;
  }, [openSeason, seasons.length]);

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
        setTemporadasCarregadas(true);
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
      setTemporadasCarregadas(true);
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

  /**
   * Escolher uma temporada, como num controlo segmentado: tocar na que já
   * está aberta não a fecha (Mira, B·2a). Havia sempre uma lista por baixo a
   * aparecer e a desaparecer, e a página a saltar com ela.
   */
  const escolherTemporada = useCallback(
    async (season: SeasonView) => {
      setOpenSeason((cur) => {
        if (cur !== season.number) setCorridasAbertas(new Set());
        return season.number;
      });
      await loadSeasonEpisodes(season);
    },
    [loadSeasonEpisodes],
  );

  /**
   * Ao chegar, abre a temporada em curso (a do próximo episódio; numa série
   * em dia, a última). Era preciso um toque para ver um único episódio, e
   * «qual é o próximo?» é a pergunta deste ecrã.
   */
  if (openSeason === null && nextUp !== undefined && seasons.length > 0) {
    setOpenSeason(nextUp?.season ?? seasons[seasons.length - 1].number);
  }

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

  // Os nomes dos episódios da temporada aberta — também a que abriu sozinha.
  useEffect(() => {
    if (!openSeasonView) return;
    const raf = requestAnimationFrame(() => void loadSeasonEpisodes(openSeasonView));
    return () => cancelAnimationFrame(raf);
  }, [openSeasonView, loadSeasonEpisodes]);

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

  /**
   * Deixar de seguir e arquivar, do «···». Os dois tiram a série da fila do
   * «A seguir» sem apagar nada, e desfazem-se como qualquer outro gesto.
   */
  const alternar = useCallback(
    async (campo: "followed" | "archived") => {
      if (!show) return;
      const valor = !show[campo];
      const updated = await updateShow(uuid, { [campo]: valor });
      if (updated) setShow(updated);
      pushUndo({
        label:
          campo === "followed"
            ? valor
              ? "A seguir outra vez"
              : "Deixaste de seguir"
            : valor
              ? "Arquivada"
              : "Tirada do arquivo",
        detail: show.name,
        undo: async () => {
          const reverted = await updateShow(uuid, { [campo]: !valor });
          if (reverted) setShow(reverted);
        },
      });
    },
    [show, uuid],
  );

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

  return {
    show,
    watched,
    seasons,
    openSeason,
    episodesBySeason,
    corridasAbertas,
    providerMissing,
    temporadasCarregadas,
    loadSeasonEpisodes,
    nextUp,
    pulseEp,
    sweepSeason,
    pulseNext,
    chipAberto,
    escolherTemporada,
    toggleCorrida,
    toggleEpisode,
    buracos,
    openSeasonView,
    blocosEpisodios,
    marcarBuracos,
    markSeasonAll,
    markNext,
    alternar,
    watchedCount,
    backdropPath,
    percent,
    seasonWatchedCount,
    temporadasComBuraco,
    activity,
  };
}

export type Serie = ReturnType<typeof useSerie>;
