/**
 * Uma temporada de 51 episódios vistos até ao 19 é 51 linhas iguais — a
 * mesma pastilha verde repetida 19 vezes antes de chegar ao que interessa.
 * Medido no Naruto: T2 dava 3609px de documento, 5,5 ecrãs para rolar até
 * ao primeiro buraco a 1757px.
 *
 * O que separa "visto" de "por marcar" já não precisa de uma linha cada —
 * precisa de um resumo. O que precisa de ficar aberto é o que quebra a
 * sequência: os buracos, e o ponto onde a série ainda não foi vista.
 *
 * Corridas curtas (3 ou menos) não colapsam — dobrar um toque para poupar
 * duas linhas não compensa.
 */

const CORRIDA_MINIMA = 4;

export type BlocoEpisodios =
  | { tipo: "corrida"; inicio: number; fim: number }
  | { tipo: "unico"; episodio: number };

export function agruparEpisodios(
  total: number,
  visto: (episodio: number) => boolean,
): BlocoEpisodios[] {
  const blocos: BlocoEpisodios[] = [];
  let i = 1;
  while (i <= total) {
    if (!visto(i)) {
      blocos.push({ tipo: "unico", episodio: i });
      i += 1;
      continue;
    }
    let j = i;
    while (j <= total && visto(j)) j += 1;
    if (j - i >= CORRIDA_MINIMA) {
      blocos.push({ tipo: "corrida", inicio: i, fim: j - 1 });
    } else {
      for (let k = i; k < j; k += 1) blocos.push({ tipo: "unico", episodio: k });
    }
    i = j;
  }
  return blocos;
}
