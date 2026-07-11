"use client";

import { usePathname } from "next/navigation";

// Remonta o conteúdo a cada rota (key = pathname), o que reinicia a
// animação CSS "page-enter" — um fade + leve subida a cada navegação.
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="page-enter flex flex-1 flex-col">
      {children}
    </div>
  );
}
