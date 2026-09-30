import type { MetadataRoute } from "next";

// Web App Manifest — permite instalar o Episodic no ecrã inicial (PWA).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Episodic",
    short_name: "Episodic",
    description:
      "O teu registo de séries — o que viste, o que falta, o que vem a seguir.",
    start_url: "/series",
    display: "standalone",
    orientation: "portrait",
    background_color: "#000000",
    theme_color: "#000000",
    lang: "pt",
    categories: ["entertainment", "lifestyle"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      // "maskable" — o mesmo desenho serve: a carta de teste vai de ponta a ponta e lê-se recortada
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
