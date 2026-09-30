// Estatísticas avançadas — padrões no tempo que o Perfil não mostra:
// maratonas, dia da semana preferido, sequência de dias seguidos.
import {
  getAllWatched,
  getImportMeta,
  getShows,
  type ImportMeta,
  type StoredShow,
  type WatchedEpisode,
} from "./db";
import {
  horasPorAno,
  porMesAno,
  segundosPorEpisodio,
  seriesMaisVistas,
  type HorasDeUmAno,
  type MapaAnoMes,
  type SerieVista,
} from "./graficos";

export interface BingeDay {
  date: string; // YYYY-MM-DD
  count: number;
  topShow: { name: string; count: number } | null;
}

export interface WeekdayBar {
  weekday: number; // 0 = domingo … 6 = sábado
  label: string;
  count: number;
}

export interface AdvancedStats {
  bestBinge: BingeDay | null;
  longestStreak: { days: number; from: string; to: string } | null;
  currentStreak: number;
  perWeekday: WeekdayBar[];
  busiestMonth: { month: string; count: number } | null;
  distinctShowsWatchedInADay: { date: string; count: number } | null;
  /** episódios por mês, em cada ano (só data certa) */
  mapa: MapaAnoMes;
  /** as séries com mais episódios vistos */
  maisVistas: SerieVista[];
  /** horas por ano — estimadas, só data certa */
  horasAno: HorasDeUmAno[];
  /** dias em que se marcou alguma coisa (só data certa) */
  diasAtivos: number;
  /** episódios com data certa — a base das médias */
  episodiosComData: number;
}

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

export async function loadAdvancedStats(): Promise<AdvancedStats> {
  const [watched, shows, meta] = await Promise.all([getAllWatched(), getShows(), getImportMeta()]);
  return computeAdvancedStats(watched, shows, meta);
}

export function computeAdvancedStats(
  watched: WatchedEpisode[],
  shows: StoredShow[],
  meta: ImportMeta | null = null,
): AdvancedStats {
  // o total e as séries mais vistas contam TODOS os episódios; só o que é
  // sobre quando se viu (abaixo) fica com os de data certa
  const todos = watched;
  const showName = new Map(shows.map((s) => [s.uuid, s.name]));

  // Tudo aqui é sobre QUANDO — e um episódio sem data certa não sabe quando.
  // Os do TV Time marcados em massa ficavam com o dia da marcação: o 14 de
  // junho de 2015 tinha 98 episódios, o 28 de junho de 2024 tinha 87 —
  // maratonas que nunca aconteceram. Continuam nos totais; aqui não entram.
  watched = watched.filter((ep) => ep.dateIsExact !== false);

  // agrupa por dia
  const byDay = new Map<string, WatchedEpisode[]>();
  for (const ep of watched) {
    const day = dateOnly(ep.watchedAt);
    const list = byDay.get(day);
    if (list) list.push(ep);
    else byDay.set(day, [ep]);
  }

  // maratona: o dia com mais episódios vistos (de qualquer série). Sem
  // limiar, um único episódio marcado num dia sozinho já era "a melhor
  // maratona" — um recorde que humilha em vez de festejar (5b.4). Uma
  // maratona é mais do que um episódio, por definição.
  const LIMIAR_MARATONA = 2;
  let bestBinge: BingeDay | null = null;
  for (const [date, eps] of byDay) {
    if (eps.length < LIMIAR_MARATONA) continue;
    const perShow = new Map<string, number>();
    for (const ep of eps) perShow.set(ep.showUuid, (perShow.get(ep.showUuid) ?? 0) + 1);
    let top: { uuid: string; count: number } | null = null;
    for (const [uuid, count] of perShow) {
      if (!top || count > top.count) top = { uuid, count };
    }
    if (!bestBinge || eps.length > bestBinge.count) {
      bestBinge = {
        date,
        count: eps.length,
        topShow: top ? { name: showName.get(top.uuid) ?? "?", count: top.count } : null,
      };
    }
  }

  // sequência de dias seguidos com pelo menos 1 episódio visto
  const days = [...byDay.keys()].sort();
  let longestStreak: AdvancedStats["longestStreak"] = null;
  let streakStart = days[0];
  let streakLen = days.length > 0 ? 1 : 0;
  for (let i = 1; i < days.length; i++) {
    const prev = Date.parse(days[i - 1]);
    const cur = Date.parse(days[i]);
    const gapDays = Math.round((cur - prev) / (24 * 60 * 60 * 1000));
    if (gapDays === 1) {
      streakLen++;
    } else {
      if (!longestStreak || streakLen > longestStreak.days) {
        longestStreak = { days: streakLen, from: streakStart, to: days[i - 1] };
      }
      streakStart = days[i];
      streakLen = 1;
    }
  }
  if (days.length > 0 && (!longestStreak || streakLen > longestStreak.days)) {
    longestStreak = { days: streakLen, from: streakStart, to: days[days.length - 1] };
  }

  // sequência atual: só conta se o último dia visto foi hoje ou ontem
  let currentStreak = 0;
  if (days.length > 0) {
    const today = dateOnly(new Date().toISOString());
    const lastDay = days[days.length - 1];
    const gapFromToday = Math.round(
      (Date.parse(today) - Date.parse(lastDay)) / (24 * 60 * 60 * 1000),
    );
    if (gapFromToday <= 1) {
      currentStreak = 1;
      for (let i = days.length - 1; i > 0; i--) {
        const gap = Math.round(
          (Date.parse(days[i]) - Date.parse(days[i - 1])) / (24 * 60 * 60 * 1000),
        );
        if (gap === 1) currentStreak++;
        else break;
      }
    }
  }

  // dia da semana preferido
  const weekdayCount = new Array(7).fill(0);
  for (const ep of watched) {
    const d = new Date(ep.watchedAt).getUTCDay();
    weekdayCount[d]++;
  }
  const perWeekday: WeekdayBar[] = weekdayCount.map((count, weekday) => ({
    weekday,
    label: WEEKDAY_LABELS[weekday],
    count,
  }));

  // mês mais ativo (de sempre)
  const monthCount = new Map<string, number>();
  for (const ep of watched) {
    const month = ep.watchedAt.slice(0, 7); // YYYY-MM
    monthCount.set(month, (monthCount.get(month) ?? 0) + 1);
  }
  let busiestMonth: AdvancedStats["busiestMonth"] = null;
  for (const [month, count] of monthCount) {
    if (!busiestMonth || count > busiestMonth.count) busiestMonth = { month, count };
  }

  // dia com mais séries diferentes vistas (variedade, não volume)
  let distinctShowsWatchedInADay: AdvancedStats["distinctShowsWatchedInADay"] = null;
  for (const [date, eps] of byDay) {
    const distinct = new Set(eps.map((e) => e.showUuid)).size;
    if (!distinctShowsWatchedInADay || distinct > distinctShowsWatchedInADay.count) {
      distinctShowsWatchedInADay = { date, count: distinct };
    }
  }

  return {
    bestBinge,
    longestStreak,
    currentStreak,
    perWeekday,
    busiestMonth,
    distinctShowsWatchedInADay,
    mapa: porMesAno(watched),
    maisVistas: seriesMaisVistas(todos, shows),
    horasAno: horasPorAno(watched, segundosPorEpisodio(meta, shows, todos)),
    diasAtivos: byDay.size,
    episodiosComData: watched.length,
  };
}
