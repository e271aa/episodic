"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LibraryIcon, TvIcon, UserIcon } from "@/components/icons";

// 3 paragens: o "Esta noite" decide, a Biblioteca guarda tudo, o Perfil é
// só teu. O Explorar fundiu-se na Biblioteca (campo de pesquisa no topo).
const TABS = [
  { href: "/series", label: "Esta noite", Icon: TvIcon },
  { href: "/library", label: "Biblioteca", Icon: LibraryIcon },
  { href: "/profile", label: "Perfil", Icon: UserIcon },
] as const;

export default function BottomNav() {
  const pathname = usePathname();

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
