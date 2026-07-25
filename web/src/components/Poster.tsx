"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { imageUrl } from "@/lib/tmdb";

interface PosterProps {
  path: string | null | undefined;
  alt: string;
  size?: "w185" | "w342" | "w500" | "w780" | "original";
  /** enche o pai (que precisa de `position:relative`) — para grelhas e heróis */
  fill?: boolean;
  /** só quando `fill` não se aplica (capas de tamanho fixo nos cabeçalhos) */
  width?: number;
  height?: number;
  className?: string;
  /** o LCP da página (ex. o herói de "A seguir") — sem lazy, com prioridade alta */
  priority?: boolean;
  sizes?: string;
  /** false nos cartões arrastáveis — evita o browser iniciar o seu próprio
   *  drag-and-drop de imagem por cima do gesto por pointer events */
  draggable?: boolean;
}

/**
 * Uma capa TMDB/TVmaze via `next/image`: AVIF/WebP, tamanho certo por pedido,
 * cache na edge da Vercel — em vez do JPEG pesado a vir sempre do fornecedor.
 *
 * O brilho de carregamento é uma `div` irmã, não um `::after` na imagem: os
 * elementos substituídos (`<img>`) não suportam pseudo-elementos de forma
 * fiável em todos os motores (o Safari é o caso conhecido).
 */
export default function Poster({
  path,
  alt,
  size = "w342",
  fill,
  width,
  height,
  className = "",
  priority,
  sizes,
  draggable = true,
}: PosterProps) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const src = imageUrl(path, size);
  if (!src) return null;

  // Se a imagem já está na cache do browser (ex.: o mesmo poster que acabou
  // de aparecer na grelha, agora reaberto no detalhe), o `<img>` carrega
  // antes de o React montar e o `onLoad` nunca dispara — ficava invisível
  // para sempre. `ref` de callback corre no próprio commit, a tempo.
  const checkAlreadyLoaded = (el: HTMLImageElement | null) => {
    imgRef.current = el;
    if (el?.complete && el.naturalWidth > 0) setLoaded(true);
  };

  return (
    <>
      {!loaded && (
        <div
          aria-hidden
          className={`poster-shimmer absolute inset-0 overflow-hidden ${fill ? "" : className}`}
          style={fill ? undefined : { width, height }}
        />
      )}
      <Image
        ref={checkAlreadyLoaded}
        src={src}
        alt={alt}
        fill={fill}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        sizes={sizes}
        priority={priority}
        loading={priority ? undefined : "lazy"}
        onLoad={() => setLoaded(true)}
        draggable={draggable}
        className={`${className} transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </>
  );
}
