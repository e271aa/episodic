/**
 * Distinguir "ainda não vi" de "vi e esqueci-me de marcar".
 *
 * A app tratava as duas coisas como uma só: um episódio por marcar era um
 * episódio pendente, ponto final. Mas há um sinal forte nos dados que dá para
 * ler — **um episódio por marcar que tenha outro visto DEPOIS dele quase de
 * certeza foi visto**. Ninguém vê a 5ª temporada antes de acabar a 2ª.
 *
 * Medido na biblioteca do Ruben: 37 episódios assim, em 5 séries — 22 só no
 * Naruto (a temporada 2 sem os episódios 20 a 41, com as temporadas 3, 4 e 5
 * inteiras). Para os encontrar tinha de ler `29/51` numa pastilha, fazer a
 * conta, abrir a temporada e rolar 1757px até dar com eles.
 *
 * **Isto sugere, não decide.** A app nunca pode afirmar que alguém viu o que
 * não disse ter visto: o que sai daqui vira uma proposta com um botão, nunca
 * uma marcação automática.
 */

export interface TemporadaComBuraco {
  /** posição da temporada tal como o ecrã a numera */
  temporada: number;
  /** números de episódio por marcar, por ordem */
  episodios: number[];
}

export interface Buracos {
  /** por temporada, só as que têm buracos */
  porTemporada: TemporadaComBuraco[];
  /** quantos episódios ao todo */
  total: number;
  /**
   * Quantos ficam por ver **depois** do ponto mais avançado — esses são
   * pendentes a sério, e não se misturam com os buracos.
   */
  porVerAFrente: number;
}

const VAZIO: Buracos = { porTemporada: [], total: 0, porVerAFrente: 0 };

/**
 * @param temporadas por ordem de apresentação, com quantos episódios têm
 * @param visto      diz se (temporada, episódio) está marcado
 */
export function encontrarBuracos(
  temporadas: { number: number; episodeCount: number }[],
  visto: (temporada: number, episodio: number) => boolean,
): Buracos {
  if (temporadas.length === 0) return VAZIO;

  // Percorre tudo por ordem e guarda onde ficou o último visto. É esse ponto
  // que separa "esqueci-me de marcar" (antes) de "ainda não vi" (depois).
  const ordenadas = [...temporadas].sort((a, b) => a.number - b.number);
  let ultimoVisto = -1;
  const posicoes: { temporada: number; episodio: number; visto: boolean }[] = [];
  for (const t of ordenadas) {
    for (let e = 1; e <= t.episodeCount; e++) {
      const marcado = visto(t.number, e);
      if (marcado) ultimoVisto = posicoes.length;
      posicoes.push({ temporada: t.number, episodio: e, visto: marcado });
    }
  }
  if (ultimoVisto < 0) return VAZIO;

  const porTemporada = new Map<number, number[]>();
  let total = 0;
  for (let i = 0; i < ultimoVisto; i++) {
    const p = posicoes[i];
    if (p.visto) continue;
    const lista = porTemporada.get(p.temporada) ?? [];
    lista.push(p.episodio);
    porTemporada.set(p.temporada, lista);
    total += 1;
  }

  return {
    porTemporada: [...porTemporada.entries()]
      .map(([temporada, episodios]) => ({ temporada, episodios }))
      .sort((a, b) => a.temporada - b.temporada),
    total,
    porVerAFrente: posicoes.length - 1 - ultimoVisto,
  };
}

/** "22 episódios" / "1 episódio" — usado em mais do que um sítio. */
export function contarEpisodios(n: number): string {
  return `${n} episódio${n === 1 ? "" : "s"}`;
}
