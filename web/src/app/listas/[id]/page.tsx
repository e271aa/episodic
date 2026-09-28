import type { Metadata } from "next";
import ListaPage from "./ListaPageClient";

// O nome da lista vive só no IndexedDB do telemóvel — ver a mesma nota em
// series/[uuid]/page.tsx.
export const metadata: Metadata = { title: "Lista" };

export default ListaPage;
