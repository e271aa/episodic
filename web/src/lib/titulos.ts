/**
 * Que título se mostra: o original, como no TV Time (Ronda 12, F4).
 *
 * A biblioteca do Ruben guarda os nomes como o TV Time os exportou — "Severance",
 * "The Wire" — e a TMDB responde em pt-PT ("Separação", "A Escuta"): a mesma
 * série aparecia com dois nomes conforme o ecrã. Escolheu o original em
 * todo o lado.
 *
 * Só se o original for em alfabeto latino. O original de "Attack on Titan"
 * é "進撃の巨人" — não é o nome que ele conhece, e é ilegível para ele; aí
 * fica o título em português da TMDB.
 */
const LATINO = /^[\p{Script=Latin}\p{N}\p{P}\p{S}\s]+$/u;

export function tituloParaMostrar(
  pt: string,
  original: string | null | undefined,
): { nome: string; outro: string | null } {
  if (original && LATINO.test(original)) {
    return { nome: original, outro: original === pt ? null : pt || null };
  }
  return { nome: pt, outro: original && original !== pt ? original : null };
}
