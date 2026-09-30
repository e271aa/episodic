import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Só no `next dev`: a pré-visualização da Mira abre-se no iPhone pelo IP do
  // Mac na rede de casa. Sem isto, o Next 16 recusa os recursos de dev a
  // qualquer origem que não seja `localhost` e a página nunca hidrata — vê-se,
  // mas nenhum botão responde (medido a 29-09: `http://192.168.1.163:3300`).
  allowedDevOrigins: ["127.0.0.1", "192.168.*.*"],
  // O «N» redondo do `next dev` ficava por cima do «A» do «A seguir» na barra de
  // separadores da pré-visualização no iPhone (Fase 11). Só existe em dev.
  devIndicators: false,
  // Capas otimizadas pela Vercel: AVIF/WebP, tamanho certo por pedido, cache
  // na edge — em vez de 227+ JPEGs pesados a virem sempre do TMDB/TVmaze.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "static.tvmaze.com" },
      // avatares no Supabase Storage — qualquer projeto, para o mesmo
      // código servir outra instalação sem mexer aqui
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
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
