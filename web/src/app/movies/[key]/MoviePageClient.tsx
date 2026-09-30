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
import { CheckIcon } from "@/components/icons";
import { ChevronLeft } from "lucide-react";
import Acao from "@/components/mira/Acao";
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
        <p className="text-label-2">Filme não encontrado.</p>
        <BotaoVoltar
          label="Voltar aos filmes"
          fallback="/library?tipo=filmes"
          className="mt-4 inline-block cursor-pointer text-label underline"
        >
          Voltar aos filmes
        </BotaoVoltar>
      </main>
    );
  }

  const backdropPath = details?.backdrop_path ?? null;
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
    <main className="mx-auto w-full max-w-2xl pb-6">
      {/* O herói da Mira, como o da série: a arte de ponta a ponta com o
          degradê para o fundo, o círculo de vidro de recuar, e o título onde
          o degradê já é fundo — nada de texto sobre a arte. */}
      <div className="relative">
        <div className="relative h-[min(290px,40vh)] overflow-hidden bg-group">
          {backdropPath && (
            <Poster path={backdropPath} alt="" size="w780" fill priority sizes="100vw" className="object-cover" />
          )}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, var(--m-heroi-topo) 0, transparent 25%, transparent 55%, var(--color-bg) 100%)",
            }}
          />
        </div>
        <BotaoVoltar
          label="Voltar aos filmes"
          fallback="/library?tipo=filmes"
          className="vidro absolute left-4 top-[max(12px,env(safe-area-inset-top))] flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-label transition-transform duration-100 active:scale-[0.97]"
        >
          <ChevronLeft aria-hidden className="h-5 w-5" strokeWidth={2.4} />
        </BotaoVoltar>

        <div className="relative -mt-14 flex flex-col gap-1 px-5">
          {/* `break-words`: a 150% "Redemption" media 231px numa coluna de 174 e
              empurrava o ecrã para os 423px (Ronda 12, F2) */}
          <h1 className="line-clamp-3 text-[2rem] leading-[1.1] font-bold break-words text-label">{movie.name}</h1>
          <p className="text-[0.88rem] text-label-2">
            {metaBits.join(" · ")}
            {metaBits.length > 0 && " · "}
            <span>
              {movie.watchedAt
                ? movie.dateIsExact
                  ? `Visto a ${formatWatchedDate(movie.watchedAt, true)}`
                  : `Visto em ${formatWatchedDate(movie.watchedAt, false)}`
                : "Na lista para ver"}
            </span>
          </p>
        </div>
      </div>

      <div className="px-4">
        {/* Uma só cápsula preenchida: marcar. Já visto, desmarcar é secundário. */}
        {movie.watchedAt ? (
          <Acao tipo="secundaria" onClick={() => void desmarcar()} className="mt-4 w-full">
            Desmarcar como visto
          </Acao>
        ) : (
          <Acao
            onClick={() => void markWatched()}
            className="mt-4 w-full"
            icone={<CheckIcon aria-hidden className="h-5 w-5 shrink-0" />}
          >
            Marcar como visto
          </Acao>
        )}

        <div className="mt-3">
          <AddToListButton kind="movie" refId={key} />
        </div>

        <StreamingBadges kind="movie" tmdbId={movie.tmdbId} />

        {details?.tagline && (
          <p className="mt-5 italic text-label-2">&ldquo;{details.tagline}&rdquo;</p>
        )}

        <section className="mt-4">
          {details?.overview ? (
            <p className="text-base leading-relaxed text-label-2">{details.overview}</p>
          ) : aProcurar ? (
            <p className="text-[0.88rem] text-label-2">A procurar na TMDB…</p>
          ) : detalheFalhou ? (
            <p className="text-[0.88rem] text-label-2">
              Não deu para trazer a sinopse — sem ligação à internet.
            </p>
          ) : movie.tmdbId ? (
            <p className="text-[0.88rem] text-label-2">A carregar sinopse…</p>
          ) : (
            <p className="text-[0.88rem] text-label-2">
              Sem sinopse disponível — este filme não foi encontrado na TMDB.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
