"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, LayoutGrid, Tv, User } from "lucide-react";

// 4 paragens: o "A seguir" decide o que vês agora, o Explorar traz o que
// ainda não conheces, a Biblioteca guarda tudo, o Perfil é só teu.
const TABS = [
  { href: "/series", label: "A seguir", Icon: Tv },
  { href: "/explorar", label: "Explorar", Icon: Compass },
  { href: "/library", label: "Biblioteca", Icon: LayoutGrid },
  { href: "/profile", label: "Perfil", Icon: User },
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
    <nav
      aria-label="Separadores"
      className="fixed inset-x-0 bottom-0 z-50 px-4"
      style={{ paddingBottom: "var(--barra-fundo)" }}
    >
      {/* O conteúdo que passa por trás desvanece para o fundo antes de chegar
          à barra: um corte a direito lê-se como avaria. Atrás da cápsula
          (`-z-10`) e sem apanhar toques. */}
      <div
        aria-hidden
        // a altura é a da reserva de cada página (`--dock-h` + 8px): mais alto, o
        // degradê desbotava o que já está fora da reserva — as cápsulas da casa
        // vazia ficavam cinzentas (Ronda 14, Fase 2; o mesmo que na 5b.4)
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[calc(var(--dock-h)+8px)] bg-gradient-to-t from-bg via-bg/85 to-transparent"
      />
      {/* A barra da Mira (Ronda 14): cápsula de vidro de 64px, quatro colunas
          iguais, os quatro nomes à vista — a v2 escondia três e o VoiceOver
          ficava sem nome (5b.4). Em px de propósito: não cresce com o texto. */}
      <div className="vidro mx-auto grid h-[var(--barra-h)] max-w-md grid-cols-4 rounded-[32px] p-1">
        {TABS.map(({ href, label, Icon }) => {
          const active = href === ativo;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              aria-label={label}
              className={`@container flex cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[28px] transition-[background-color,transform] duration-150 active:scale-95 ${
                active ? "bg-[var(--m-tab-on)] text-label" : "text-label-2"
              }`}
            >
              {/* O nome enquanto couber na coluna; com o texto grande (150%)
                  deixa de caber, sai, e o ícone cresce para 28px — o nome
                  continua no `aria-label`. É a coluna que decide, não um
                  número mágico: a medida é a largura dela em rem. */}
              <Icon
                aria-hidden
                strokeWidth={active ? 2 : 1.8}
                className="h-7 w-7 shrink-0 @[3.4rem]:h-6 @[3.4rem]:w-6"
              />
              <span
                // piso de 10px: a 0,59rem, com o texto do Ruben (15px), davam 8,85px —
                // o iOS mantém os nomes da barra à volta dos 10pt
                className={`hidden whitespace-nowrap text-[max(10px,0.59rem)] leading-none @[3.4rem]:block ${
                  active ? "font-semibold" : "font-medium"
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
