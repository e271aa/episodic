import type { StoredShow } from "@/lib/db";
import { porExtenso } from "@/lib/datas";
import { translateGenre } from "@/lib/stats";
import { STATUS_PT } from "./serie";

/** A sinopse e a ficha da série. */
export default function PainelSobre({ show }: { show: StoredShow }) {
  return (
    <>
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
    </>
  );
}
