"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isCloudConfigured } from "@/lib/supabase";
import {
  getUser,
  onAuthChange,
  pullAndMerge,
  setPassword,
  signInWithEmail,
  signInWithPassword,
  signOut,
  syncNow,
  verifyEmailCode,
} from "@/lib/cloud";
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
  const [email, setEmail] = useState("");
  const [password, setPasswordInput] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [code, setCode] = useState("");
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

  // Entrada principal: com password se estiver preenchida; caso contrário
  // envia o email com código/link (fallback passwordless).
  const handlePasswordSignIn = useCallback(async () => {
    if (!email.trim() || !password) return;
    setStatus("verifying");
    setMessage("");
    const { error } = await signInWithPassword(email.trim(), password);
    if (error) {
      setStatus("error");
      setMessage(
        /invalid login credentials/i.test(error)
          ? "Email ou password errados."
          : error,
      );
    } else {
      setPasswordInput("");
      setStatus("idle");
      setMessage("");
    }
  }, [email, password]);

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

  const handleSignIn = useCallback(async () => {
    if (!email.trim()) return;
    setStatus("sending");
    setMessage("");
    const { error } = await signInWithEmail(email.trim());
    if (error) {
      setStatus("error");
      setMessage(
        /rate limit/i.test(error)
          ? "Limite de emails atingido — tenta de novo dentro de uma hora."
          : error,
      );
    } else {
      setStatus("sent");
      setMessage(
        "Enviámos-te um email: introduz aqui o código de 6 dígitos (ou clica no link).",
      );
    }
  }, [email]);

  // Entrada por código — essencial na PWA instalada, onde clicar no link do
  // email abriria o Safari em vez da app (a sessão ficaria no sítio errado).
  const handleVerifyCode = useCallback(async () => {
    if (code.trim().length < 6) return;
    setStatus("verifying");
    setMessage("");
    const { error } = await verifyEmailCode(email.trim(), code);
    if (error) {
      setStatus("error");
      setMessage(
        /expired|invalid/i.test(error)
          ? "Código inválido ou expirado — pede um novo email."
          : error,
      );
    } else {
      // onAuthChange trata do resto (define o utilizador e faz o pull)
      setCode("");
      setStatus("idle");
      setMessage("");
    }
  }, [email, code]);

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
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-ink px-5 py-2 text-sm font-semibold text-tube transition hover:brightness-110 active:scale-95 disabled:opacity-50"
            >
              {status === "syncing" && (
                <span className="spinner h-4 w-4 rounded-full border-2 border-tube/30 border-t-tube" />
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
                className="min-h-11 flex-1 rounded-full border border-line bg-tube px-5 py-2 text-sm outline-none transition-colors focus:border-ink"
              />
              <button
                type="submit"
                disabled={status === "verifying" || newPassword.length < 8}
                className="min-h-11 cursor-pointer rounded-full border border-line px-5 py-2 text-sm font-medium text-dim transition hover:bg-raised disabled:opacity-50"
              >
                Guardar
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="mt-3 rounded-2xl border border-line bg-panel p-4">
          <p className="text-sm text-dim">
            Entra com o teu email para guardar a biblioteca na cloud e tê-la em
            todos os dispositivos.
          </p>
          <form
            className="mt-3 flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void handlePasswordSignIn();
            }}
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="o-teu@email.com"
              autoComplete="email"
              className="min-h-11 rounded-full border border-line bg-tube px-5 py-2 text-sm outline-none transition-colors focus:border-ink"
            />
            <div className="flex gap-2">
              <input
                type="password"
                value={password}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="password"
                autoComplete="current-password"
                className="min-h-11 flex-1 rounded-full border border-line bg-tube px-5 py-2 text-sm outline-none transition-colors focus:border-ink"
              />
              <button
                type="submit"
                disabled={status === "verifying" || !email.trim() || !password}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-ink px-5 py-2 text-sm font-semibold text-tube transition hover:brightness-110 active:scale-95 disabled:opacity-50"
              >
                {status === "verifying" && (
                  <span className="spinner h-4 w-4 rounded-full border-2 border-tube/30 border-t-tube" />
                )}
                Entrar
              </button>
            </div>
            <button
              type="button"
              onClick={() => void handleSignIn()}
              disabled={status === "sending" || !email.trim()}
              className="cursor-pointer self-start px-2 py-1 text-xs font-medium text-ink hover:underline disabled:opacity-50"
            >
              {status === "sending"
                ? "A enviar…"
                : "Sem password? Recebe um código por email"}
            </button>
          </form>

          {(status === "sent" || status === "verifying") && (
            <form
              className="page-enter mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void handleVerifyCode();
              }}
            >
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="Código de 6 dígitos"
                className="ep-code min-h-11 flex-1 rounded-full border border-line bg-tube px-5 py-2 text-sm tracking-[0.3em] outline-none transition-colors focus:border-ink"
              />
              <button
                type="submit"
                disabled={status === "verifying" || code.length < 6}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-ink px-5 py-2 text-sm font-semibold text-tube transition hover:brightness-110 active:scale-95 disabled:opacity-50"
              >
                {status === "verifying" && (
                  <span className="spinner h-4 w-4 rounded-full border-2 border-tube/30 border-t-tube" />
                )}
                Validar
              </button>
            </form>
          )}
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
