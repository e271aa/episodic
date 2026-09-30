"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getShows, kvGet, kvSet } from "@/lib/db";
import { getUser, onAuthChange, pullAndMerge, type PullProgress } from "@/lib/cloud";
import { isCloudConfigured } from "@/lib/supabase";
import { curarNumeracao } from "@/lib/numeracao";

/** Marca que este dispositivo já trouxe a biblioteca da cloud pelo menos uma vez. */
const DONE_KEY = "cloud:primeiro-pull";

type Estado =
  | { fase: "inativo" }
  | { fase: "a-trazer"; p: PullProgress }
  | { fase: "erro" };

/**
 * O primeiro arranque num dispositivo novo. Sem isto, entrar na conta deixava
 * a app vazia até alguém descobrir o "Sincronizar agora" no Perfil — que foi
 * exatamente o que aconteceu ao instalar a PWA no iPhone.
 *
 * Corre uma vez por dispositivo: com sessão iniciada e biblioteca local vazia,
 * traz tudo e mostra a contagem a subir, para se perceber que está a trabalhar.
 *
 * Tenta ao abrir a app **e quando a sessão começa**. Só ao abrir não chegava
 * (Ronda 12, Fase 8, visto no Safari do iOS): num dispositivo novo a app abre
 * no login, ainda sem sessão, e desiste; depois de entrar, o login navega
 * dentro da app, sem recarregar, e ninguém voltava a chamar isto — a casa
 * ficava no "primeiro uso" até alguém recarregar a página.
 */
export default function FirstSync() {
  const [estado, setEstado] = useState<Estado>({ fase: "inativo" });
  // o Supabase anuncia a sessão inicial ao subscrever, ao mesmo tempo que o
  // arranque — sem isto, a biblioteca descia duas vezes em paralelo
  const aCorrer = useRef(false);

  const correr = useCallback(async () => {
    if (aCorrer.current) return;
    aCorrer.current = true;
    try {
      if (!isCloudConfigured()) return;
      if (await kvGet<boolean>(DONE_KEY)) return;

      const user = await getUser();
      if (!user) return;

      // Já há biblioteca local (ex.: importação do TV Time antes de criar conta):
      // não é preciso ecrã nenhum, o sync normal trata do resto em segundo plano.
      const locais = await getShows();
      if (locais.length > 0) {
        await kvSet(DONE_KEY, true);
        return;
      }

      setEstado({
        fase: "a-trazer",
        p: { shows: 0, episodes: 0, movies: 0, merging: false },
      });
      try {
        await pullAndMerge((p) => setEstado({ fase: "a-trazer", p }));
        // o que veio de uma cloud antiga pode vir sem numeração — antes de a
        // app ler uma única temporada, devolve-a às séries que a perderam
        await curarNumeracao().catch(() => 0);
        await kvSet(DONE_KEY, true);
        // recarrega para os ecrãs lerem o IndexedDB já cheio
        window.location.reload();
      } catch {
        setEstado({ fase: "erro" });
      }
    } finally {
      aCorrer.current = false;
    }
  }, []);

  useEffect(() => {
    const raf = requestAnimationFrame(() => void correr());
    const parar = onAuthChange((user) => {
      if (user) void correr();
    });
    return () => {
      cancelAnimationFrame(raf);
      parar();
    };
  }, [correr]);

  if (estado.fase === "inativo") return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-tube px-8 text-center">
      <div className="spinner h-8 w-8 rounded-full border-[3px] border-label/20 border-t-label" aria-hidden />

      {estado.fase === "erro" ? (
        <>
          <p className="mt-6 font-display text-lg font-bold">Não deu para trazer tudo</p>
          <p className="mt-1.5 max-w-xs text-[0.9375rem] text-dim">
            Verifica a ligação. Podes tentar outra vez, ou continuar e sincronizar
            depois pelo Perfil.
          </p>
          <div className="mt-6 flex gap-3">
            <button
              onClick={() => void correr()}
              className="min-h-11 cursor-pointer rounded-full bg-acao px-6 text-[0.9375rem] font-semibold text-on-label transition-transform active:scale-[0.97]"
            >
              Tentar outra vez
            </button>
            <button
              onClick={() => setEstado({ fase: "inativo" })}
              className="min-h-11 cursor-pointer rounded-full border border-line px-6 text-[0.9375rem] font-semibold text-dim transition hover:border-ink hover:text-ink"
            >
              Continuar
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-6 font-display text-lg font-bold">
            {estado.p.merging ? "Quase pronto…" : "A carregar a tua biblioteca…"}
          </p>
          <p className="ep-code mt-2 text-sm text-dim" aria-live="polite">
            {estado.p.shows} séries · {estado.p.episodes.toLocaleString("pt-PT")} episódios
            {estado.p.movies > 0 ? ` · ${estado.p.movies} filmes` : ""}
          </p>
          <p className="mt-6 max-w-xs text-xs text-faint">
            Só acontece uma vez neste dispositivo. Depois disto a app abre
            instantânea, mesmo sem internet.
          </p>
        </>
      )}
    </div>
  );
}
