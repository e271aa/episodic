"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getMovie, putMovie, updateMovie, type StoredMovie } from "@/lib/db";
import { juntarNomes } from "@/lib/existente";
import { getMovieDetails, type TmdbMovieDetails } from "@/lib/tmdb";
import { enrichMovie } from "@/lib/metadata";
import { pushUndo } from "@/lib/undo";
import AddToListButton from "@/components/AddToListButton";
import Poster from "@/components/Poster";
import StreamingBadges from "@/components/StreamingBadges";
import BotaoVoltar from "@/components/BotaoVoltar";
import { Bone, DetailHeaderBone } from "@/components/Skeleton";
import { ArrowLeftIcon, CheckIcon } from "@/components/icons";
import { porExtenso } from "@/lib/datas";

/**
 * `dateIsExact` false = só sabemos o ano (registos em massa do TV Time, ou
 * uma data corrigida à mão porque a pessoa só se lembra do ano). Mostrar
 * "1 de julho de 2024" nesses casos seria inventar um dia que ninguém disse.
 */
function formatWatchedDate(iso: string, exact: boolean): string {
  return exact ? porExtenso(iso) : `${new Date(iso).getFullYear()}`;
}

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
  const [aProcurar, setAProcurar] = useState(false);
  /**
   * O detalhe não veio e já não vem.
   *
   * O `catch` em baixo engolia a falha em silêncio e a página ficava a dizer
   * "A carregar sinopse…" **para sempre** — medido com a rede cortada. Um
   * estado de carregamento sem estado terminal de falha é uma promessa que
   * nunca se cumpre.
   */
  const [detalheFalhou, setDetalheFalhou] = useState(false);

  useEffect(() => {
    void (async () => {
      const stored = await getMovie(key);
      setMovie(stored ?? null);
      if (!stored) return;

      let tmdbId = stored.tmdbId;
      if (!tmdbId) {
        // A pessoa abriu esta página à espera de ver o filme — vale a pena
        // tentar mesmo que uma tentativa anterior tenha falhado. O `refresh`
        // ignora a "lembrança" de 24h que a Biblioteca usa para não martelar
        // a TMDB com centenas de filmes de uma vez: aqui é só um filme, e é
        // um pedido explícito de quem está a olhar para ele agora.
        setAProcurar(true);
        const patch = await enrichMovie(stored, true);
        setAProcurar(false);
        if (patch) {
          const comNomes = { ...patch, aliases: juntarNomes(stored.aliases, patch.aliases) };
          await updateMovie(key, comNomes);
          tmdbId = patch.tmdbId;
          setMovie((m) => (m ? { ...m, ...comNomes } : m));
        }
      }

      // Pedidos sempre os detalhes completos (sinopse, género, duração) —
      // não fazem parte do enriquecimento em massa por serem raramente vistos.
      if (tmdbId) {
        try {
          const full = await getMovieDetails(tmdbId);
          setDetails(full);
          if (!stored.posterPath && full.poster_path) {
            await updateMovie(key, { posterPath: full.poster_path });
            setMovie((m) => (m ? { ...m, posterPath: full.poster_path } : m));
          }
        } catch {
          // sem ligação ou filme removido do TMDB — fica só com os dados locais,
          // mas a página tem de o DIZER em vez de fingir que ainda está a vir
          setDetalheFalhou(true);
        }
      }
    })();
  }, [key]);

  if (movie === undefined) {
    return (
      <main className="mx-auto w-full max-w-2xl">
        <DetailHeaderBone />
        <div className="px-4">
          <Bone className="mt-4 h-11 w-28 rounded-full" />
          <Bone className="mt-5 h-4 w-full rounded" />
          <Bone className="mt-2 h-4 w-5/6 rounded" />
          <Bone className="mt-2 h-4 w-2/3 rounded" />
        </div>
      </main>
    );
  }

  if (movie === null) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-dim">Filme não encontrado.</p>
        <BotaoVoltar
          label="Voltar aos filmes"
          fallback="/library?tipo=filmes"
          className="mt-4 inline-block cursor-pointer text-ink underline"
        >
          Voltar aos filmes
        </BotaoVoltar>
      </main>
    );
  }

  const backdropPath = details?.backdrop_path ?? null;
  const posterPath = movie.posterPath ?? null;
  const year = (details?.release_date ?? movie.releaseDate)?.slice(0, 4);
  const runtime = formatRuntime(details?.runtime ?? null);
  const metaBits = [year, runtime, details?.genres.map((g) => g.name).join(" · ")].filter(
    Boolean,
  );

  const markWatched = async () => {
    const watchedAt = new Date().toISOString();
    await putMovie({ ...movie, watchedAt });
    setMovie((m) => (m ? { ...m, watchedAt } : m));
    pushUndo({
      label: "Filme marcado como visto",
      detail: movie.name,
      undo: async () => {
        await putMovie({ ...movie, watchedAt: null });
        setMovie((m) => (m ? { ...m, watchedAt: null } : m));
      },
    });
  };

  // Marcar era para sempre: depois de o aviso passar, nem desmarcar nem
  // corrigir (Ronda 12, 5b.4). Desmarcar devolve-o à lista para ver.
  const desmarcar = async () => {
    const antes = { watchedAt: movie.watchedAt, dateIsExact: movie.dateIsExact };
    await putMovie({ ...movie, watchedAt: null });
    setMovie((m) => (m ? { ...m, watchedAt: null } : m));
    pushUndo({
      label: "Filme desmarcado",
      detail: movie.name,
      undo: async () => {
        await putMovie({ ...movie, ...antes });
        setMovie((m) => (m ? { ...m, ...antes } : m));
      },
    });
  };

  return (
    <main className="mx-auto w-full max-w-2xl pb-[calc(var(--dock-h)+2rem)]">
      <div className="relative h-44 sm:h-56">
        {backdropPath ? (
          <>
            <Poster
              path={backdropPath}
              alt=""
              size="w780"
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-tube via-tube/40 to-transparent" />
          </>
        ) : (
          <div className="h-full w-full bg-gradient-to-r from-raised to-panel" />
        )}
        <div className="bars absolute inset-x-0 top-0 h-[3px]" />
        {/* botão redondo, igual ao do Detalhe de série — antes era uma
            pílula de texto "← Filmes", a única sobrevivente desse desenho */}
        <BotaoVoltar
          label="Voltar aos filmes"
          fallback="/library?tipo=filmes"
          className="absolute left-4 top-4 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-tube/60 text-ink backdrop-blur transition active:scale-90"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </BotaoVoltar>
      </div>

      {/* relative: sem isto, o gradiente absoluto da subcapa pinta por cima do poster */}
      <div className="relative px-4">
        <div className="-mt-10 flex items-end gap-4">
          {posterPath ? (
            <div className="relative aspect-2/3 w-24 shrink-0 overflow-hidden rounded-xl shadow-lg">
              <Poster path={posterPath} alt={movie.name} fill sizes="96px" priority className="object-cover" />
            </div>
          ) : aProcurar ? (
            // A tentar encontrar a capa agora — um retângulo cinzento parado
            // aqui lia-se como "sem capa", quando na verdade está a chegar.
            <Bone className="h-36 w-24 shrink-0 rounded-xl shadow-lg" />
          ) : (
            <div className="flex h-36 w-24 shrink-0 items-center justify-center rounded-xl bg-raised p-2 text-center font-display text-[0.9375rem] font-bold text-dim shadow-lg">
              {movie.name}
            </div>
          )}
          <div className="min-w-0 flex-1 pb-1">
            <h1 className="font-display text-2xl font-bold leading-tight [font-stretch:110%]">{movie.name}</h1>
            {metaBits.length > 0 && (
              <p className="ep-code mt-1 truncate text-xs text-dim">{metaBits.join("  ·  ")}</p>
            )}
            <p className="ep-code mt-1 text-sm text-dim">
              {movie.watchedAt
                ? movie.dateIsExact
                  ? `Visto a ${formatWatchedDate(movie.watchedAt, true)}`
                  : `Visto em ${formatWatchedDate(movie.watchedAt, false)}`
                : "Na lista para ver"}
            </p>
          </div>
        </div>

        {movie.watchedAt && (
          <button
            onClick={() => void desmarcar()}
            className="mt-4 flex min-h-11 w-full cursor-pointer items-center justify-center rounded-full border border-line text-[0.9375rem] font-semibold text-dim transition hover:border-ink/40 hover:text-ink active:scale-[0.99]"
          >
            Desmarcar como visto
          </button>
        )}

        {!movie.watchedAt && (
          <button
            onClick={() => void markWatched()}
            className="mt-4 flex w-full cursor-pointer items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-left text-tube transition hover:brightness-110 active:scale-[0.99]"
          >
            <CheckIcon className="h-6 w-6 shrink-0" />
            <span className="text-[0.9375rem] font-semibold">Marcar como visto</span>
          </button>
        )}

        <div className="mt-3">
          <AddToListButton kind="movie" refId={key} />
        </div>

        <StreamingBadges kind="movie" tmdbId={movie.tmdbId} />

        {details?.tagline && (
          <p className="mt-5 font-display italic text-dim">
            &ldquo;{details.tagline}&rdquo;
          </p>
        )}

        <section className="mt-4">
          {details?.overview ? (
            <p className="text-base leading-relaxed text-dim">{details.overview}</p>
          ) : aProcurar ? (
            <p className="text-[0.9375rem] text-dim">A procurar na TMDB…</p>
          ) : detalheFalhou ? (
            <p className="text-[0.9375rem] text-dim">
              Não deu para trazer a sinopse — sem ligação à internet.
            </p>
          ) : movie.tmdbId ? (
            <p className="text-[0.9375rem] text-dim">A carregar sinopse…</p>
          ) : (
            <p className="text-[0.9375rem] text-dim">
              Sem sinopse disponível — este filme não foi encontrado na TMDB.
            </p>
          )}
        </section>

        {movie.tmdbId && (
          <a
            href={`https://www.themoviedb.org/movie/${movie.tmdbId}`}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex min-h-11 cursor-pointer items-center text-[0.9375rem] text-ink hover:underline"
          >
            Ver na TMDB ↗
          </a>
        )}
      </div>
    </main>
  );
}
