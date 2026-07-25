// Sync incremental: cada marcação sobe para a cloud sozinha, sem depender do
// botão "Sincronizar agora".
//
// Porquê uma outbox em vez de escrever direto no Supabase a cada toque:
//  - offline (a app é PWA) — a escrita falharia e o registo perdia-se
//  - "marcar temporada" grava 13+ episódios num ciclo — seriam 13 pedidos
//  - o utilizador pode nem ter sessão iniciada quando marca
// A outbox vive em IndexedDB, é colapsada por episódio (fica só a última
// intenção) e é esvaziada em lote, com nova tentativa em caso de falha.
import { supabase } from "./supabase";
import {
  clearOutboxKeys,
  countOutbox,
  getOutbox,
  type OutboxOp,
} from "./db";
import { getUser } from "./cloud";

export type SyncState = "idle" | "pending" | "syncing" | "offline" | "error";

type Listener = (state: SyncState, pending: number) => void;

const listeners = new Set<Listener>();
let state: SyncState = "idle";
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let flushing = false;
let started = false;

// Agrupar toques: marcar uma temporada inteira dispara um envio só
const DEBOUNCE_MS = 1500;

function emit(pending: number): void {
  for (const listener of listeners) listener(state, pending);
}

async function setState(next: SyncState): Promise<void> {
  state = next;
  emit(await countOutbox());
}

export function onSyncStateChange(listener: Listener): () => void {
  listeners.add(listener);
  void countOutbox().then((pending) => listener(state, pending));
  return () => listeners.delete(listener);
}

/**
 * Envia a outbox. Só limpa da fila o que a cloud aceitou — se falhar a meio,
 * o que ficou por enviar continua guardado para a próxima tentativa.
 */
export async function flushOutbox(): Promise<void> {
  if (flushing || !supabase) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await setState("offline");
    return;
  }

  const ops = await getOutbox();
  if (ops.length === 0) {
    await setState("idle");
    return;
  }

  // Sem sessão não há para onde enviar — fica em espera (e sobe assim que
  // o utilizador entrar, porque o login também chama esta função).
  const user = await getUser();
  if (!user) {
    await setState("pending");
    return;
  }

  flushing = true;
  await setState("syncing");
  try {
    const toUpsert: OutboxOp[] = [];
    const toDelete: OutboxOp[] = [];
    for (const op of ops) {
      if (op.kind === "episode-watched") toUpsert.push(op);
      else toDelete.push(op);
    }

    const done: string[] = [];

    if (toUpsert.length > 0) {
      const { error } = await supabase.from("watched_episodes").upsert(
        toUpsert.map((op) => ({
          user_id: user.id,
          show_uuid: op.showUuid,
          season: op.season,
          episode: op.episode,
          watched_at: op.watchedAt,
          date_is_exact: true,
          updated_at: new Date().toISOString(),
        })),
      );
      if (!error) done.push(...toUpsert.map((op) => op.key));
    }

    // Apagar é feito um a um: o Supabase não tem "delete where (a,b,c) in (…)"
    // com chave composta, e desmarcar em massa é raro (ao contrário de marcar).
    for (const op of toDelete) {
      const { error } = await supabase
        .from("watched_episodes")
        .delete()
        .match({
          user_id: user.id,
          show_uuid: op.showUuid,
          season: op.season,
          episode: op.episode,
        });
      if (!error) done.push(op.key);
    }

    await clearOutboxKeys(done);
    const left = await countOutbox();
    await setState(left > 0 ? "error" : "idle");
  } catch {
    await setState("error");
  } finally {
    flushing = false;
  }
}

/** Pede um envio; junta toques seguidos para não disparar um pedido por episódio. */
export function scheduleFlush(): void {
  if (!supabase) return;
  void setState("pending");
  clearTimeout(flushTimer);
  flushTimer = setTimeout(() => void flushOutbox(), DEBOUNCE_MS);
}

/**
 * Liga o sync automático: envia o que ficou pendente de sessões anteriores e
 * reage a voltar a ter rede ou a app voltar a primeiro plano.
 */
export function startAutoSync(): void {
  if (started || typeof window === "undefined" || !supabase) return;
  started = true;

  void flushOutbox();
  window.addEventListener("online", () => void flushOutbox());
  window.addEventListener("offline", () => void setState("offline"));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void flushOutbox();
  });
}
