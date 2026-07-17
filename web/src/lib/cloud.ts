// Camada de sincronização com o Supabase. Mantém o IndexedDB como fonte local
// (a app funciona sempre offline); a cloud é backup + sync entre dispositivos.
import { supabase } from "./supabase";
import {
  episodeKey,
  getMovies,
  getAllWatched,
  getShows,
  mergeFromCloud,
  type StoredMovie,
  type StoredShow,
  type WatchedEpisode,
} from "./db";
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

function showToRow(s: StoredShow, userId: string) {
  return {
    user_id: userId,
    uuid: s.uuid,
    name: s.name,
    tvdb_id: s.tvdbId,
    tmdb_id: s.tmdbId,
    tvmaze_id: s.tvmazeId ?? null,
    poster_path: s.posterPath,
    backdrop_path: s.backdropPath,
    overview: s.overview,
    total_episodes: s.totalEpisodes,
    first_aired: s.firstAired ?? null,
    status: s.status ?? null,
    genres: s.genres ?? null,
    imdb_id: s.imdbId ?? null,
    followed: s.followed,
    in_watchlist: s.inWatchlist,
    archived: s.archived,
    added_at: s.addedAt,
    updated_at: new Date().toISOString(),
  };
}

interface ShowRow {
  uuid: string;
  name: string;
  tvdb_id: number | null;
  tmdb_id: number | null;
  tvmaze_id: number | null;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string | null;
  total_episodes: number | null;
  first_aired: string | null;
  status: string | null;
  genres: string[] | null;
  imdb_id: string | null;
  followed: boolean;
  in_watchlist: boolean;
  archived: boolean;
  added_at: string;
}

function rowToShow(r: ShowRow): StoredShow {
  return {
    uuid: r.uuid,
    name: r.name,
    tvdbId: r.tvdb_id,
    tmdbId: r.tmdb_id,
    tvmazeId: r.tvmaze_id,
    posterPath: r.poster_path,
    backdropPath: r.backdrop_path,
    overview: r.overview,
    totalEpisodes: r.total_episodes,
    firstAired: r.first_aired,
    status: r.status,
    genres: r.genres,
    imdbId: r.imdb_id,
    followed: r.followed,
    inWatchlist: r.in_watchlist,
    archived: r.archived,
    addedAt: r.added_at,
  };
}

function watchedToRow(w: WatchedEpisode, userId: string) {
  return {
    user_id: userId,
    show_uuid: w.showUuid,
    season: w.season,
    episode: w.episode,
    watched_at: w.watchedAt,
    date_is_exact: w.dateIsExact,
    updated_at: new Date().toISOString(),
  };
}

interface WatchedRow {
  show_uuid: string;
  season: number;
  episode: number;
  watched_at: string;
  date_is_exact: boolean;
}

function rowToWatched(r: WatchedRow): WatchedEpisode {
  return {
    id: episodeKey(r.show_uuid, r.season, r.episode),
    showUuid: r.show_uuid,
    season: r.season,
    episode: r.episode,
    watchedAt: r.watched_at,
    dateIsExact: r.date_is_exact,
  };
}

function movieToRow(m: StoredMovie, userId: string) {
  return {
    user_id: userId,
    key: m.key,
    name: m.name,
    watched_at: m.watchedAt,
    date_is_exact: m.dateIsExact,
    updated_at: new Date().toISOString(),
  };
}

interface MovieRow {
  key: string;
  name: string;
  watched_at: string;
  date_is_exact: boolean;
}

function rowToMovie(r: MovieRow): StoredMovie {
  return {
    key: r.key,
    name: r.name,
    watchedAt: r.watched_at,
    dateIsExact: r.date_is_exact,
  };
}

// Upserts grandes vão em lotes para não estourar limites de payload
async function upsertChunked(
  table: "shows" | "watched_episodes" | "watched_movies",
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
  return {
    pushedShows: shows.length,
    pushedEpisodes: watched.length,
    pushedMovies: movies.length,
  };
}

// Lê todas as linhas de uma tabela do utilizador, paginando
async function fetchAll<T>(table: string): Promise<T[]> {
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
    if (!data || data.length < size) break;
  }
  return out;
}

/** Traz tudo da cloud e funde no local (união). */
export async function pullAndMerge(): Promise<Pick<SyncResult, "pulledShows" | "pulledEpisodes" | "pulledMovies">> {
  const [showRows, watchedRows, movieRows] = await Promise.all([
    fetchAll<ShowRow>("shows"),
    fetchAll<WatchedRow>("watched_episodes"),
    fetchAll<MovieRow>("watched_movies"),
  ]);
  await mergeFromCloud(
    showRows.map(rowToShow),
    watchedRows.map(rowToWatched),
    movieRows.map(rowToMovie),
  );
  return {
    pulledShows: showRows.length,
    pulledEpisodes: watchedRows.length,
    pulledMovies: movieRows.length,
  };
}

/** Sincronização completa: envia o local e traz o remoto (união dos dois). */
export async function syncNow(userId: string): Promise<SyncResult> {
  const pushed = await pushAll(userId);
  const pulled = await pullAndMerge();
  return { ...pushed, ...pulled };
}
