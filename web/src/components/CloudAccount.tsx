"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isCloudConfigured } from "@/lib/supabase";
import {
  getUser,
  onAuthChange,
  pullAndMerge,
  signInWithEmail,
  signOut,
  syncNow,
} from "@/lib/cloud";
import type { User } from "@supabase/supabase-js";

type Status = "idle" | "sending" | "sent" | "syncing" | "synced" | "error";

// Conta na cloud + sincronização entre dispositivos. Só aparece se o Supabase
// estiver configurado (NEXT_PUBLIC_SUPABASE_*). Chamada onSynced recarrega as
// estatísticas do perfil depois de trazer dados da cloud.
export default function CloudAccount({ onSynced }: { onSynced: () => void }) {
  const [user, setUser] = useState<User | null>(null);
  // Sem cloud configurada, não há nada a esperar → pronto de imediato.
  const [ready, setReady] = useState(() => !isCloudConfigured());
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const autoPulled = useRef(false);

  // Ao entrar (magic link ou sessão existente), traz os dados da cloud uma vez.
  const autoPull = useCallback(async () => {
    if (autoPulled.current) return;
    autoPulled.current = true;
    setStatus("syncing");
    try {
      const r = await pullAndMerge();
      setMessage(`${r.pulledShows} séries e ${r.pulledEpisodes} episódios da cloud.`);
      setStatus("synced");
      onSynced();
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : String(e));
    }
  }, [onSynced]);

  useEffect(() => {
    if (!isCloudConfigured()) return;
    void getUser().then((u) => {
      setUser(u);
      setReady(true);
      if (u) void autoPull();
    });
    return onAuthChange((u) => {
      setUser(u);
      if (u) void autoPull();
    });
  }, [autoPull]);

  const handleSignIn = useCallback(async () => {
    if (!email.trim()) return;
    setStatus("sending");
    setMessage("");
    const { error } = await signInWithEmail(email.trim());
    if (error) {
      setStatus("error");
      setMessage(error);
    } else {
      setStatus("sent");
      setMessage("Verifica o teu email e clica no link para entrar.");
    }
  }, [email]);

  const handleSync = useCallback(async () => {
    if (!user) return;
    setStatus("syncing");
    setMessage("");
    try {
      const r = await syncNow(user.id);
      setMessage(
        `Enviados ${r.pushedEpisodes} · trazidos ${r.pulledEpisodes} episódios.`,
      );
      setStatus("synced");
      onSynced();
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : String(e));
    }
  }, [user, onSynced]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    autoPulled.current = false;
    setUser(null);
    setStatus("idle");
    setMessage("");
  }, []);

  if (!ready) return null;

  // Cloud não configurada — mostra uma nota discreta em vez de esconder tudo,
  // para o utilizador saber que a opção existe.
  if (!isCloudConfigured()) {
    return (
      <section className="mt-8">
        <h2 className="font-display text-lg font-semibold">Conta &amp; sync</h2>
        <p className="mt-2 rounded-2xl border border-line bg-panel p-4 text-sm text-dim">
          A sincronização na cloud ainda não está ligada. Quando estiver, poderás
          entrar com o email e ter a tua biblioteca em todos os dispositivos.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8">
      <h2 className="font-display text-lg font-semibold">Conta &amp; sync</h2>

      {user ? (
        <div className="mt-3 rounded-2xl border border-line bg-panel p-4">
          <p className="text-sm">
            Sessão iniciada como{" "}
            <span className="font-medium text-ink">{user.email}</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => void handleSync()}
              disabled={status === "syncing"}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-signal px-5 py-2 text-sm font-semibold text-on-signal transition hover:brightness-110 active:scale-95 disabled:opacity-50"
            >
              {status === "syncing" && (
                <span className="spinner h-4 w-4 rounded-full border-2 border-on-signal/30 border-t-on-signal" />
              )}
              {status === "syncing" ? "A sincronizar…" : "Sincronizar agora"}
            </button>
            <button
              onClick={() => void handleSignOut()}
              className="min-h-11 cursor-pointer rounded-full border border-line px-5 py-2 text-sm font-medium text-dim transition hover:bg-raised"
            >
              Terminar sessão
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-2xl border border-line bg-panel p-4">
          <p className="text-sm text-dim">
            Entra com o teu email para guardar a biblioteca na cloud e tê-la em
            todos os dispositivos. Sem passwords — recebes um link mágico.
          </p>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSignIn();
            }}
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="o-teu@email.com"
              autoComplete="email"
              className="min-h-11 flex-1 rounded-full border border-line bg-night px-5 py-2 text-sm outline-none transition-colors focus:border-signal"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-signal px-5 py-2 text-sm font-semibold text-on-signal transition hover:brightness-110 active:scale-95 disabled:opacity-50"
            >
              {status === "sending" && (
                <span className="spinner h-4 w-4 rounded-full border-2 border-on-signal/30 border-t-on-signal" />
              )}
              Entrar
            </button>
          </form>
        </div>
      )}

      {message && (
        <p
          className={`mt-2 text-xs ${status === "error" ? "text-danger" : "text-dim"}`}
        >
          {message}
        </p>
      )}
    </section>
  );
}
