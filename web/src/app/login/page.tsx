"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isCloudConfigured } from "@/lib/supabase";
import { signInWithEmail, signInWithPassword, verifyEmailCode } from "@/lib/cloud";
import { TvIcon } from "@/components/icons";

type Modo = "password" | "codigo";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");

  const [modo, setModo] = useState<Modo>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [codigo, setCodigo] = useState("");
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Só aceitamos destinos internos — um `next` externo seria um redirect aberto.
  const destino = next && next.startsWith("/") && !next.startsWith("//") ? next : "/series";

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErro(null);
    const { error } = await signInWithPassword(email.trim(), password);
    if (error) {
      setErro(error);
      setBusy(false);
      return;
    }
    router.replace(destino);
    router.refresh();
  };

  const pedirCodigo = async () => {
    if (!email.trim()) {
      setErro("Escreve o teu email primeiro.");
      return;
    }
    setBusy(true);
    setErro(null);
    const { error } = await signInWithEmail(email.trim());
    if (error) setErro(error);
    else setCodigoEnviado(true);
    setBusy(false);
  };

  const confirmarCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErro(null);
    const { error } = await verifyEmailCode(email.trim(), codigo.trim());
    if (error) {
      setErro(error);
      setBusy(false);
      return;
    }
    router.replace(destino);
    router.refresh();
  };

  if (!isCloudConfigured()) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <p className="font-display text-lg font-bold">Cloud não configurada</p>
        <p className="mt-2 max-w-xs text-[15px] text-dim">
          A app está a correr só em modo local. Não há conta para iniciar sessão.
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col justify-center px-5">
      <div className="mx-auto w-full max-w-sm">
        <div className="bars mx-auto h-14 w-14 rounded-2xl" aria-hidden />
        <h1 className="mt-5 text-center font-display text-3xl font-bold [font-stretch:110%]">
          Episodic
        </h1>
        <p className="mt-1.5 text-center text-[15px] text-dim">
          Entra para teres a tua biblioteca em todos os dispositivos.
        </p>

        {modo === "password" ? (
          <form onSubmit={entrar} className="mt-8 flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-dim">Email</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="o-teu@email.com"
                className="min-h-12 rounded-2xl border border-line bg-panel px-4 outline-none transition-colors focus:border-ink"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-dim">Palavra-passe</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="min-h-12 rounded-2xl border border-line bg-panel px-4 outline-none transition-colors focus:border-ink"
              />
            </label>

            {erro && (
              <p className="page-enter text-[15px] text-danger" role="alert">
                {erro}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-2 flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-ink font-semibold text-tube transition hover:brightness-110 disabled:opacity-50"
            >
              {busy && (
                <span className="spinner h-4 w-4 rounded-full border-2 border-tube/30 border-t-tube" />
              )}
              {busy ? "A entrar…" : "Entrar"}
            </button>

            <button
              type="button"
              onClick={() => {
                setModo("codigo");
                setErro(null);
              }}
              className="mt-1 min-h-11 cursor-pointer text-[15px] text-dim transition hover:text-ink"
            >
              Não tenho palavra-passe — enviem-me um código
            </button>
          </form>
        ) : (
          <form onSubmit={confirmarCodigo} className="mt-8 flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-dim">Email</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="o-teu@email.com"
                className="min-h-12 rounded-2xl border border-line bg-panel px-4 outline-none transition-colors focus:border-ink"
              />
            </label>

            {codigoEnviado && (
              <label className="page-enter flex flex-col gap-1.5">
                <span className="text-xs font-medium text-dim">Código recebido por email</span>
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="000000"
                  className="ep-code min-h-12 rounded-2xl border border-line bg-panel px-4 text-lg tracking-[0.3em] outline-none transition-colors focus:border-ink"
                />
              </label>
            )}

            {erro && (
              <p className="page-enter text-[15px] text-danger" role="alert">
                {erro}
              </p>
            )}

            {codigoEnviado ? (
              <button
                type="submit"
                disabled={busy}
                className="mt-2 flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-ink font-semibold text-tube transition hover:brightness-110 disabled:opacity-50"
              >
                {busy && (
                  <span className="spinner h-4 w-4 rounded-full border-2 border-tube/30 border-t-tube" />
                )}
                {busy ? "A confirmar…" : "Confirmar código"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void pedirCodigo()}
                disabled={busy}
                className="mt-2 flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-ink font-semibold text-tube transition hover:brightness-110 disabled:opacity-50"
              >
                {busy && (
                  <span className="spinner h-4 w-4 rounded-full border-2 border-tube/30 border-t-tube" />
                )}
                {busy ? "A enviar…" : "Enviar código"}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setModo("password");
                setCodigoEnviado(false);
                setErro(null);
              }}
              className="mt-1 min-h-11 cursor-pointer text-[15px] text-dim transition hover:text-ink"
            >
              Voltar à palavra-passe
            </button>
          </form>
        )}

        <p className="mt-10 flex items-center justify-center gap-2 text-center text-xs text-faint">
          <TvIcon className="h-3.5 w-3.5" aria-hidden />O teu registo de séries
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center">
          <div className="bars h-14 w-14 animate-pulse rounded-2xl" aria-hidden />
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
