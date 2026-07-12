"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClapperboardIcon, SearchIcon, TvIcon, UserIcon } from "@/components/icons";

const TABS = [
  { href: "/series", label: "Séries", Icon: TvIcon },
  { href: "/movies", label: "Filmes", Icon: ClapperboardIcon },
  { href: "/explore", label: "Explorar", Icon: SearchIcon },
  { href: "/profile", label: "Perfil", Icon: UserIcon },
] as const;

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-panel/85 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.5)] backdrop-blur-lg">
      <div className="mx-auto flex max-w-2xl">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`group relative flex min-h-14 flex-1 cursor-pointer flex-col items-center justify-center gap-1 text-[11px] transition-colors active:scale-90 ${
                active ? "text-signal" : "text-faint hover:text-dim"
              }`}
            >
              <span
                className={`absolute top-1.5 h-8 w-12 rounded-full bg-signal-soft transition-all duration-200 ${
                  active ? "opacity-100 scale-100" : "opacity-0 scale-75"
                }`}
                aria-hidden
              />
              <Icon className="relative h-5 w-5" />
              <span className={`relative ${active ? "font-semibold" : ""}`}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
