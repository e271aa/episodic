"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "episodic-ios-install-dismissed";

// Regista o service worker e, no iOS Safari (onde não há prompt automático),
// mostra uma dica discreta para "Adicionar ao ecrã principal".
export default function PwaSetup() {
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      // regista após o load para não competir com o arranque da app
      const register = () =>
        navigator.serviceWorker
          .register("/sw.js", { scope: "/" })
          .catch(() => {});
      if (document.readyState === "complete") register();
      else window.addEventListener("load", register, { once: true });
    }

    // deteção do iOS diferida para fora do corpo do efeito (evita render em cascata)
    const raf = requestAnimationFrame(() => {
      const isIOS =
        /ipad|iphone|ipod/.test(navigator.userAgent.toLowerCase()) &&
        !("MSStream" in window);
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        // Safari iOS usa esta propriedade não-standard
        (navigator as unknown as { standalone?: boolean }).standalone === true;
      const dismissed = localStorage.getItem(DISMISS_KEY) === "1";
      if (isIOS && !isStandalone && !dismissed) setShowIosHint(true);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!showIosHint) return null;

  return (
    <div className="fixed inset-x-0 bottom-16 z-40 mx-auto max-w-2xl px-4 pb-[env(safe-area-inset-bottom)]">
      <div className="page-enter flex items-start gap-3 rounded-2xl border border-line bg-raised p-3 shadow-lg">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink text-tube">
          {/* ícone de partilha do iOS */}
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
            <path
              d="M12 3v12M12 3l-4 4M12 3l4 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium">Instala o Episodic no teu iPhone</p>
          <p className="mt-0.5 text-dim">
            Toca em <span className="text-ink">Partilhar</span> e depois em{" "}
            <span className="text-ink">Adicionar ao ecrã principal</span>.
          </p>
        </div>
        <button
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, "1");
            setShowIosHint(false);
          }}
          aria-label="Dispensar"
          className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-faint hover:text-ink"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
