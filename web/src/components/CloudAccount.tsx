"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isCloudConfigured } from "@/lib/supabase";
import SectionHeader from "@/components/SectionHeader";
import { Panel, PanelRow } from "@/components/Panel";
import {
  contarNaNuvem,
  contarNoTelemovel,
  getUser,
  onAuthChange,
  pullAndMerge,
  setPassword,
  signOut,
  syncNow,
} from "@/lib/cloud";
import { compararComNuvem, type LinhaDaProva } from "@/lib/linhas";
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

  /**
   * A prova da Fase 2: uma instalação nova recuperava tudo? Compara o que
   * está aqui com o que está na cloud. Faz o que a janela privada fazia, mas
   * no próprio telemóvel, e repete-se quando se quiser.
   */
  const [prova, setProva] = useState<
    | { fase: "a-contar" }
    | { fase: "feita"; linhas: LinhaDaProva[]; tudoCerto: boolean; faltaSql: boolean }
    | { fase: "erro"; mensagem: string }
    | null
  >(null);
  const verificarCopia = useCallback(async () => {
    setProva({ fase: "a-contar" });
    try {
      const [local, nuvem] = await Promise.all([contarNoTelemovel(), contarNaNuvem()]);
      setProva({ fase: "feita", ...compararComNuvem(local, nuvem) });
    } catch (e) {
      setProva({ fase: "erro", mensagem: e instanceof Error ? e.message : String(e) });
    }
  }, []);

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
        <SectionHeader label="Conta" />
        <Panel className="mt-3">
          <PanelRow
            titulo="Sincronização desligada"
            detalhe="Quando estiver ligada, entras com o email e tens a biblioteca em todos os dispositivos."
          />
        </Panel>
      </section>
    );
  }

  return (
    <section className="mt-8">
      <SectionHeader label="Conta" meta={user ? "ligada" : "sem sessão"} />

      {user ? (
        <Panel className="mt-3">
          <PanelRow titulo={user.email ?? "Sessão iniciada"} detalhe={autoSyncLabel} />
          <PanelRow
            titulo={status === "syncing" ? "A sincronizar…" : "Sincronizar agora"}
            onClick={() => void handleSync()}
            fim={
              status === "syncing" ? (
                <span className="spinner h-4 w-4 rounded-full border-2 border-dim/30 border-t-dim" />
              ) : (
                "→"
              )
            }
          />

          {/* Password opcional: entra noutros dispositivos sem depender de
              emails (o link/código continua disponível como alternativa). */}
          <form
            className="px-5 py-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSetPassword();
            }}
          >
            <label htmlFor="cloud-nova-password" className="font-display text-[0.9375rem] font-semibold">
              Password
            </label>
            <p className="mt-0.5 text-xs text-dim">
              Para entrares noutros dispositivos sem esperar por emails.
            </p>
            <div className="mt-2.5 flex gap-2">
              <input
                id="cloud-nova-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="mínimo 8 caracteres"
                autoComplete="new-password"
                minLength={8}
                className="min-h-11 w-0 flex-1 rounded-full border border-line bg-tube px-4 text-base outline-none transition-colors focus:border-ink"
              />
              <button
                type="submit"
                disabled={status === "verifying" || newPassword.length < 8}
                className="min-h-11 shrink-0 cursor-pointer rounded-full border border-line px-5 text-[0.9375rem] font-medium text-dim transition hover:bg-raised disabled:opacity-50"
              >
                Guardar
              </button>
            </div>
          </form>

          <PanelRow
            titulo="Verificar a cópia na cloud"
            detalhe="Se reinstalasses a app hoje, recuperavas tudo?"
            onClick={() => void verificarCopia()}
            fim={
              prova?.fase === "a-contar" ? (
                <span className="spinner h-4 w-4 rounded-full border-2 border-dim/30 border-t-dim" />
              ) : (
                "→"
              )
            }
          />
          {prova?.fase === "feita" && (
            <div className="px-5 pb-4" data-testid="prova-nuvem">
              <table className="w-full text-[0.9375rem]">
                <thead>
                  <tr className="text-left text-xs text-faint">
                    <th className="py-1 font-normal"></th>
                    <th className="py-1 text-right font-normal">aqui</th>
                    <th className="py-1 text-right font-normal">cloud</th>
                    <th className="w-6"></th>
                  </tr>
                </thead>
                <tbody>
                  {prova.linhas.map((l) => (
                    <tr key={l.nome} className="border-t border-line">
                      <td className="py-1.5 text-dim">{l.nome}</td>
                      <td className="ep-code py-1.5 text-right">{l.local}</td>
                      <td className="ep-code py-1.5 text-right">{l.nuvem ?? "—"}</td>
                      <td className="py-1.5 text-right" aria-label={l.certo ? "igual" : "diferente"}>
                        {l.certo ? "✓" : "✗"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p
                className={`mt-3 text-[0.9375rem] ${prova.tudoCerto ? "text-ink" : "text-danger"}`}
                data-testid="prova-veredicto"
              >
                {prova.faltaSql
                  ? "A cloud ainda não guarda a numeração nem as listas — falta correr o SQL da Ronda 12 no Supabase."
                  : prova.tudoCerto
                    ? "Uma instalação nova recuperava tudo."
                    : autoSync.pending > 0
                      ? `Há ${autoSync.pending} alterações ainda por enviar — espera que a sincronização termine e verifica outra vez.`
                      : "A cloud não tem o mesmo que o telemóvel — não reinstales a app ainda."}
              </p>
            </div>
          )}
          {prova?.fase === "erro" && (
            <p className="px-5 pb-4 text-[0.9375rem] text-danger">
              Não deu para verificar: {prova.mensagem}
            </p>
          )}

          <PanelRow titulo="Terminar sessão" onClick={() => void handleSignOut()} />
        </Panel>
      ) : (
        <Panel className="mt-3">
          <PanelRow
            titulo="Entrar"
            detalhe="Sem sessão neste dispositivo — a biblioteca vive só aqui."
            href="/login"
            fim="→"
          />
        </Panel>
      )}

      {message && (
        <p className={`mt-2 px-1 text-xs ${status === "error" ? "text-danger" : "text-dim"}`}>
          {message}
        </p>
      )}
    </section>
  );
}
