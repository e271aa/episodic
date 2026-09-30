"use client";

import { useCallback, useSyncExternalStore } from "react";

const PREFIXO = "flicki:pref:";

/**
 * Preferências de apresentação — o modo de vista do Explorar, a densidade da
 * Biblioteca. São escolhas sobre *como* olhar, não sobre *o que* está a ser
 * mostrado: por isso não vão para o URL como os filtros e a ordem, que se
 * partilham e sobrevivem ao gesto de recuar.
 *
 * `localStorage` e não o `kv` do IndexedDB porque a leitura tem de ser
 * síncrona: com o `kv` a vista certa só chegava um tique depois da errada, e
 * via-se a mudar.
 */
const ouvintes = new Set<() => void>();

function subscrever(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  // o evento `storage` só dispara nas OUTRAS abas — nesta, notificamos à mão
  window.addEventListener("storage", ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
    window.removeEventListener("storage", ouvinte);
  };
}

export function usePref<T extends string>(
  chave: string,
  omissao: T,
  validos: readonly T[],
): [T, (valor: T) => void] {
  const ler = useCallback((): T => {
    const guardado = localStorage.getItem(PREFIXO + chave) as T | null;
    // Um valor guardado por uma versão antiga da app pode já não existir —
    // sem esta guarda, a vista ficava presa num modo que ninguém sabe render.
    return guardado !== null && validos.includes(guardado) ? guardado : omissao;
  }, [chave, omissao, validos]);

  const valor = useSyncExternalStore(subscrever, ler, () => omissao);

  const definir = useCallback(
    (novo: T) => {
      localStorage.setItem(PREFIXO + chave, novo);
      for (const ouvinte of ouvintes) ouvinte();
    },
    [chave],
  );

  return [valor, definir];
}
