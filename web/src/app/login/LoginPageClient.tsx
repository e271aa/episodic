"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isCloudConfigured } from "@/lib/supabase";
import { signInWithEmail, signInWithPassword, verifyEmailCode } from "@/lib/cloud";
import { TvIcon } from "@/components/icons";
import Palavra from "@/components/mira/Palavra";
import { RECUAR, IconeRecuar } from "@/components/CabecalhoEcra";
import Acao from "@/components/mira/Acao";
import BotaoVoltar from "@/components/BotaoVoltar";

type Modo = "password" | "codigo";

/**
 * O Entrar não tinha saída nenhuma: sem dock (escondida de propósito) e sem
 * recuar, quem chegasse aqui por engano — ou mudasse de ideias a meio —
 * ficava preso (Ronda 12, achado #14 da 5b.4). `useVoltar` desfaz a
 * navegação quando há uma para desfazer; sem histórico dentro da app, sobe
 * para `/series` — que, com sessão nenhuma e cloud configurada, volta a
 * mandar para aqui. Não é um erro: é a verdade da app, não há mais nada
 * para ver sem entrar.
 */
function BotaoDeSair() {
  return (
    <BotaoVoltar
      label="Voltar"
      fallback="/series"
      className={`absolute left-4 top-[max(1rem,env(safe-area-inset-top))] ${RECUAR}`}
    >
      <IconeRecuar />
    </BotaoVoltar>
  );
}

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
      <main className="tela-cheia relative flex flex-col items-center justify-center px-6 text-center">
        <BotaoDeSair />
        <h1 className="text-[1.18rem] font-semibold text-label">Cloud não configurada</h1>
        <p className="mt-2 max-w-xs text-[0.88rem] text-label-2">
          A app está a correr só em modo local. Não há conta para iniciar sessão.
        </p>
      </main>
    );
  }

  return (
    <main className="tela-cheia relative flex flex-col justify-center px-5">
      <BotaoDeSair />
      <div className="mx-auto w-full max-w-sm">
        <h1 className="flex justify-center text-label">
          <Palavra className="h-10" />
        </h1>
        <p className="mt-1.5 text-center text-[0.88rem] text-label-2">
          Entra para teres a tua biblioteca em todos os dispositivos.
        </p>

        {modo === "password" ? (
          <form onSubmit={entrar} className="mt-8 flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="px-1 text-[0.76rem] font-semibold text-label-2">Email</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="o-teu@email.com"
                className="min-h-12 rounded-[22px] bg-group px-4 text-base text-label outline-none placeholder:text-label-2 focus:shadow-[inset_0_0_0_1.5px_var(--m-label-3)]"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="px-1 text-[0.76rem] font-semibold text-label-2">Palavra-passe</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="min-h-12 rounded-[22px] bg-group px-4 text-base text-label outline-none placeholder:text-label-2 focus:shadow-[inset_0_0_0_1.5px_var(--m-label-3)]"
              />
            </label>

            {erro && (
              <p className="page-enter text-[0.9375rem] text-danger" role="alert">
                {erro}
              </p>
            )}

            <Acao
              type="submit"
              disabled={busy}
              className="mt-2 w-full"
              icone={busy ? <span className="spinner h-4 w-4 rounded-full border-2 border-on-label/30 border-t-on-label" /> : undefined}
            >
              {busy ? "A entrar…" : "Entrar"}
            </Acao>

            <button
              type="button"
              onClick={() => {
                setModo("codigo");
                setErro(null);
              }}
              className="mt-1 min-h-11 cursor-pointer text-[0.88rem] text-label-2 transition active:opacity-60"
            >
              Não tenho palavra-passe — enviem-me um código
            </button>
          </form>
        ) : (
          <form onSubmit={confirmarCodigo} className="mt-8 flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="px-1 text-[0.76rem] font-semibold text-label-2">Email</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="o-teu@email.com"
                className="min-h-12 rounded-[22px] bg-group px-4 text-base text-label outline-none placeholder:text-label-2 focus:shadow-[inset_0_0_0_1.5px_var(--m-label-3)]"
              />
            </label>

            {codigoEnviado && (
              <label className="page-enter flex flex-col gap-1.5">
                <span className="px-1 text-[0.76rem] font-semibold text-label-2">Código recebido por email</span>
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="000000"
                  className="ep-code min-h-12 rounded-[22px] bg-group px-4 text-[1.18rem] tracking-[0.3em] text-label outline-none placeholder:text-label-2 focus:shadow-[inset_0_0_0_1.5px_var(--m-label-3)]"
                />
              </label>
            )}

            {erro && (
              <p className="page-enter text-[0.9375rem] text-danger" role="alert">
                {erro}
              </p>
            )}

            {codigoEnviado ? (
              <Acao
                type="submit"
                disabled={busy}
                className="mt-2 w-full"
                icone={busy ? <span className="spinner h-4 w-4 rounded-full border-2 border-on-label/30 border-t-on-label" /> : undefined}
              >
                {busy ? "A confirmar…" : "Confirmar código"}
              </Acao>
            ) : (
              <Acao
                type="button"
                onClick={() => void pedirCodigo()}
                disabled={busy}
                className="mt-2 w-full"
                icone={busy ? <span className="spinner h-4 w-4 rounded-full border-2 border-on-label/30 border-t-on-label" /> : undefined}
              >
                {busy ? "A enviar…" : "Enviar código"}
              </Acao>
            )}

            <button
              type="button"
              onClick={() => {
                setModo("password");
                setCodigoEnviado(false);
                setErro(null);
              }}
              className="mt-1 min-h-11 cursor-pointer text-[0.88rem] text-label-2 transition active:opacity-60"
            >
              Voltar à palavra-passe
            </button>
          </form>
        )}

        <p className="mt-10 flex items-center justify-center gap-2 text-center text-[0.76rem] text-label-2">
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
        <main className="tela-cheia flex items-center justify-center">
          <span className="spinner h-6 w-6 rounded-full border-2 border-label-3 border-t-label" aria-hidden />
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
