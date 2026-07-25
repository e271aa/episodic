// Persistência local no browser (IndexedDB). Serve o MVP offline;
// quando ligarmos o Supabase, isto passa a ser a cache local do sync.
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { TvTimeExport } from "./tvtime/types";

export interface StoredShow {
  uuid: string; // uuid do TV Time, ou "tmdb-<id>" para séries adicionadas na app
  name: string;
  tvdbId: number | null;
  tmdbId: number | null;
  tvmazeId?: number | null;
  posterPath: string | null; // caminho TMDB ("/abc.jpg") ou URL absoluto (TVmaze)
  backdropPath: string | null;
  overview: string | null;
  totalEpisodes: number | null; // do fornecedor, para a barra de progresso
  firstAired?: string | null; // data de estreia (YYYY-MM-DD)
  status?: string | null; // "Running", "Ended", …
  genres?: string[] | null;
  imdbId?: string | null; // ex. "tt1234567" — para link externo
  followed: boolean;
  inWatchlist: boolean;
  archived: boolean;
  addedAt: string;
}

export interface WatchedEpisode {
  id: string; // `${showUuid}:${season}:${episode}`
  showUuid: string;
  season: number;
  episode: number;
  watchedAt: string;
  dateIsExact: boolean;
}

export interface StoredMovie {
  key: string;
  name: string;
  watchedAt: string;
  dateIsExact: boolean;
  releaseDate?: string | null; // YYYY-MM-DD — desambigua a pesquisa TMDB
  // enriquecimento local (a cloud só guarda nome+datas; posters recalculam-se)
  tmdbId?: number | null;
  posterPath?: string | null;
}

export interface ImportMeta {
  importedAt: string;
  totalSeriesRuntimeSec: number | null;
  totalMoviesRuntimeSec: number | null;
}

export interface ListItem {
  kind: "show" | "movie";
  refId: string; // uuid da série ou key do filme
  addedAt: string;
}

export interface CustomList {
  id: string;
  name: string;
  createdAt: string;
  items: ListItem[];
}

/**
 * Operação pendente de envio para a cloud. Fica em IndexedDB (não em memória)
 * para sobreviver a recargas e a fechar a app offline — o registo local nunca
 * se perde só porque a rede falhou.
 */
export interface OutboxOp {
  /** chave da entidade, ex. "ep:<uuid>:1:2" — colapsa marcar/desmarcar repetidos */
  key: string;
  kind: "episode-watched" | "episode-unwatched";
  showUuid: string;
  season: number;
  episode: number;
  watchedAt: string;
  at: string;
}

interface TvlogDB extends DBSchema {
  kv: { key: string; value: unknown };
  shows: { key: string; value: StoredShow };
  watched: {
    key: string;
    value: WatchedEpisode;
    indexes: { "by-show": string };
  };
  movies: { key: string; value: StoredMovie };
  lists: { key: string; value: CustomList };
  outbox: { key: string; value: OutboxOp };
}

let dbPromise: Promise<IDBPDatabase<TvlogDB>> | null = null;
// referência à ligação aberta — precisamos dela para a poder fechar quando
// outra aba estiver a tentar subir de versão
let openConnection: IDBPDatabase<TvlogDB> | null = null;

