"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CardsBone } from "@/components/Skeleton";

/**
 * As listas passaram a ser o terceiro separador da Biblioteca (Ronda 12,
 * Fase 5b.3). Esta rota fica para os links antigos e para o recuar de uma
 * lista aberta de raiz: leva ao separador, sem deixar uma entrada a mais no
 * histórico (`replace`, não `push`). Do lado do cliente, para funcionar sem
 * rede na PWA.
 */
export default function ListasPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/library?tipo=listas");
  }, [router]);
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-10">
      <CardsBone count={3} height="h-16" />
    </main>
  );
}
