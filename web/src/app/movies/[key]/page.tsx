import type { Metadata } from "next";
import MoviePage from "./MoviePageClient";

// O nome do filme vive só no IndexedDB do telemóvel — ver a mesma nota em
// series/[uuid]/page.tsx.
export const metadata: Metadata = { title: "Filme" };

export default MoviePage;
