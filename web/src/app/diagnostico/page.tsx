import type { Metadata } from "next";
import DiagnosticoClient from "./DiagnosticoClient";

// O que só se vê com a PWA instalada no iPhone (Ronda 14, Fase 11): área segura,
// barra de estado, tamanho de texto do sistema, cores — e uma medição de vidro
// a rolar feita no próprio aparelho. Só lê; não escreve nada. Sai com a vitrine
// `/mira` antes de o ramo entrar no `main` (Fase 12).
export const metadata: Metadata = { title: "Diagnóstico", robots: { index: false } };

export default function Page() {
  return <DiagnosticoClient />;
}
