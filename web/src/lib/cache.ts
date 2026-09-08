"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getLists, getMovies, type CustomList, type StoredMovie } from "./db";
import { loadShows, type ShowWithProgress } from "./shows";

/**
 * Cache viva da biblioteca, partilhada por todas as páginas.
 *
 * Não é (só) por velocidade — é o que faz o **restauro de scroll**
 * funcionar, e isso mediu-se:
 *
 * O browser repõe a posição do scroll no instante do recuo. Se nesse
 * instante a página ainda é um esqueleto mais curto do que a posição
 * guardada, a posição fica presa ao fim do documento. Numa lista de 24
 * itens, sair a 700px e voltar dava 0px — e com um esqueleto artificial
 * mais alto passava a dar 700px, o que confirmou a causa.
 *
 * Aqui dizia-se que a Biblioteca escapava por acaso, porque os dados dela
 * chegavam a tempo. Não escapava: o primeiro teste de scroll escrito na
 * Fase AE mediu 259px depois de sair a 2000px, e com o esqueleto inchado a
 * 90 cartazes passou a 3323px — o mesmo corte, no ecrã de onde mais se
 * abre uma série. Passou a ler daqui também.
 *
 * Com a cache, voltar encontra o conteúdo já lá: o documento tem a altura
 * toda desde o primeiro instante e a posição aguenta. Encher esqueletos
 * até "dar a altura certa" resolveria o mesmo sintoma a fingir, e partia-se
 * outra vez à primeira lista com um número de itens diferente.
 *
 * **Stale-while-revalidate:** devolve o que tem e vai buscar de novo por
 * baixo. Quem marcou um episódio noutro ecrã vê a mudança quando essa
 * revalidação chegar, sem ser preciso avisar a cache a partir de cada
 * sítio que escreve — só as escritas da própria página é que chamam
 * `revalidar()`, para o ecrã não ficar um instante a mostrar o que já
 * mudou debaixo dele.
 */

interface Recurso<T> {
  ler: () => T | null;
  subscrever: (avisar: () => void) => () => void;
  revalidar: () => Promise<void>;
}

function criarRecurso<T>(carregar: () => Promise<T>): Recurso<T> {
  let dados: T | null = null;
  let aCorrer: Promise<void> | null = null;
  const ouvintes = new Set<() => void>();

  const revalidar = (): Promise<void> => {
    // Uma leitura de cada vez: quatro páginas a montar ao mesmo tempo não
    // podem virar quatro varreduras do IndexedDB.
    aCorrer ??= carregar()
      .then((novos) => {
        dados = novos;
        for (const avisar of ouvintes) avisar();
      })
      .catch(() => {
        // IndexedDB em baixo — fica o que já lá estava, em vez de esvaziar
        // o ecrã por causa de uma leitura falhada
      })
      .finally(() => {
        aCorrer = null;
      });
    return aCorrer;
  };

  return {
    ler: () => dados,
    subscrever: (avisar) => {
      ouvintes.add(avisar);
      return () => {
        ouvintes.delete(avisar);
      };
    },
    revalidar,
  };
}

function useRecurso<T>(recurso: Recurso<T>): T | null {
  const valor = useSyncExternalStore(
    recurso.subscrever,
    recurso.ler,
    // no servidor não há IndexedDB; o primeiro render do cliente é que traz
    () => null,
  );
  useEffect(() => {
    void recurso.revalidar();
  }, [recurso]);
  return valor;
}

export const recursoSeries = criarRecurso<ShowWithProgress[]>(loadShows);
export const recursoFilmes = criarRecurso<StoredMovie[]>(getMovies);
export const recursoListas = criarRecurso<CustomList[]>(getLists);

/** `null` enquanto a primeira leitura não chega. */
export const useSeries = () => useRecurso(recursoSeries);
export const useFilmes = () => useRecurso(recursoFilmes);
export const useListas = () => useRecurso(recursoListas);
