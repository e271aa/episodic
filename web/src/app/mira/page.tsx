import type { Metadata } from "next";
import VitrineClient from "./VitrineClient";

// A vitrine das primitivas da Mira (Ronda 14). Só dados de exemplo — não lê
// nem escreve a biblioteca. Serve para ver e julgar a base (Fase 3) nos dois
// modos; sai antes de o ramo `mira` entrar no `main` (Fase 12).
export const metadata: Metadata = { title: "Mira · vitrine", robots: { index: false } };

export default function Page() {
  return <VitrineClient />;
}
