import { useId } from "react";

/**
 * A palavra «flicki» (a marca, desenhada à parte; `marca/wordmark-*.svg`).
 * Traços em `currentColor`: segue o modo sem cor fixa — `label` à noite é
 * claro e de dia é escuro, como os dois ficheiros da marca. O tamanho vem da
 * altura (`h-…`); a largura acompanha (207×72). Mínimo: 14px de altura.
 */
export default function Palavra({ className = "" }: { className?: string }) {
  const id = useId();
  return (
    <svg
      role="img"
      aria-label="Flicki"
      viewBox="0 8 207 72"
      className={`w-auto ${className}`}
      fill="none"
    >
      <defs>
        <clipPath id={id}>
          <rect x="-20" y="30" width="400" height="50" />
        </clipPath>
      </defs>
      <g stroke="currentColor" strokeWidth="11" strokeLinecap="butt" strokeLinejoin="miter">
        <path d="M12.5 80V27A13.5 13.5 0 0 1 26 13.5H34.5" />
        <path d="M0 35.5H27" />
        <path d="M50 8V80" />
        <path d="M74 30V80" />
        <path d="M129.99 41.95A19.5 19.5 0 1 0 129.99 68.05" />
        <path d="M151.2 8V80" />
        <path d="M201.5 30V80" />
        <g clipPath={`url(#${id})`}>
          <path d="M151.7 64L181.9 24.4" />
          <path d="M162.4 50L183.2 86.1" />
        </g>
      </g>
      <rect x="68.5" y="8" width="11" height="11" fill="currentColor" />
      <rect x="196" y="8" width="11" height="11" fill="currentColor" />
    </svg>
  );
}
