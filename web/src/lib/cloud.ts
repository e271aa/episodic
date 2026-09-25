// Camada de sincronização com o Supabase. Mantém o IndexedDB como fonte local
// (a app funciona sempre offline); a cloud é backup + sync entre dispositivos.
import { supabase } from "./supabase";
import {
  CHAVES_NA_NUVEM,
  getAllWatched,
  getLists,
  getMovies,
  getShows,
  gravarListasDaNuvem,
  kvGet,
  kvSetDaNuvem,
  mergeFromCloud,
  type CustomList,
} from "./db";
import {
  juntarEpisodio,
  juntarFilme,
  juntarKv,
  juntarSerie,
  movieToRow,
  rowToMovie,
  rowToShow,
  rowToWatched,
  showToRow,
  watchedToRow,
  type KvRow,
  type MovieRow,
  type ShowRow,
  type WatchedRow,
} from "./linhas";
import type { User } from "@supabase/supabase-js";

// ── Autenticação ──────────────────────────────────────────────

/** Envia um link mágico para o email (sem passwords). */
export async function signInWithEmail(email: string): Promise<{ error?: string }> {
  if (!supabase) return { error: "Cloud não configurada." };
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin + "/profile" },
  });
  return error ? { error: error.message } : {};
}

/**
 * Valida o código de 6 dígitos recebido por email — o caminho certo numa PWA
 * instalada, onde clicar no link abriria o browser em vez da app.
 */
export async function verifyEmailCode(
  email: string,
  code: string,
): Promise<{ error?: string }> {
  if (!supabase) return { error: "Cloud não configurada." };
  const { error } = await supabase.auth.verifyOtp({
    email,
    token: code.trim(),
    type: "email",
  });
  return error ? { error: error.message } : {};
}

/** Entrada clássica com email+password — o caminho sem fricção na PWA. */
/** Traduz os erros do Supabase, que vêm sempre em inglês e algo crus. */
function authErrorPt(message: string, status?: number): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email ou palavra-passe errados.";
  if (m.includes("email not confirmed")) return "Este email ainda não foi confirmado.";
  if (m.includes("too many requests") || status === 429)
    return "Demasiadas tentativas. Espera um bocado e tenta outra vez.";
  if (m.includes("network") || m.includes("fetch"))
    return "Sem ligação. Verifica a internet e tenta outra vez.";
  if (m.includes("password should be")) return "A palavra-passe é demasiado curta.";
  return "Não foi possível entrar. Tenta outra vez.";
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<{ error?: string }> {
  if (!supabase) return { error: "Cloud não configurada." };
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? { error: authErrorPt(error.message, error.status) } : {};
}

/** Define (ou muda) a password da conta com sessão iniciada. */
export async function setPassword(password: string): Promise<{ error?: string }> {
  if (!supabase) return { error: "Cloud não configurada." };
  const { error } = await supabase.auth.updateUser({ password });
  return error ? { error: error.message } : {};
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}

export async function getUser(): Promise<User | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user;
}

/** Notifica mudanças de sessão (login/logout). Devolve função para cancelar. */
export function onAuthChange(cb: (user: User | null) => void): () => void {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_e, session) => {
    cb(session?.user ?? null);
  });
  return () => data.subscription.unsubscribe();
}

// ── Mapeamento local ⇄ linhas da base de dados ────────────────

// Upserts grandes vão em lotes para não estourar limites de payload
async function upsertChunked(
  table: "shows" | "watched_episodes" | "watched_movies" | "user_kv",
  rows: Record<string, unknown>[],
): Promise<void> {
  if (!supabase || rows.length === 0) return;
  const size = 500;
  for (let i = 0; i < rows.length; i += size) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + size));
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

// ── Sincronização ─────────────────────────────────────────────

export interface SyncResult {
  pushedShows: number;
  pushedEpisodes: number;
  pushedMovies: number;
  pulledShows: number;
  pulledEpisodes: number;
  pulledMovies: number;
}

