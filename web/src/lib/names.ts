/**
 * Comparação de títulos entre sistemas.
 *
 * A mesma série tem nomes ligeiramente diferentes conforme quem a indexa —
 * "Marvel's Daredevil" vs "Daredevil", "Pokémon" vs "Pokemon" — e o mesmo
 * título aparece com pontuação diferente. Sem uma forma normalizada, o
 * Explorar sugeria séries que já estavam na biblioteca e criava duplicados.
 */
export function normalizeTitle(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ") // pontuação e símbolos viram espaço
    .trim();
}
