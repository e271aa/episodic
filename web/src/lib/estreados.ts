/**
 * Quantos episódios de cada temporada já estrearam.
 *
 * O total da série vinha de `episodes.length` (TVmaze) e `number_of_episodes`
 * (TMDB), e os dois contam episódios **anunciados**. No dia em que uma série
 * em que estás em dia anuncia a temporada seguinte, a app passava a dizer
 * "10 por ver" — de episódios que ninguém podia ter visto. Medido na Fase 0
 * da Ronda 12: zero séries afetadas nesse dia, mas a próxima temporada
 * anunciada de qualquer série em dia tê-lo-ia causado.
 *
 * Regra por posição, não por data de cada episódio: conta como estreado tudo
 * até ao ÚLTIMO episódio com data passada. Um episódio antigo sem data (a
 * TVmaze tem alguns) no meio de episódios estreados estreou, claro — e
 * contá-lo como "por estrear" punha um buraco onde não há.
 */

export interface ContagemTemporada {
  listados: number;
  estreados: number;
}

/** TVmaze: a lista de episódios, pela ordem em que a API a devolve. */
export function estreadosTvmaze(
  episodios: { season: number; airdate?: string | null }[],
  hoje: string,
): Map<number, ContagemTemporada> {
  let ultimo = -1;
  episodios.forEach((ep, i) => {
    if (ep.airdate && ep.airdate <= hoje) ultimo = i;
  });
  const porTemporada = new Map<number, ContagemTemporada>();
  episodios.forEach((ep, i) => {
    const t = porTemporada.get(ep.season) ?? { listados: 0, estreados: 0 };
    t.listados += 1;
    if (i <= ultimo) t.estreados += 1;
    porTemporada.set(ep.season, t);
  });
  return porTemporada;
}

/**
 * TMDB: o resumo das temporadas e o último episódio emitido, que a TMDB dá
 * nos detalhes da série — sem pedir temporada a temporada.
 *
 * `ultimo === undefined` (a TMDB não disse) conta tudo como estreado: não
 * saber não pode apagar temporadas inteiras. `null` é a TMDB a dizer que
 * ainda não estreou nada.
 */
export function estreadosTmdb(
  temporadas: { season_number: number; episode_count: number }[],
  ultimo: { season_number: number; episode_number: number } | null | undefined,
): Map<number, ContagemTemporada> {
  const porTemporada = new Map<number, ContagemTemporada>();
  for (const t of temporadas) {
    let estreados = t.episode_count;
    if (ultimo === null) estreados = 0;
    else if (ultimo) {
      if (t.season_number > ultimo.season_number) estreados = 0;
      else if (t.season_number === ultimo.season_number) {
        estreados = Math.min(t.episode_count, ultimo.episode_number);
      }
    }
    porTemporada.set(t.season_number, { listados: t.episode_count, estreados });
  }
  return porTemporada;
}

export function somaEstreados(contagens: Map<number, ContagemTemporada>): number {
  let total = 0;
  for (const [numero, c] of contagens) if (numero > 0) total += c.estreados;
  return total;
}
