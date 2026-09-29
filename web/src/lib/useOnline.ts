"use client";

import { useSyncExternalStore } from "react";

function subscrever(ouvinte: () => void): () => void {
  window.addEventListener("online", ouvinte);
  window.addEventListener("offline", ouvinte);
  return () => {
    window.removeEventListener("online", ouvinte);
    window.removeEventListener("offline", ouvinte);
  };
}

/** Há rede? No servidor (e na hidratação) assume-se que sim. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscrever,
    () => navigator.onLine,
    () => true,
  );
}
