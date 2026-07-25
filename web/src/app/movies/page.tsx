import { redirect } from "next/navigation";

// A lista de filmes vive na Biblioteca (separador Filmes) — esta página
// duplicava-a sem pesquisa nem ordenação. O redirect mantém links antigos vivos.
export default function MoviesRedirect() {
  redirect("/library?tipo=filmes");
}
