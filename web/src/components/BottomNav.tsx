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
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-panel/90 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-2xl">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-14 flex-1 cursor-pointer flex-col items-center justify-center gap-1 text-[11px] transition-colors active:scale-90 ${
                active ? "text-signal" : "text-faint hover:text-dim"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className={active ? "font-semibold" : ""}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
