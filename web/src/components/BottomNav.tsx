"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CompassIcon, LibraryIcon, TvIcon, UserIcon } from "@/components/icons";

// 4 paragens: o "A seguir" decide o que vês agora, o Explorar traz o que
// ainda não conheces, a Biblioteca guarda tudo, o Perfil é só teu.
const TABS = [
  { href: "/series", label: "A seguir", Icon: TvIcon },
  { href: "/explorar", label: "Explorar", Icon: CompassIcon },
  { href: "/library", label: "Biblioteca", Icon: LibraryIcon },
  { href: "/profile", label: "Perfil", Icon: UserIcon },
] as const;

/**
 * Sem origem conhecida (a app aberta direto num ecrã interior), a que
 * separador pertence cada rota.
 */
function separadorDaRota(pathname: string): string {
  if (pathname.startsWith("/movies") || pathname.startsWith("/listas")) return "/library";
  if (pathname.startsWith("/rever") || pathname.startsWith("/estatisticas")) return "/profile";
  if (pathname.startsWith("/import")) return "/profile";
  if (pathname.startsWith("/explorar")) return "/explorar";
  if (pathname.startsWith("/library")) return "/library";
  if (pathname.startsWith("/profile")) return "/profile";
  return "/series";
}

export default function BottomNav() {
  const pathname = usePathname();

  // A dock acende o separador de onde se veio, não o "tipo" do ecrã: uma
  // série aberta a partir da Biblioteca acendia "A seguir" (Ronda 12, Fase
  // 4, achado #10). A dock vive no layout e não se desmonta ao navegar, por
  // isso lembra-se do último separador visitado; a regra fixa por rota só
  // entra quando não há origem nenhuma.
  const raiz = TABS.find((t) => t.href === pathname)?.href ?? null;
  const [origem, setOrigem] = useState<string | null>(raiz);
  if (raiz !== null && raiz !== origem) setOrigem(raiz);
  const ativo = raiz ?? origem ?? separadorDaRota(pathname);

  // No login não há para onde navegar — a dock só confundiria.
  if (pathname === "/login") return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      {/* O conteúdo que passa por trás da dock cortava a meio, e um corte a
          direito lê-se como avaria. O degradê faz a lista desvanecer para o
          fundo da app antes de lá chegar. `-z-10` para ficar atrás da pílula
          e `pointer-events-none` para não roubar o toque ao que está por baixo. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[110px] bg-gradient-to-t from-tube via-tube/85 to-transparent"
      />
      <div className="flex items-center gap-1 rounded-full border border-line bg-panel/90 p-1.5 shadow-[0_8px_28px_-8px_rgba(0,0,0,0.6)] backdrop-blur-lg">
        {TABS.map(({ href, label, Icon }) => {
          const active = href === ativo;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-[0.9375rem] font-medium transition-colors active:scale-95 ${
                active ? "bg-ink text-tube" : "text-dim hover:text-ink"
              }`}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {/* whitespace-nowrap: a 320px, "A seguir" quebrava em duas
                  linhas e a pílula do separador ativo crescia para 61px
                  (Ronda 12, Fase 4, achado novo). */}
              <span className={active ? "whitespace-nowrap" : "hidden sm:inline"}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
