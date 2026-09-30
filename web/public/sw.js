// Service worker do Flicki — funciona offline e acelera as visitas seguintes.
// Estratégias:
//  - Navegações e recursos da app: "network-first" com fallback à cache (a app
//    abre offline com a última versão vista).
//  - Posters: "cache-first" (não mudam; poupa dados). Desde que as capas
//    passaram pelo otimizador de imagens da Vercel (next/image), já não vêm
//    diretas de image.tmdb.org/static.tvmaze.com — vêm de /_next/image, que é
//    same-origin. É esse caminho que tem de ser tratado como cache-first
//    agora; os hosts externos ficam só por segurança (páginas antigas em cache).
const APP_CACHE = "flicki-app-v1";
const IMG_CACHE = "flicki-img-v1";
const IMG_HOSTS = ["image.tmdb.org", "static.tvmaze.com"];

self.addEventListener("install", (event) => {
  // ativa a nova versão sem esperar por fechar todas as abas
  self.skipWaiting();
  event.waitUntil(caches.open(APP_CACHE));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // limpa caches de versões antigas
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== APP_CACHE && k !== IMG_CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Posters: cache-first. `/_next/image` é o caminho normal agora (a Vercel
  // já tratou do resize/formato); os hosts externos ficam para o caso de
  // ainda haver pedidos diretos numa página em cache de antes desta mudança.
  if (url.pathname.startsWith("/_next/image") || IMG_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.open(IMG_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        try {
          const res = await fetch(request);
          // Uma <img> para outro domínio sem CORS devolve uma resposta OPACA:
          // status 0 e, portanto, `ok` false. Testar só por `ok` fazia com que
          // nenhuma capa fosse alguma vez guardada — e todas voltassem a ser
          // descarregadas em cada visita.
          if (res.ok || res.type === "opaque") {
            void cache.put(request, res.clone());
          }
          return res;
        } catch {
          return hit ?? Response.error();
        }
      }),
    );
    return;
  }

  // Só tratamos recursos da própria origem daqui para a frente
  if (url.origin !== self.location.origin) return;

  // App (páginas + assets): network-first, com fallback à cache
  event.respondWith(
    (async () => {
      try {
        const res = await fetch(request);
        if (res.ok) {
          const cache = await caches.open(APP_CACHE);
          cache.put(request, res.clone());
        }
        return res;
      } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        // fallback final: a última página que estiver em cache
        if (request.mode === "navigate") {
          const shell = await caches.match("/series");
          if (shell) return shell;
        }
        return Response.error();
      }
    })(),
  );
});
