"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { isCloudConfigured } from "@/lib/supabase";
import {
  getUser,
  onAuthChange,
  pullAndMerge,
  setPassword,
  signOut,
  syncNow,
} from "@/lib/cloud";
import { onSyncStateChange, type SyncState } from "@/lib/autosync";
import type { User } from "@supabase/supabase-js";

type Status =
  | "idle"
  | "sending"
  | "sent"
  | "verifying"
  | "syncing"
  | "synced"
  | "error";

// Conta na cloud + sincronização entre dispositivos. Só aparece se o Supabase
// estiver configurado (NEXT_PUBLIC_SUPABASE_*). Chamada onSynced recarrega as
// estatísticas do perfil depois de trazer dados da cloud.
export default function CloudAccount({ onSynced }: { onSynced: () => void }) {
  const [user, setUser] = useState<User | null>(null);
  // Sem cloud configurada, não há nada a esperar → pronto de imediato.
  const [ready, setReady] = useState(() => !isCloudConfigured());
  const [newPassword, setNewPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [autoSync, setAutoSync] = useState<{ state: SyncState; pending: number }>({
    state: "idle",
    pending: 0,
  });
  const autoPulled = useRef(false);

  // Estado do envio automático — as marcações sobem sozinhas, isto só informa
  useEffect(
    () => onSyncStateChange((state, pending) => setAutoSync({ state, pending })),
    [],
  );

  const autoSyncLabel =
    autoSync.state === "syncing"
      ? "A enviar alterações…"
      : autoSync.state === "offline"
        ? `Sem ligação — ${autoSync.pending} por enviar`
        : autoSync.state === "error"
          ? `${autoSync.pending} por enviar — nova tentativa em breve`
          : autoSync.pending > 0
            ? `${autoSync.pending} alteração(ões) por enviar`
            : "Alterações sobem automaticamente";

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


  const handleSetPassword = useCallback(async () => {
    if (newPassword.length < 8) {
      setStatus("error");
      setMessage("A password precisa de pelo menos 8 caracteres.");
      return;
    }
    setStatus("verifying");
    setMessage("");
    const { error } = await setPassword(newPassword);
    if (error) {
      setStatus("error");
      setMessage(error);
    } else {
      setNewPassword("");
      setStatus("idle");
      setMessage("Password guardada — já podes entrar com ela em qualquer dispositivo.");
    }
  }, [newPassword]);



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
        <p className="mt-2 rounded-2xl border border-line bg-panel p-4 text-[15px] text-dim">
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
          <p className="text-[15px]">
            Sessão iniciada como{" "}
            <span className="font-medium text-ink">{user.email}</span>
          </p>
          <p className="ep-code mt-1 text-xs text-faint">{autoSyncLabel}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => void handleSync()}
              disabled={status === "syncing"}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-ink px-5 py-2 text-[15px] font-semibold text-tube transition hover:brightness-110 active:scale-95 disabled:opacity-50"
            >
              {status === "syncing" && (
                <span className="spinner h-4 w-4 rounded-full border-2 border-tube/30 border-t-tube" />
              )}
              {status === "syncing" ? "A sincronizar…" : "Sincronizar agora"}
            </button>
            <button
              onClick={() => void handleSignOut()}
              className="min-h-11 cursor-pointer rounded-full border border-line px-5 py-2 text-[15px] font-medium text-dim transition hover:bg-raised"
            >
              Terminar sessão
            </button>
          </div>

          {/* Password opcional: entra noutros dispositivos sem depender de
              emails (o link/código continua disponível como alternativa). */}
          <form
            className="mt-4 border-t border-line pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSetPassword();
            }}
          >
            <p className="text-xs text-dim">
              Define uma password para entrares noutros dispositivos sem esperar
              por emails (ideal no telemóvel).
            </p>
            <div className="mt-2 flex gap-2">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="nova password (mín. 8)"
                autoComplete="new-password"
                minLength={8}
                className="min-h-11 flex-1 rounded-full border border-line bg-tube px-5 py-2 text-[15px] outline-none transition-colors focus:border-ink"
              />
              <button
                type="submit"
                disabled={status === "verifying" || newPassword.length < 8}
                className="min-h-11 cursor-pointer rounded-full border border-line px-5 py-2 text-[15px] font-medium text-dim transition hover:bg-raised disabled:opacity-50"
              >
                Guardar
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="mt-3 rounded-2xl border border-line bg-panel p-4">
          <p className="text-[15px] text-dim">
            Sem sessão iniciada neste dispositivo.
          </p>
          <Link
            href="/login"
            className="mt-3 inline-flex min-h-11 cursor-pointer items-center rounded-full bg-ink px-5 text-[15px] font-semibold text-tube transition hover:brightness-110"
          >
            Entrar
          </Link>
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
