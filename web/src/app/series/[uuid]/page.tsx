import type { Metadata } from "next";
import ShowPage from "./ShowPageClient";

// O nome da série vive só no IndexedDB do telemóvel (a app é local-first) —
// um Server Component não lhe chega, por isso o <title> aqui é só o tipo de
// ecrã, não o nome. Ainda assim, "Série" já distingue este ecrã de
// "Episodic" nos outros 17 (Ronda 12, Fase 5e, achado #14).
export const metadata: Metadata = { title: "Série" };

export default ShowPage;
