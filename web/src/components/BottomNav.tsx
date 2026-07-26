"use client";

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

export default function BottomNav() {
  const pathname = usePathname();

  // No login não há para onde navegar — a dock só confundiria.
  if (pathname === "/login") return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center gap-1 rounded-full border border-line bg-panel/90 p-1.5 shadow-[0_8px_28px_-8px_rgba(0,0,0,0.6)] backdrop-blur-lg">
        {TABS.map(({ href, label, Icon }) => {
          const active =
            pathname === href ||
            pathname.startsWith(href + "/") ||
            (href === "/library" && pathname.startsWith("/movies"));
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors active:scale-95 ${
                active ? "bg-ink text-tube" : "text-dim hover:text-ink"
              }`}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className={active ? "" : "hidden sm:inline"}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
