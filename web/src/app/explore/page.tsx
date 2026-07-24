import { redirect } from "next/navigation";

// O Explorar fundiu-se na Biblioteca (campo de pesquisa no topo) — este
// redirecionamento mantém a hiperligação antiga (favoritos, atalhos) a funcionar.
export default function ExploreRedirect() {
  redirect("/library");
}
