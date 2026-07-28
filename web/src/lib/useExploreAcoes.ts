"use client";

import { useCallback } from "react";
import { getMovie, getMovies, getShows, putMovie, putShow, updateShow } from "@/lib/db";
import { dismiss, undismiss } from "@/lib/dismissed";
import { normalizeTitle } from "@/lib/names";
import { pushUndo } from "@/lib/undo";
import type { DiscoverItem } from "@/lib/tmdb";

/**
 * As duas ações do Explorar, iguais nos dois modos. Saíram da página para o
 * cabeçalho poder ser redesenhado sem lhes tocar.
 *
 * Nota para quem vier a seguir: o `guardar` parece mais complicado do que
 * precisa de ser, e não é. Procurar só por `getShow("tmdb-<id>")` — que é o
 * óbvio — foi o que pôs o Arrow e o Prison Break duas vezes na biblioteca:
 * a série importada do TV Time tem o uuid do TV Time, nunca `tmdb-<id>`, e
 * por isso nunca era encontrada. As três formas de procurar abaixo (uuid, id
 * TMDB, e qualquer um dos dois títulos) são todas necessárias, cada uma por
 * um motivo diferente que já aconteceu.
 */
export function useExploreAcoes() {
  const guardar = useCallback(async (item: DiscoverItem) => {
    // Os dois títulos: a TMDB responde em pt-PT e a biblioteca guarda o nome
    // como o TV Time o exportou. O "Prison Break" dele é "Prison Break: Fuga
    // da Prisão" na TMDB — só o original bate certo.
    const nomes = new Set([normalizeTitle(item.name)]);
    if (item.originalName) nomes.add(normalizeTitle(item.originalName));

    if (item.kind === "movie") {
      const existente =
        (await getMovie(`tmdb-${item.tmdbId}`)) ??
        (await getMovies()).find(
          (m) => m.tmdbId === item.tmdbId || nomes.has(normalizeTitle(m.name)),
        );
      if (existente) return; // já lá está — nada a fazer, nada a anular
      await putMovie({
        key: `tmdb-${item.tmdbId}`,
        name: item.name,
        watchedAt: null,
        dateIsExact: true,
        releaseDate: item.year ? `${item.year}-01-01` : null,
        addedAt: new Date().toISOString(),
        tmdbId: item.tmdbId,
        posterPath: item.posterPath,
      });
      pushUndo({
        label: "Guardado para ver",
        detail: item.name,
        undo: async () => {
          const { deleteMovie } = await import("@/lib/db");
          await deleteMovie(`tmdb-${item.tmdbId}`);
        },
      });
      return;
    }

    const existente = (await getShows()).find(
      (s) =>
        s.uuid === `tmdb-${item.tmdbId}` ||
        (s.tmdbId != null && s.tmdbId === item.tmdbId) ||
        nomes.has(normalizeTitle(s.name)) ||
        (s.tmdbAliases ?? []).some((a) => nomes.has(normalizeTitle(a))),
    );

    if (existente) {
      // Já a segues ou já está arquivada? Então não é "para ver" — deixa-a
      // como está, em vez de a puxar para uma lista onde não pertence.
      if (existente.followed || existente.archived || existente.inWatchlist) return;
      await updateShow(existente.uuid, { inWatchlist: true });
      pushUndo({
        label: "Guardado para ver",
        detail: item.name,
        undo: async () => {
          await updateShow(existente.uuid, { inWatchlist: false });
        },
      });
      return;
    }

    const uuid = `tmdb-${item.tmdbId}`;
    await putShow({
      uuid,
      name: item.name,
      tvdbId: null,
      tmdbId: item.tmdbId,
      tvmazeId: null,
      posterPath: item.posterPath,
      backdropPath: item.backdropPath,
      overview: item.overview,
      totalEpisodes: null,
      followed: false,
      inWatchlist: true,
      archived: false,
      addedAt: new Date().toISOString(),
    });
    pushUndo({
      label: "Guardado para ver",
      detail: item.name,
      undo: async () => {
        await updateShow(uuid, { inWatchlist: false });
      },
    });
  }, []);

  const naoInteressa = useCallback(async (item: DiscoverItem) => {
    await dismiss(item.kind, item.tmdbId);
    pushUndo({
      label: "Dispensado",
      detail: item.name,
      undo: async () => {
        await undismiss(item.kind, item.tmdbId);
      },
    });
  }, []);

  return { guardar, naoInteressa };
}
