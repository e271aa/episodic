// Agrupar a biblioteca em secções. A regra: o agrupamento segue sempre a
// ordem escolhida — por tempo dá períodos, por A–Z dá letras, por estreia dá
// décadas. Assim a ordem ativa vê-se sem ser preciso ler o botão.
//
// Os itens já chegam ordenados, por isso basta percorrer e cortar quando o
// rótulo muda: preserva a ordem e nunca inventa uma diferente.

export interface Group<T> {
  label: string;
  items: T[];
}

const DIA = 24 * 60 * 60 * 1000;

/** Períodos relativos: o que é recente merece nome, o resto agrupa-se por ano. */
export function periodLabel(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "Sem data";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "Sem data";
  const idade = now - t;
  if (idade < 7 * DIA) return "Esta semana";
  if (idade < 31 * DIA) return "Este mês";
  const ano = new Date(t).getFullYear();
  return ano === new Date(now).getFullYear() ? "Este ano" : String(ano);
}

/** Primeira letra, sem acentos. Tudo o que não é letra cai em "#". */
export function letterLabel(name: string): string {
  const first = name
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .charAt(0)
    .toUpperCase();
  return /[A-Z]/.test(first) ? first : "#";
}

/**
 * "Anos 70", "Anos 2000". Em português não se diz "1970s" — e o rótulo entra
 * em caixa alta nas bandas, onde "1970S" ficaria com um S solto no fim.
 */
export function decadeLabel(year: number): string {
  if (!Number.isFinite(year)) return "Sem data";
  const decada = Math.floor(year / 10) * 10;
  return decada < 2000 ? `Anos ${String(decada).slice(2)}` : `Anos ${decada}`;
}

/**
 * Corta a lista já ordenada em secções consecutivas.
 *
 * Devolve null quando agrupar não ajuda — com poucos itens, ou quando cada
 * secção teria um item só, as bandas roubam mais espaço do que o contexto
 * que dão.
 */
export function groupSorted<T>(
  items: T[],
  labelOf: ((item: T) => string) | null,
  minItems = 12,
): Group<T>[] | null {
  if (!labelOf || items.length < minItems) return null;
  const groups: Group<T>[] = [];
  for (const item of items) {
    const label = labelOf(item);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  // Uma secção só não é uma secção; e se quase todas tiverem 1 item, o
  // agrupamento está a fragmentar em vez de organizar.
  if (groups.length < 2) return null;
  const soltos = groups.filter((g) => g.items.length === 1).length;
  if (soltos > groups.length * 0.6) return null;
  return groups;
}

/**
 * Agrupa em secções fixas, pela ordem dada — ao contrário do `groupSorted`,
 * que corta a lista em troços consecutivos e por isso só serve quando o
 * rótulo acompanha a ordenação.
 *
 * Foi preciso porque a Biblioteca passou a agrupar por ESTADO enquanto
 * continua ordenada por data: com o `groupSorted`, "Completas" aparecia
 * várias vezes intercalado com "A ver" — e como o rótulo é a chave do React,
 * dava secções repetidas e um aviso de chaves duplicadas.
 *
 * Dentro de cada secção a ordem de entrada mantém-se, que é a ordenação
 * escolhida pelo utilizador.
 */
export function groupByBucket<T>(
  items: T[],
  labelOf: (item: T) => string,
  ordem: string[],
): Group<T>[] | null {
  const baldes = new Map<string, T[]>();
  for (const item of items) {
    const label = labelOf(item);
    baldes.set(label, [...(baldes.get(label) ?? []), item]);
  }
  const groups = ordem
    .filter((label) => (baldes.get(label)?.length ?? 0) > 0)
    .map((label) => ({ label, items: baldes.get(label)! }));
  // secções que não estavam na ordem conhecida vão para o fim, sem se perderem
  for (const [label, lista] of baldes) {
    if (!ordem.includes(label)) groups.push({ label, items: lista });
  }
  return groups.length >= 2 ? groups : null;
}
