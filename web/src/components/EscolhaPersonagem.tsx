"use client";

import { useEffect, useMemo, useState } from "react";
import { getAllWatched, updateShow, type StoredShow, type WatchedEpisode } from "@/lib/db";
import { findShowByTvdbId, getSeriesCast, type CastMember } from "@/lib/tmdb";
import { hasTmdb } from "@/lib/metadata";
import { seriesParaPersonagem } from "@/lib/personagem";
import Poster from "@/components/Poster";
import { CheckIcon, UserIcon } from "@/components/icons";
import { Bone } from "@/components/Skeleton";

export interface PersonagemEscolhida {
  character: string;
  actorName: string | null;
  profilePath: string | null;
}

/**
 * A personagem favorita, **independente da série favorita**: escolhe-se uma
 * série que já se viu (ou se está a ver) e, do elenco dela, a personagem. A
 * série da personagem não se guarda — o perfil guarda a personagem, o ator e a
 * foto —, por isso ao reabrir mostra-se a escolha atual em cima e o elenco
 * parte da série favorita.
 */
export default function EscolhaPersonagem({
  shows,
  favoritaUuid,
  atual,
  onEscolher,
}: {
  shows: StoredShow[];
  favoritaUuid: string;
  atual: PersonagemEscolhida | null;
  onEscolher: (p: PersonagemEscolhida | null) => void;
}) {
  const [vistos, setVistos] = useState<WatchedEpisode[] | null>(null);
  const [escolhaSerie, setEscolhaSerie] = useState<string | null>(null);
  // a que série pertence o elenco: trocar de série mostra o esqueleto sem
  // repor o estado dentro do efeito
  const [elencoDe, setElencoDe] = useState<{ uuid: string; cast: CastMember[] } | null>(null);

  useEffect(() => {
    void getAllWatched().then(setVistos);
  }, []);

  const elegiveis = useMemo(() => (vistos ? seriesParaPersonagem(shows, vistos) : []), [shows, vistos]);
  // por omissão, a série favorita — se for uma das que já se viu
  const serieUuid = escolhaSerie ?? (elegiveis.some((s) => s.uuid === favoritaUuid) ? favoritaUuid : "");
  const serie = elegiveis.find((s) => s.uuid === serieUuid);

  useEffect(() => {
    if (!serie) return;
    let vivo = true;
    void (async () => {
      // A maioria das séries só tem tvmazeId (a TVmaze não tem elenco) — antes
      // de desistir, tenta encontrar o id TMDB pelo tvdbId e guarda-o na série.
      let tmdbId = serie.tmdbId;
      if (!tmdbId && serie.tvdbId && (await hasTmdb())) {
        const hit = await findShowByTvdbId(serie.tvdbId).catch(() => null);
        if (!vivo) return;
        if (hit) {
          tmdbId = hit.id;
          await updateShow(serie.uuid, { tmdbId: hit.id });
        }
      }
      if (!vivo) return;
      if (!tmdbId) {
        setElencoDe({ uuid: serie.uuid, cast: [] });
        return;
      }
      try {
        const cast = await getSeriesCast(tmdbId);
        if (vivo) setElencoDe({ uuid: serie.uuid, cast: cast.slice(0, 24) });
      } catch {
        if (vivo) setElencoDe({ uuid: serie.uuid, cast: [] });
      }
    })();
    return () => {
      vivo = false;
    };
  }, [serie]);

  /** null enquanto o elenco desta série não chegou */
  const elenco = serie && elencoDe && elencoDe.uuid === serie.uuid ? elencoDe.cast : null;

  return (
    <div>
      <p className="text-xs font-medium text-dim">Personagem favorita</p>

      {atual && (
        <div className="mt-1.5 flex items-center gap-3 rounded-2xl bg-fill p-2.5" data-testid="personagem-atual">
          <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-elevated">
            {atual.profilePath ? (
              <Poster path={atual.profilePath} alt="" size="w185" fill sizes="48px" className="object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-faint">
                <UserIcon className="h-5 w-5" />
              </span>
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.9375rem] font-semibold text-label">{atual.character}</span>
            {atual.actorName && <span className="block truncate text-xs text-label-2">{atual.actorName}</span>}
          </span>
          <button
            type="button"
            onClick={() => onEscolher(null)}
            className="min-h-11 shrink-0 cursor-pointer px-2 text-[0.88rem] font-semibold text-label-2 active:opacity-60"
          >
            Remover
          </button>
        </div>
      )}

      {vistos !== null && elegiveis.length === 0 ? (
        <p className="mt-1.5 text-[0.9375rem] text-dim">
          A personagem sai de uma série que já tenhas visto — marca um episódio e volta aqui.
        </p>
      ) : (
        <>
          <label className="mt-3 flex flex-col gap-1.5">
            <span className="text-xs font-medium text-dim">Elenco de</span>
            <select
              value={serieUuid}
              onChange={(e) => setEscolhaSerie(e.target.value)}
              className="min-h-12 cursor-pointer rounded-2xl border border-line bg-panel px-4 outline-none transition-colors focus:border-ink"
            >
              <option value="">Escolhe uma série que já viste</option>
              {elegiveis.map((s) => (
                <option key={s.uuid} value={s.uuid}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          {serie &&
            (elenco === null ? (
              <div className="mt-2 flex gap-2 overflow-hidden">
                {[0, 1, 2, 3].map((i) => (
                  <Bone key={i} className="h-24 w-16 shrink-0 rounded-xl" />
                ))}
              </div>
            ) : elenco.length === 0 ? (
              <p className="mt-1.5 text-[0.9375rem] text-dim">Não foi possível carregar o elenco desta série.</p>
            ) : (
              <div className="-mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-2">
                {elenco.map((c) => {
                  const ativo = atual?.character === c.character && atual.actorName === c.actorName;
                  return (
                    <button
                      key={`${c.personId}-${c.character}`}
                      type="button"
                      aria-pressed={ativo}
                      onClick={() =>
                        onEscolher(
                          ativo ? null : { character: c.character, actorName: c.actorName, profilePath: c.profilePath },
                        )
                      }
                      className={`w-16 shrink-0 cursor-pointer text-left transition active:scale-95 ${
                        ativo ? "" : "opacity-70 hover:opacity-100"
                      }`}
                    >
                      <div
                        className={`relative h-24 w-16 overflow-hidden rounded-xl bg-raised ${ativo ? "ring-2 ring-ink" : ""}`}
                      >
                        {c.profilePath ? (
                          <Poster path={c.profilePath} alt={c.character} size="w185" fill sizes="64px" className="object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-faint">
                            <UserIcon className="h-5 w-5" />
                          </span>
                        )}
                        {ativo && (
                          <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-tube">
                            <CheckIcon className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-xs font-medium">{c.character}</p>
                      <p className="truncate text-xs text-faint">{c.actorName}</p>
                    </button>
                  );
                })}
              </div>
            ))}
        </>
      )}
    </div>
  );
}
