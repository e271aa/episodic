"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getMovie, updateMovie, type StoredMovie } from "@/lib/db";
import { getMovieDetails, imageUrl, type TmdbMovieDetails } from "@/lib/tmdb";
import AddToListButton from "@/components/AddToListButton";

function formatRuntime(minutes: number | null): string | null {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export default function MoviePage() {
  const { key } = useParams<{ key: string }>();
  const [movie, setMovie] = useState<StoredMovie | null | undefined>(undefined);
  const [details, setDetails] = useState<TmdbMovieDetails | null>(null);

  useEffect(() => {
    void (async () => {
      const stored = await getMovie(key);
      setMovie(stored ?? null);
      if (!stored) return;

      // Filmes só têm tmdbId se já tiverem sido enriquecidos (aba Filmes);
      // aqui pedimos sempre os detalhes completos (sinopse, elenco de género,
      // duração) — não fazem parte do enriquecimento em massa por serem raramente vistos.
      if (stored.tmdbId) {
        try {
          const full = await getMovieDetails(stored.tmdbId);
          setDetails(full);
          if (!stored.posterPath && full.poster_path) {
            await updateMovie(key, { posterPath: full.poster_path });
            setMovie((m) => (m ? { ...m, posterPath: full.poster_path } : m));
          }
        } catch {
          // sem ligação ou filme removido do TMDB — fica só com os dados locais
        }
      }
    })();
  }, [key]);

  if (movie === undefined) {
    return (
      <main className="mx-auto w-full max-w-2xl">
        <div className="h-44 animate-pulse bg-panel sm:h-56" />
        <div className="space-y-3 px-4 pt-6">
          <div className="h-6 w-48 animate-pulse rounded-lg bg-panel" />
          <div className="h-4 w-32 animate-pulse rounded-lg bg-panel" />
        </div>
      </main>
    );
  }

  if (movie === null) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-dim">Filme não encontrado.</p>
        <Link href="/movies" className="mt-4 inline-block cursor-pointer text-ink underline">
          Voltar aos filmes
        </Link>
      </main>
    );
  }

  const backdrop = imageUrl(details?.backdrop_path ?? null, "w780");
  const poster = imageUrl(movie.posterPath, "w342");
  const year = (details?.release_date ?? movie.releaseDate)?.slice(0, 4);
  const runtime = formatRuntime(details?.runtime ?? null);
  const metaBits = [year, runtime, details?.genres.map((g) => g.name).join(" · ")].filter(
    Boolean,
  );

  return (
    <main className="mx-auto max-w-2xl pb-8">
      <div className="relative">
        {backdrop ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={backdrop} alt="" className="h-44 w-full object-cover sm:h-56" />
            <div className="absolute inset-0 bg-gradient-to-t from-tube via-tube/40 to-transparent" />
          </>
        ) : (
          <div className="h-28 w-full bg-gradient-to-r from-raised to-panel" />
        )}
        <div className="bars absolute inset-x-0 top-0 h-[3px]" />
        <Link
          href="/movies"
          className="absolute left-3 top-3 cursor-pointer rounded-full bg-black/50 px-3 py-1.5 text-sm text-white backdrop-blur"
        >
          ← Filmes
        </Link>
      </div>

      {/* relative: sem isto, o gradiente absoluto da subcapa pinta por cima do poster */}
      <div className="relative px-4">
        <div className="-mt-10 flex items-end gap-4">
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster} alt={movie.name} className="w-24 shrink-0 rounded-xl shadow-lg" />
          ) : (
            <div className="flex h-36 w-24 shrink-0 items-center justify-center rounded-xl bg-raised p-2 text-center font-display text-sm font-bold text-dim shadow-lg">
              {movie.name}
            </div>
          )}
          <div className="min-w-0 pb-1">
            <h1 className="font-display text-xl font-bold leading-tight">{movie.name}</h1>
            {metaBits.length > 0 && (
              <p className="ep-code mt-1 truncate text-xs text-dim">{metaBits.join("  ·  ")}</p>
            )}
            <p className="ep-code mt-1 text-sm text-dim">
              Visto em {movie.watchedAt.slice(0, 10)}
            </p>
          </div>
        </div>

        <div className="mt-3">
          <AddToListButton kind="movie" refId={key} />
        </div>

        {details?.tagline && (
          <p className="mt-5 font-display italic text-dim">
            &ldquo;{details.tagline}&rdquo;
          </p>
        )}

        <section className="mt-4">
          {details?.overview ? (
            <p className="text-sm leading-relaxed text-dim">{details.overview}</p>
          ) : movie.tmdbId ? (
            <p className="text-sm text-dim">A carregar sinopse…</p>
          ) : (
            <p className="text-sm text-dim">
              Sem sinopse disponível — este filme ainda não foi encontrado na TMDB.
            </p>
          )}
        </section>

        {movie.tmdbId && (
          <a
            href={`https://www.themoviedb.org/movie/${movie.tmdbId}`}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block cursor-pointer text-sm text-ink hover:underline"
          >
            Ver na TMDB ↗
          </a>
        )}
      </div>
    </main>
  );
}