function db(): Promise<IDBPDatabase<TvlogDB>> {
  dbPromise ??= openDB<TvlogDB>("tvlog", 4, {
    // Criação defensiva: garante cada store/índice esteja em falta o motivo
    // que for (upgrade de versão parcial, base criada por outra via, etc.).
    upgrade(database) {
      if (!database.objectStoreNames.contains("kv")) {
        database.createObjectStore("kv");
      }
      if (!database.objectStoreNames.contains("shows")) {
        database.createObjectStore("shows", { keyPath: "uuid" });
      }
      if (!database.objectStoreNames.contains("watched")) {
        const watched = database.createObjectStore("watched", { keyPath: "id" });
        watched.createIndex("by-show", "showUuid");
      }
      if (!database.objectStoreNames.contains("movies")) {
        database.createObjectStore("movies", { keyPath: "key" });
      }
      if (!database.objectStoreNames.contains("lists")) {
        database.createObjectStore("lists", { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains("outbox")) {
        database.createObjectStore("outbox", { keyPath: "key" });
      }
    },
    /**
     * Outra aba (ou a PWA instalada) quer subir de versão e esta ligação está
     * a impedir. Sem fechar aqui, a outra aba fica à espera para sempre e a
     * app parece congelada a carregar — foi exatamente o que aconteceu ao
     * subir para v4 com outras abas abertas na versão anterior.
     */
    blocking() {
      openConnection?.close();
      openConnection = null;
      dbPromise = null;
    },
    /** Somos nós a esperar que uma aba antiga liberte a base de dados. */
    blocked() {
      console.warn(
        "Episodic: atualização da base de dados em espera — fecha outras abas da app.",
      );
    },
    terminated() {
      openConnection = null;
      dbPromise = null;
    },
  }).then((connection) => {
    openConnection = connection;
    return connection;
  });
  return dbPromise;
}

export function episodeKey(showUuid: string, season: number, episode: number): string {
  return `${showUuid}:${season}:${episode}`;
}

/** Substitui a biblioteca local pelo conteúdo de um export do TV Time. */
export async function importExport(data: TvTimeExport): Promise<void> {
  const database = await db();
  const tx = database.transaction(["shows", "watched", "movies", "kv"], "readwrite");

  // Todos os pedidos são emitidos sincronamente na mesma transação (os clears
  // executam primeiro, por ordem de fila) — um await a meio pode fechá-la.
  void tx.objectStore("shows").clear();
  void tx.objectStore("watched").clear();
  void tx.objectStore("movies").clear();

  const showUuids = new Set(data.shows.map((s) => s.uuid));
  // Quando a TheTVDB reestrutura uma série, o TV Time por vezes regista o
  // histórico sob um UUID novo mas mantém a série seguida no UUID antigo (ou
  // vice-versa). Isso deixa episódios "órfãos" — cujo UUID não tem série — que
  // duplicam episódios já contados. Reatribuímos esses órfãos à série seguida
  // com o mesmo nome; o `put` por chave (uuid:temporada:episódio) colapsa então
  // os duplicados. Sem isto, ex.: Prison Break apareceria contado a dobrar.
  const followedByName = new Map<string, string>();
  for (const show of data.shows) {
    if (!followedByName.has(show.name)) followedByName.set(show.name, show.uuid);
  }

  for (const show of data.shows) {
    void tx.objectStore("shows").put({
      uuid: show.uuid,
      name: show.name,
      tvdbId: show.tvdbId,
      tmdbId: null,
      tvmazeId: null,
      posterPath: null,
      backdropPath: null,
      overview: null,
      totalEpisodes: null,
      followed: show.followed,
      inWatchlist: show.inWatchlist,
      archived: show.archived,
      addedAt: show.createdAt,
    });
  }
  for (const ep of data.episodes) {
    // órfão → reatribui à série homónima; se não houver, mantém o UUID original
    const showUuid = showUuids.has(ep.seriesUuid)
      ? ep.seriesUuid
      : (followedByName.get(ep.seriesName) ?? ep.seriesUuid);
    void tx.objectStore("watched").put({
      id: episodeKey(showUuid, ep.season, ep.episode),
      showUuid,
      season: ep.season,
      episode: ep.episode,
      watchedAt: ep.watchedAt,
      dateIsExact: ep.dateIsExact,
    });
  }
  for (const movie of data.movies) {
    void tx.objectStore("movies").put({
      key: movie.key,
      name: movie.name,
      watchedAt: movie.watchedAt,
      dateIsExact: movie.dateIsExact,
      releaseDate: movie.releaseDate ?? null,
    });
  }
  const meta: ImportMeta = {
    importedAt: new Date().toISOString(),
    totalSeriesRuntimeSec: data.stats.totalSeriesRuntimeSec,
    totalMoviesRuntimeSec: data.stats.totalMoviesRuntimeSec,
  };
  void tx.objectStore("kv").put(meta, "import-meta");
  await tx.done;
}

// Importações feitas na versão anterior da app guardavam um blob único em kv.
// Se existir e os stores novos estiverem vazios, converte-o uma única vez.
export async function migrateLegacyImport(): Promise<boolean> {
  const database = await db();
  const hasShows = (await database.count("shows")) > 0;
  if (hasShows) return false;
  const legacy = (await database.get("kv", "tvtime-export")) as
    | { data: TvTimeExport }
    | undefined;
  if (!legacy?.data) return false;
  await importExport(legacy.data);
  await database.delete("kv", "tvtime-export");
  return true;
}

export async function getShows(): Promise<StoredShow[]> {
  const database = await db();
  return database.getAll("shows");
}

/**
 * Funde dados vindos da cloud no armazém local (upsert, sem apagar nada).
 * Semântica de união: um episódio presente na cloud OU no local fica visto.
 */
export async function mergeFromCloud(
  shows: StoredShow[],
  watched: WatchedEpisode[],
  movies: StoredMovie[],
): Promise<void> {
  const database = await db();
  // Filmes: a cloud não guarda enriquecimento (poster/tmdbId) — preserva o
  // que já existe localmente para não refazer pesquisas TMDB a cada pull
  const existingMovies = new Map(
    (await database.getAll("movies")).map((m) => [m.key, m]),
  );
  const tx = database.transaction(["shows", "watched", "movies"], "readwrite");
  for (const show of shows) void tx.objectStore("shows").put(show);
  for (const ep of watched) void tx.objectStore("watched").put(ep);
  for (const movie of movies) {
    void tx.objectStore("movies").put({ ...existingMovies.get(movie.key), ...movie });
  }
  await tx.done;
}

export async function getShow(uuid: string): Promise<StoredShow | null> {
  const database = await db();
  return (await database.get("shows", uuid)) ?? null;
}

export async function putShow(show: StoredShow): Promise<void> {
  const database = await db();
  await database.put("shows", show);
}

export async function updateShow(
  uuid: string,
  patch: Partial<StoredShow>,
): Promise<StoredShow | null> {
  const database = await db();
  const current = await database.get("shows", uuid);
  if (!current) return null;
  const next = { ...current, ...patch, uuid };
  await database.put("shows", next);
  return next;
}

export async function getWatchedForShow(showUuid: string): Promise<WatchedEpisode[]> {
  const database = await db();
  return database.getAllFromIndex("watched", "by-show", showUuid);
}

export async function getAllWatched(): Promise<WatchedEpisode[]> {
  const database = await db();
  return database.getAll("watched");
}

export async function countWatched(): Promise<number> {
  const database = await db();
  return database.count("watched");
}

export async function markWatched(
  showUuid: string,
  season: number,
  episode: number,
): Promise<void> {
  const database = await db();
  const watchedAt = new Date().toISOString();
  await database.put("watched", {
    id: episodeKey(showUuid, season, episode),
    showUuid,
    season,
    episode,
    watchedAt,
    dateIsExact: true,
  });
  // A chave é a do episódio: marcar e desmarcar o mesmo episódio várias vezes
  // deixa só a última intenção na fila, que é a correta.
  await enqueueOp({
    key: `ep:${episodeKey(showUuid, season, episode)}`,
    kind: "episode-watched",
    showUuid,
    season,
    episode,
    watchedAt,
    at: watchedAt,
  });
}

export async function unmarkWatched(
  showUuid: string,
  season: number,
  episode: number,
): Promise<void> {
  const database = await db();
  await database.delete("watched", episodeKey(showUuid, season, episode));
  await enqueueOp({
    key: `ep:${episodeKey(showUuid, season, episode)}`,
    kind: "episode-unwatched",
    showUuid,
    season,
    episode,
    watchedAt: new Date().toISOString(),
    at: new Date().toISOString(),
  });
}

// ── Outbox (envio diferido para a cloud) ───────────────────────

async function enqueueOp(op: OutboxOp): Promise<void> {
  const database = await db();
  await database.put("outbox", op);
  // import dinâmico: o autosync depende deste módulo, um import estático
  // aqui fecharia o ciclo. Só corre no browser.
  if (typeof window !== "undefined") {
    void import("./autosync").then((m) => m.scheduleFlush());
  }
}

export async function getOutbox(): Promise<OutboxOp[]> {
  const database = await db();
  return database.getAll("outbox");
}

export async function countOutbox(): Promise<number> {
  const database = await db();
  return database.count("outbox");
}

/** Remove da fila só o que foi mesmo enviado (o resto fica para nova tentativa). */
export async function clearOutboxKeys(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const database = await db();
  const tx = database.transaction("outbox", "readwrite");
  for (const key of keys) void tx.objectStore("outbox").delete(key);
  await tx.done;
}

export async function getMovies(): Promise<StoredMovie[]> {
  const database = await db();
  return database.getAll("movies");
}

export async function getMovie(key: string): Promise<StoredMovie | null> {
  const database = await db();
  return (await database.get("movies", key)) ?? null;
}

/**
 * Grava um filme novo. Até aqui só entravam filmes pela importação do TV Time —
 * isto é o que permite marcar um filme visto sem ter de importar nada.
 */
export async function putMovie(movie: StoredMovie): Promise<void> {
  const database = await db();
  await database.put("movies", movie);
}

export async function deleteMovie(key: string): Promise<void> {
  const database = await db();
  await database.delete("movies", key);
}

export async function updateMovie(
  key: string,
  patch: Partial<StoredMovie>,
): Promise<void> {
  const database = await db();
  const current = await database.get("movies", key);
  if (!current) return;
  await database.put("movies", { ...current, ...patch, key });
}

export async function getImportMeta(): Promise<ImportMeta | null> {
  const database = await db();
  return ((await database.get("kv", "import-meta")) as ImportMeta | undefined) ?? null;
}

// Acesso genérico ao kv — usado para caches (ex.: listas de episódios TVmaze)
export async function kvGet<T>(key: string): Promise<T | null> {
  const database = await db();
  return ((await database.get("kv", key)) as T | undefined) ?? null;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  const database = await db();
  await database.put("kv", value, key);
}

export async function clearAllData(): Promise<void> {
  const database = await db();
  const tx = database.transaction(
    ["shows", "watched", "movies", "kv", "lists", "outbox"],
    "readwrite",
  );
  void tx.objectStore("shows").clear();
  void tx.objectStore("watched").clear();
  void tx.objectStore("movies").clear();
  void tx.objectStore("kv").clear();
  void tx.objectStore("lists").clear();
  void tx.objectStore("outbox").clear();
  await tx.done;
}

// ── Listas personalizadas ──────────────────────────────────────

export async function getLists(): Promise<CustomList[]> {
  const database = await db();
  const lists = await database.getAll("lists");
  return lists.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getList(id: string): Promise<CustomList | null> {
  const database = await db();
  return (await database.get("lists", id)) ?? null;
}

export async function createList(name: string): Promise<CustomList> {
  const database = await db();
  const list: CustomList = {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    items: [],
  };
  await database.put("lists", list);
  return list;
}

export async function renameList(id: string, name: string): Promise<void> {
  const database = await db();
  const list = await database.get("lists", id);
  if (!list) return;
  await database.put("lists", { ...list, name });
}

export async function deleteList(id: string): Promise<void> {
  const database = await db();
  await database.delete("lists", id);
}

export async function addToList(
  listId: string,
  kind: "show" | "movie",
  refId: string,
): Promise<void> {
  const database = await db();
  const list = await database.get("lists", listId);
  if (!list || list.items.some((i) => i.kind === kind && i.refId === refId)) return;
  list.items.push({ kind, refId, addedAt: new Date().toISOString() });
  await database.put("lists", list);
}

export async function removeFromList(
  listId: string,
  kind: "show" | "movie",
  refId: string,
): Promise<void> {
  const database = await db();
  const list = await database.get("lists", listId);
  if (!list) return;
  list.items = list.items.filter((i) => !(i.kind === kind && i.refId === refId));
  await database.put("lists", list);
}
