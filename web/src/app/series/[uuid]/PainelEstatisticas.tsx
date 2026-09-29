import type { StoredShow } from "@/lib/db";
import Codigo from "@/components/mira/Codigo";
import type { Serie } from "./useSerie";

/**
 * Quanto já se viu desta série, no «···»: o número grande em SF Rounded
 * (como os widgets do Perfil) e uma barra por temporada — a cor do estado
 * só quando a temporada está completa (Regra da mira: estado, não enfeite).
 */
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
      <div className="rounded-[26px] bg-group px-[18px] py-4">
        <p className="text-[0.88rem] font-semibold text-label-2">Episódios vistos</p>
        <p className="mt-1 font-rounded text-[2.7rem] leading-none font-bold text-label">
          {watchedCount}
          {show.totalEpisodes ? (
            <span className="text-[1.4rem] text-label-2"> / {show.totalEpisodes}</span>
          ) : null}
        </p>
        {percent !== null && (
          <div aria-hidden className="mt-3 h-1 overflow-hidden rounded-sm bg-track">
            <div className="h-full" style={{ width: `${Math.min(100, percent)}%`, background: accent }} />
          </div>
        )}
        {activity && (
          <Codigo className="mt-2 block text-[0.76rem] text-label-2">
            {activity.mesmoDia ? activity.first : `${activity.first} → ${activity.last}`}
          </Codigo>
        )}
      </div>

      <div className="rounded-[26px] bg-group px-[18px] py-4">
        <h3 className="text-[0.88rem] font-semibold text-label-2">Por temporada</h3>
        <div className="mt-3 flex flex-col gap-2.5">
          {seasons.map((season) => {
            const seen = seasonWatchedCount.get(season.number) ?? 0;
            const pct = season.episodeCount > 0 ? (seen / season.episodeCount) * 100 : 0;
            return (
              <div key={season.number}>
                <div className="flex justify-between text-[0.76rem]">
                  <span className="text-label">{season.name}</span>
                  <Codigo className="text-label-2">
                    {season.episodeCount === 0 ? "breve" : `${seen}/${season.episodeCount}`}
                  </Codigo>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-sm bg-track">
                  <div
                    className="h-full rounded-sm transition-[width] duration-[240ms] ease-out"
                    style={{
                      width: `${Math.min(100, pct)}%`,
                      background: pct >= 100 ? accent : "var(--color-label)",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