/** Envia toda a biblioteca local para a cloud (upsert). */
export async function pushAll(userId: string): Promise<Pick<SyncResult, "pushedShows" | "pushedEpisodes" | "pushedMovies">> {
  const [shows, watched, movies] = await Promise.all([
    getShows(),
    getAllWatched(),
    getMovies(),
  ]);
  await upsertChunked("shows", shows.map((s) => showToRow(s, userId)));
  await upsertChunked("watched_episodes", watched.map((w) => watchedToRow(w, userId)));
  await upsertChunked("watched_movies", movies.map((m) => movieToRow(m, userId)));
  // as listas e o resto que não é série/episódio/filme (ver CHAVES_NA_NUVEM)
  const kv: Record<string, unknown>[] = [];
  for (const chave of CHAVES_NA_NUVEM) {
    const valor = chave === "listas" ? await getLists() : await kvGet(chave);
    if (valor !== null) {
      kv.push({ user_id: userId, key: chave, value: valor, updated_at: new Date().toISOString() });
    }
  }
  await upsertChunked("user_kv", kv);
  return {
    pushedShows: shows.length,
    pushedEpisodes: watched.length,
    pushedMovies: movies.length,
  };
}

// Lê todas as linhas de uma tabela do utilizador, paginando
async function fetchAll<T>(
  table: string,
  onPage?: (total: number) => void,
): Promise<T[]> {
  if (!supabase) return [];
  const out: T[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + size - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...((data as T[]) ?? []));
    onPage?.(out.length);
    if (!data || data.length < size) break;
  }
  return out;
}

/** O que está a acontecer durante o pull — para dar sinal de vida a quem espera. */
export interface PullProgress {
  shows: number;
  episodes: number;
  movies: number;
  /** true quando já foi tudo buscado e falta só gravar no IndexedDB */
  merging: boolean;
}

/** Traz tudo da cloud e funde no local (união). */
export async function pullAndMerge(
  onProgress?: (p: PullProgress) => void,
): Promise<Pick<SyncResult, "pulledShows" | "pulledEpisodes" | "pulledMovies">> {
  const progress: PullProgress = { shows: 0, episodes: 0, movies: 0, merging: false };
  const report = () => onProgress?.({ ...progress });

  const [showRows, watchedRows, movieRows] = await Promise.all([
    fetchAll<ShowRow>("shows", (n) => {
      progress.shows = n;
      report();
    }),
    fetchAll<WatchedRow>("watched_episodes", (n) => {
      progress.episodes = n;
      report();
    }),
    fetchAll<MovieRow>("watched_movies", (n) => {
      progress.movies = n;
      report();
    }),
  ]);

  progress.merging = true;
  report();

  // Juntar, não substituir: a cloud sem a numeração de uma série quer dizer
  // "não sei", e substituir apagava-a no telemóvel (ver linhas.ts)
  const [locaisS, locaisW, locaisM] = await Promise.all([
    getShows(),
    getAllWatched(),
    getMovies(),
  ]);
  const porUuid = new Map(locaisS.map((s) => [s.uuid, s]));
  const porEpisodio = new Map(locaisW.map((w) => [w.id, w]));
  const porChave = new Map(locaisM.map((m) => [m.key, m]));
  await mergeFromCloud(
    showRows.map((r) => juntarSerie(porUuid.get(r.uuid), rowToShow(r))),
    watchedRows.map((r) => {
      const w = rowToWatched(r);
      return juntarEpisodio(porEpisodio.get(w.id), w);
    }),
    movieRows.map((r) => juntarFilme(porChave.get(r.key), rowToMovie(r))),
  );
  await trazerKv();
  return {
    pulledShows: showRows.length,
    pulledEpisodes: watchedRows.length,
    pulledMovies: movieRows.length,
  };
}

/**
 * As listas e o resto: a cloud é um cofre, não um espelho — só entra o que o
 * telemóvel não tem. Se a tabela ainda não existir (falta a migração), não é
 * razão para falhar o resto do pull.
 */
async function trazerKv(): Promise<void> {
  let linhas: KvRow[];
  try {
    linhas = await fetchAll<KvRow>("user_kv");
  } catch {
    return;
  }
  for (const { key, value } of linhas) {
    if (!(CHAVES_NA_NUVEM as readonly string[]).includes(key)) continue;
    if (key === "listas") {
      const locais = await getLists();
      const juntas = juntarKv(locais, value as CustomList[]);
      if (juntas !== locais) await gravarListasDaNuvem(juntas);
    } else {
      const local = await kvGet(key);
      const junto = juntarKv(local, value);
      if (junto !== local) await kvSetDaNuvem(key, junto);
    }
  }
}

/** Sincronização completa: envia o local e traz o remoto (união dos dois). */
export async function syncNow(userId: string): Promise<SyncResult> {
  const pushed = await pushAll(userId);
  const pulled = await pullAndMerge();
  return { ...pushed, ...pulled };
}
