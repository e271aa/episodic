import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Capas otimizadas pela Vercel: AVIF/WebP, tamanho certo por pedido, cache
  // na edge — em vez de 227+ JPEGs pesados a virem sempre do TMDB/TVmaze.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "static.tvmaze.com" },
    ],
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      {
        // O service worker nunca deve ficar em cache — garante que o utilizador
        // recebe sempre a versão mais recente.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
