"use client";

import {
  kvGet,
  kvSet,
  updateMovie,
  updateShow,
  type StoredMovie,
  type StoredShow,
} from "./db";
import { enrichMovie, enrichShow } from "./metadata";

/**
 * Completar capas e metadados em falta, em segundo plano.
 *
 * Antes disto o trabalho vivia dentro da página "A seguir", à vista de
 * ninguém, e tinha três problemas que davam no mesmo sintoma — capas que só
 * apareciam depois de se abrir a série uma a uma:
 *
 *  1. só corria no "A seguir". Quem entrasse direto na Biblioteca não
 *     disparava enriquecimento nenhum;
 *  2. era sequencial. Com 136 séries a até 4 pedidos cada, a passagem não
 *     chegava ao fim antes de a PWA ser fechada;
 *  3. tratava tudo por igual. Uma série que já tinha capa mas não tinha o
 *     total de episódios gastava os 4 pedidos à frente de outra que não
 *     tinha capa nenhuma — e como o total continuava a faltar, repetia isso
 *     em todas as visitas, para sempre.
 *
 * O que muda aqui é o **agendamento**: quem é servido primeiro, quantos ao
 * mesmo tempo, e o que já não vale a pena voltar a tentar. As regras de
 * correspondência (que candidato é o certo) ficam onde estavam, no
 * `metadata.ts` — são correções verificadas e não se mexe nelas por causa
 * de velocidade.
 */

/**
 * Quantos pedidos ao mesmo tempo. A TVmaze corta aos 20 pedidos/10s e cada
 * série pode gastar até 4 — é o mesmo número que o `computeNextUp` já usa e
 * cabe folgadamente dentro do limite.
 */
const EM_PARALELO = 4;

/** De quanto em quanto se grava o progresso (em itens). Gravar a cada item
 *  seria uma escrita no IndexedDB por pedido; perder alguns significa só
 *  voltar a tentar alguns, porque o trabalho em si já ficou guardado. */
const GRAVAR_A_CADA = 8;

/** Terminada uma volta completa, só se recomeça no dia seguinte. Sem isto,
 *  o que os fornecedores simplesmente não têm era pedido em cada visita. */
const VOLTA_TTL = 24 * 60 * 60 * 1000;

interface Volta {
  /** ids já tentados nesta volta — inclui os que não deram nada */
  tentados: string[];
  /** quando a última volta se fechou; null enquanto vai a meio */
  fechadaEm: number | null;
}

/**
 * Uma volta de cada vez em toda a app. Navegar "A seguir" → Biblioteca →
 * "A seguir" montava três passagens sobrepostas a disputar o mesmo limite
 * de pedidos. É um módulo, não um `ref`, precisamente para atravessar as
 * páginas.
 */
let aCorrer = false;

async function lerVolta(chave: string): Promise<Volta> {
  return (await kvGet<Volta>(chave)) ?? { tentados: [], fechadaEm: null };
}

/**
 * Percorre `itens` com `EM_PARALELO` trabalhadores a partilhar um cursor —
 * o mesmo desenho do `computeNextUp`. Devolve os ids tentados.
 */
async function percorrer<T>(
  itens: T[],
  idDe: (item: T) => string,
  tratar: (item: T) => Promise<boolean>,
  aoGravar: (tentados: string[]) => Promise<void>,
  aoMudar?: () => void,
): Promise<void> {
  const tentados: string[] = [];
  let cursor = 0;

  await Promise.all(
    Array.from({ length: EM_PARALELO }, async () => {
      for (let i = cursor++; i < itens.length; i = cursor++) {
        const item = itens[i];
        let mudou = false;
        try {
          mudou = await tratar(item);
        } catch {
          // rede em baixo a meio da volta — o item fica por tentar e volta
          // na próxima; não vale a pena derrubar a passagem inteira
        }
        tentados.push(idDe(item));
        // A capa aparece assim que chega, em vez de a grelha inteira mudar
        // no fim. É a diferença entre "está a carregar" e "não carregou".
        if (mudou) aoMudar?.();
        if (tentados.length % GRAVAR_A_CADA === 0) {
          await aoGravar([...tentados]);
        }
      }
    }),
  );

  await aoGravar(tentados);
}

