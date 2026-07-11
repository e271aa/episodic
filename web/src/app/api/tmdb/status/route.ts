import { NextResponse } from "next/server";

// Diz ao browser se o fornecedor TMDB está configurado (sem expor a chave).
export function GET() {
  return NextResponse.json({ available: Boolean(process.env.TMDB_API_KEY) });
}
