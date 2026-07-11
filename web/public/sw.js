// Service worker do Episodic — funciona offline e acelera as visitas seguintes.
// Estratégias:
//  - Navegações e recursos da app: "network-first" com fallback à cache (a app
//    abre offline com a última versão vista).
//  - Posters (image.tmdb.org / TVmaze): "cache-first" (não mudam; poupa dados).
const APP_CACHE = "episodic-app-v1";
const IMG_CACHE = "episodic-img-v1";
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

  // Posters de fornecedores externos: cache-first
  if (IMG_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.open(IMG_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        try {
          const res = await fetch(request);
          if (res.ok) cache.put(request, res.clone());
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
