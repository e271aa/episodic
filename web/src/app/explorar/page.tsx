import type { Metadata } from "next";
import ExplorarPage from "./ExplorarPageClient";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}): Promise<Metadata> {
  const { tipo } = await searchParams;
  return { title: tipo === "filmes" ? "Explorar filmes" : "Explorar séries" };
}

export default ExplorarPage;
