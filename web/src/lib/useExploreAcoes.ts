"use client";

import { useCallback } from "react";
import { deleteShow, putMovie, putShow, updateShow } from "@/lib/db";
import { dismiss, undismiss } from "@/lib/dismissed";
import { filmeExistente, juntarNomes, serieExistente } from "@/lib/existente";
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
 * por isso nunca era encontrada. As formas de procurar (chave, id, e qualquer
 * um dos títulos) são todas necessárias, cada uma por um motivo diferente que
 * já aconteceu — e vivem em `existente.ts`, partilhadas com a pesquisa da
 * Biblioteca. Estavam escritas só aqui, e a pesquisa repetiu o mesmo bug
 * dois meses depois (Ronda 12).
 */
export function useExploreAcoes() {
  const guardar = useCallback(async (item: DiscoverItem) => {
    const nomes = [item.name, item.originalName];

    if (item.kind === "movie") {
      const existente = await filmeExistente({
        tmdbId: item.tmdbId,
        nomes,
        ano: item.year ? Number(item.year) : null,
      });
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
        aliases: juntarNomes(nomes),
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

    const existente = await serieExistente({ tmdbId: item.tmdbId, nomes });

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
      tmdbAliases: juntarNomes(nomes),
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

  /**
   * Seguir a partir da pesquisa: a série entra na fila. Os cartões do
   * Explorar só sabiam guardar "para ver" — e uma série "para ver" não entra
   * na fila, por isso quem começava do zero (os amigos) ficava com a casa a
   * dizer "Estás em dia" sem ter visto nada (Ronda 12, Fase 4).
   */
  const seguir = useCallback(async (item: DiscoverItem) => {
    const nomes = [item.name, item.originalName];
    const existente = await serieExistente({ tmdbId: item.tmdbId, nomes });

    if (existente) {
      if (existente.followed && !existente.archived) return;
      const antes = {
        followed: existente.followed,
        inWatchlist: existente.inWatchlist,
        archived: existente.archived,
      };
      await updateShow(existente.uuid, { followed: true, inWatchlist: false, archived: false });
      pushUndo({
        label: "Série seguida",
        detail: item.name,
        undo: async () => {
          await updateShow(existente.uuid, antes);
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
      tmdbAliases: juntarNomes(nomes),
      posterPath: item.posterPath,
      backdropPath: item.backdropPath,
      overview: item.overview,
      totalEpisodes: null,
      followed: true,
      inWatchlist: false,
      archived: false,
      addedAt: new Date().toISOString(),
    });
    pushUndo({
      label: "Série seguida",
      detail: item.name,
      // acabada de criar e sem nada marcado: anular é como se nunca tivesse entrado
      undo: async () => {
        await deleteShow(uuid);
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

  return { guardar, seguir, naoInteressa };
}
