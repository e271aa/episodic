"use client";

import { useState, useSyncExternalStore } from "react";
import Segmentado from "@/components/mira/Segmentado";
import { aplicarAparencia, lerAparencia, type Aparencia } from "@/lib/aparencia";

// A escolha guardada muda noutro separador (evento `storage`) ou aqui; no
// servidor não há `localStorage`, e «Automático» é o que o HTML já mostra.
const subscrever = (aviso: () => void) => {
  window.addEventListener("storage", aviso);
  return () => window.removeEventListener("storage", aviso);
};

/** Perfil › Aparência: Automático (segue o iPhone), Noite ou Claro. */
export default function EscolhaAparencia() {
  const guardada = useSyncExternalStore(subscrever, lerAparencia, () => "auto" as Aparencia);
  const [escolha, setEscolha] = useState<Aparencia | null>(null);
  return (
    <Segmentado
      rotulo="Aparência"
      valor={escolha ?? guardada}
      onChange={(a) => {
        setEscolha(a);
        aplicarAparencia(a);
      }}
      opcoes={[
        { valor: "auto", nome: "Automático" },
        { valor: "noite", nome: "Noite" },
        { valor: "claro", nome: "Claro" },
      ]}
    />
  );
}