/**
 * Corre as duas passagens de um tipo de item: primeiro quem não tem capa,
 * depois quem tem capa mas ainda lhe falta alguma coisa.
 */
async function correrVolta<T>(
  chave: string,
  semCapa: T[],
  incompletos: T[],
  idDe: (item: T) => string,
  tratar: (item: T) => Promise<boolean>,
  aoMudar?: () => void,
): Promise<void> {
  const volta = await lerVolta(chave);
  if (volta.fechadaEm !== null && Date.now() - volta.fechadaEm < VOLTA_TTL) return;

  const jaTentados = new Set(volta.tentados);
  const naoTentado = (item: T) => !jaTentados.has(idDe(item));

  // A ordem é a mensagem: capas primeiro, sempre. Um item sem capa é um
  // buraco na grelha; um item sem o total de episódios é só uma barra de
  // progresso que ainda não sabe o fim.
  const fila = [...semCapa.filter(naoTentado), ...incompletos.filter(naoTentado)];

  if (fila.length === 0) {
    await kvSet(chave, { tentados: [], fechadaEm: Date.now() } satisfies Volta);
    return;
  }

  await percorrer(
    fila,
    idDe,
    tratar,
    async (tentados) => {
      await kvSet(chave, {
        tentados: [...volta.tentados, ...tentados],
        fechadaEm: null,
      } satisfies Volta);
    },
    aoMudar,
  );
}

const CHAVE_SERIES = "backfill:series-v1";
const CHAVE_FILMES = "backfill:filmes-v1";

/**
 * Completa capas, totais e sinopses das séries. `aoMudar` é chamado sempre
 * que uma série ganha dados novos, para a grelha os mostrar já.
 */
export async function backfillShows(
  lista: StoredShow[],
  aoMudar?: () => void,
): Promise<void> {
  if (aCorrer) return;
  aCorrer = true;
  try {
    await correrVolta(
      CHAVE_SERIES,
      lista.filter((s) => !s.posterPath),
      lista.filter((s) => s.posterPath && !s.totalEpisodes),
      (s) => s.uuid,
      async (show) => {
        const patch = await enrichShow(show);
        if (!patch) return false;
        await updateShow(show.uuid, patch);
        return true;
      },
      aoMudar,
    );
  } finally {
    aCorrer = false;
  }
}

/**
 * O mesmo para filmes. `rever` força uma revisão de tudo — serve quando a
 * regra de escolha do filme na TMDB muda e os que já estavam enriquecidos
 * guardaram o filme errado (foi o caso do "Ciao Alberto", que ficou com o
 * homónimo de 2003 em vez do spin-off do Luca).
 */
export async function backfillMovies(
  lista: StoredMovie[],
  rever: boolean,
  aoMudar?: () => void,
): Promise<void> {
  if (aCorrer) return;
  aCorrer = true;
  try {
    // Filmes vindos do Explorar já trazem o id TMDB certo — pesquisar outra
    // vez pelo nome só arriscaria trocá-los por um homónimo.
    const candidatos = lista.filter((m) => !m.key.startsWith("tmdb-"));
    const tratar = async (movie: StoredMovie) => {
      const patch = await enrichMovie(movie, rever);
      if (!patch) return false;
      await updateMovie(movie.key, patch);
      return true;
    };

    if (rever) {
      // Numa revisão não há "já está bom": todos passam, e a volta anterior
      // não conta porque o que se quer é precisamente refazer o que ela fez.
      await kvSet(CHAVE_FILMES, { tentados: [], fechadaEm: null } satisfies Volta);
      await correrVolta(CHAVE_FILMES, candidatos, [], (m) => m.key, tratar, aoMudar);
      return;
    }

    await correrVolta(
      CHAVE_FILMES,
      candidatos.filter((m) => !m.posterPath),
      candidatos.filter((m) => m.posterPath && !m.releaseDate),
      (m) => m.key,
      tratar,
      aoMudar,
    );
  } finally {
    aCorrer = false;
  }
}
