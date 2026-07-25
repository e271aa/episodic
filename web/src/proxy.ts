/**
 * Proxy (o antigo middleware, renomeado no Next.js 16) — protege as rotas e
 * mantém a sessão do Supabase viva em cookies, partilhada browser⇄servidor.
 *
 * Regras que segue:
 *  1. Nunca partir a app: qualquer erro deixa passar em vez de bloquear.
 *  2. Sem cloud configurada, não há nada para proteger — passa sempre.
 *  3. `getSession()` e não `getUser()`: lê o JWT do cookie e valida a validade
 *     localmente. Só vai à rede quando o token expirou mesmo.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Rotas que têm de funcionar sem sessão. */
const PUBLIC_PATHS = ["/login", "/auth"];

/** Ficheiros da PWA que o iPhone pede sem cookies — nunca podem redirecionar. */
const PUBLIC_FILES = ["/sw.js", "/manifest.webmanifest", "/icon.svg", "/apple-icon.png"];

function isPublic(pathname: string): boolean {
  if (PUBLIC_FILES.includes(pathname)) return true;
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Sem chaves não há autenticação possível: a app corre em modo local.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return NextResponse.next();

  // Defesa em profundidade: o matcher já exclui isto, mas se alguém lhe mexer
  // não queremos bloquear CSS, imagens ou o service worker.
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/") ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  try {
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          // O refresh do token devolve cookies novos: têm de ir no pedido
          // (para esta renderização) e na resposta (para o browser guardar).
          for (const { name, value } of cookies) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookies) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session && !isPublic(pathname)) {
      const login = request.nextUrl.clone();
      login.pathname = "/login";
      // guarda para onde ias, para voltares lá depois de entrares
      if (pathname !== "/") login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }

    // Já com sessão, a página de login não tem razão de existir.
    if (session && pathname === "/login") {
      const home = request.nextUrl.clone();
      home.pathname = "/series";
      home.search = "";
      return NextResponse.redirect(home);
    }
  } catch {
    // Supabase em baixo ou cookie corrompido: melhor deixar entrar do que
    // trancar o Ruben fora da própria biblioteca.
    return response;
  }

  return response;
}

export const config = {
  // Corre em tudo menos ficheiros estáticos e imagens — sem isto o redirect
  // apanharia CSS e JS e a app não carregava sequer o ecrã de login.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|js|css|webmanifest)$).*)"],
};
