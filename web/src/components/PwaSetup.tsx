"use client";

import { useEffect } from "react";

// Regista o service worker. A dica de instalar no iPhone já não vive aqui:
// era `fixed` por cima de qualquer ecrã e tapava ações (Fase 3 da Mira) —
// passou a uma linha no fluxo da casa, `components/mira/DicaInstalar.tsx`.
export default function PwaSetup() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // regista após o load para não competir com o arranque da app
    const register = () => navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
