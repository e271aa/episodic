import { NextResponse, type NextRequest } from "next/server";

const TMDB_BASE = "https://api.themoviedb.org/3";

// Só expomos os endpoints de leitura de que a app precisa.
const ALLOWED =
  /^(find\/\d+|search\/(tv|movie|multi)|tv\/\d+(\/season\/\d+)?|movie\/\d+|(tv|movie)\/\d+\/watch\/providers|trending\/(tv|movie)\/(day|week)|(tv|movie)\/\d+\/recommendations|discover\/(tv|movie)|genre\/(tv|movie)\/list|tv\/\d+\/aggregate_credits)$/;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "tmdb-key-missing", message: "Define TMDB_API_KEY em web/.env.local" },
      { status: 503 },
    );
  }

  const { path } = await params;
  const joined = path.join("/");
  if (!ALLOWED.test(joined)) {
    return NextResponse.json({ error: "endpoint não permitido" }, { status: 400 });
  }

  const url = new URL(`${TMDB_BASE}/${joined}`);
  request.nextUrl.searchParams.forEach((value, key) => url.searchParams.set(key, value));
  url.searchParams.set("api_key", apiKey);
  if (!url.searchParams.has("language")) url.searchParams.set("language", "pt-PT");

  const response = await fetch(url, {
    // metadados de séries mudam devagar; cache de um dia no servidor
    next: { revalidate: 60 * 60 * 24 },
  });
  const body = await response.json();
  return NextResponse.json(body, { status: response.status });
}
