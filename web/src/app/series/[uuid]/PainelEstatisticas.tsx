import ProgressRing from "@/components/ProgressRing";
import type { StoredShow } from "@/lib/db";
import type { Serie } from "./useSerie";

/** Quanto já se viu desta série, no total e por temporada. */
export default function PainelEstatisticas({
  show,
  serie,
  accent,
}: {
  show: StoredShow;
  serie: Serie;
  accent: string;
}) {
  const { percent, watchedCount, activity, seasons, seasonWatchedCount } = serie;
  return (
    <>
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
    </>
  );
}
