import type { Metadata } from "next";
import SeriesPage from "./SeriesPageClient";

// A componente de cliente não pode exportar `metadata` — só os Server
// Components podem (Ronda 12, Fase 5e, achado #14: os 18 ecrãs liam-se
// todos com o nome da app). Esta casca fininha é o que dá o <title> a sério.
export const metadata: Metadata = { title: "A seguir" };

export default SeriesPage;
