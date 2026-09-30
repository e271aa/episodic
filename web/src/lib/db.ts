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
  /**
   * Minutos de um episódio típico, do fornecedor — para o Tempo de antena
   * contar o que se marca na app (Ronda 12, 5c). `undefined` = ainda não se
   * perguntou; `null` = o fornecedor não sabe. Só local: não vai para a
   * cloud, e o `juntarSerie` guarda-o ao juntar.
   */
  runtime?: number | null;
  /**
   * Outros títulos por que esta série é conhecida na TMDB (o pt-PT e o
   * original), capturados quando se resolve o id TMDB.
   *
   * Servem para o Explorar reconhecer o que já tens. O nome guardado vem do
   * TV Time e muitas vezes não é nenhum dos dois — "Boku Dake ga Inai Machi"
   * é "Erased" em pt-PT e "僕だけがいない街" no original — e a TMDB às vezes
   * tem a MESMA série em duas entradas com ids diferentes, que o id sozinho
   * não apanha.
   */
  tmdbAliases?: string[];
  /**
   * Qual dos fornecedores define a **numeração** (temporada, episódio) desta
   * série. Nada a ver com de onde vem a capa ou a sinopse.
   *
   * Existe porque o id do TMDB é preciso para coisas que não são numeração —
   * "onde ver", recomendações, reconhecer no Explorar o que já tens — e sem
   * este campo guardá-lo mudava a numeração por efeito secundário: o
   * `getSeasons` passava a preferir o TMDB e a série era reparticionada.
   * Medido: o Naruto tem 6 temporadas na TVmaze (13·51·51·50·50·5) e 4 no
   * TMDB (52·52·54·62). São os mesmos 220 episódios; se a numeração virasse,
   * 55 marcações passavam a apontar para temporadas que já não existem.
   *
   * Quem já cá estava antes deste campo é tratado pela regra antiga (ver
   * `fonteDaNumeracao`), e o `enrichShow` fixa-o **antes** de acrescentar
   * um id novo — para nunca haver um instante em que a série tem id do TMDB
   * e ainda não tem numeração declarada.
   */
  numeracao?: "tmdb" | "tvmaze";
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
  /**
   * ID do episódio no TheTVDB, vindo do campo `ep_id` do export do TV Time.
   *
   * É a única chave ESTÁVEL entre sistemas: (temporada, episódio) muda quando
   * o TheTVDB reorganiza uma série — o Naruto do Ruben tem a 1ª temporada com
   * 57 episódios porque foi assim que a viu, mas o TheTVDB hoje divide-a em
   * 35 + 48. Estava a ser lido no parser e deitado fora no import.
   *
   * Opcional: episódios marcados dentro da app (não importados) não o têm.
   */
  episodeTvdbId?: number | null;
}

export interface StoredMovie {
  key: string;
  name: string;
  /** null = ainda não visto, está só na lista "para ver" */
  watchedAt: string | null;
  dateIsExact: boolean;
  releaseDate?: string | null; // YYYY-MM-DD — desambigua a pesquisa TMDB
  /** quando entrou na biblioteca (visto ou para ver) — para ordenar a lista
   *  "para ver" por adição recente, já que não há data de visto para isso */
  addedAt?: string;
  // enriquecimento local (a cloud só guarda nome+datas; posters recalculam-se)
  tmdbId?: number | null;
  posterPath?: string | null;
  /**
   * Outros títulos do mesmo filme — o português e o original da TMDB.
   *
   * O nome guardado vem do TV Time, quase sempre em inglês. Sem isto, procurar
   * "Os Condenados de Shawshank" dizia "0 filmes na biblioteca" com o filme lá
   * dentro — e era isso que empurrava para a pesquisa no catálogo, onde se
   * criava a cópia (Ronda 12).
   */
  aliases?: string[];
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
interface OutboxCommon {
  /** chave da entidade, ex. "ep:<uuid>:1:2" — colapsa marcar/desmarcar repetidos */
  key: string;
  at: string;
}

export interface EpisodeOp extends OutboxCommon {
  kind: "episode-watched" | "episode-unwatched";
  showUuid: string;
  season: number;
  episode: number;
  watchedAt: string;
  /**
   * Subia sempre como exata. Um episódio marcado por inferência ("vi tudo",
   * os buracos) tem a data de hoje só porque tem de ter alguma — e voltava da
   * cloud a dizer que tinha sido visto hoje, com certeza. Ausente = exata.
   */
  dateIsExact?: boolean;
}

export interface MovieOp extends OutboxCommon {
  kind: "movie-watched" | "movie-unwatched";
  movieKey: string;
  name: string;
  dateIsExact: boolean;
  /** null = filme "para ver" (sem data de visto) */
  watchedAt: string | null;
}

/**
 * Apagar uma série tem de subir para a cloud como intenção própria: o
 * `pushToCloud` só faz upsert do que existe localmente, portanto uma série
 * apagada só aqui continuava na cloud — e a sincronização seguinte trazia-a
 * de volta. Era exatamente o que ia acontecer às cópias duplicadas.
 */
export interface ShowOp extends OutboxCommon {
  /**
   * `show-upserted` faltava: seguir, arquivar, o id da TMDB, o total, a
   * numeração — nada disto subia sozinho, só com "Sincronizar agora". Uma
   * série adicionada na app e nunca sincronizada à mão não existia na cloud,
   * e numa instalação nova os episódios dela ficavam sem série (Ronda 12).
   * Partilha a chave com `show-deleted`: fica a última intenção.
   */
  kind: "show-deleted" | "show-upserted";
  showUuid: string;
}

/** Uma das chaves de `CHAVES_NA_NUVEM` mudou — sobe o valor atual. */
export interface KvOp extends OutboxCommon {
  kind: "kv-upserted";
  chave: ChaveNaNuvem;
}

export type OutboxOp = EpisodeOp | MovieOp | ShowOp | KvOp;

/**
 * O que, fora de séries, episódios e filmes, tem de sobreviver a uma
 * instalação nova: as listas (não havia tabela para elas — perdiam-se
 * inteiras), as horas do import, e as respostas que já deste.
 */
export const CHAVES_NA_NUVEM = [
  "listas",
  "import-meta",
  "rever:a-ver",
  "explorar:dispensados",
] as const;
export type ChaveNaNuvem = (typeof CHAVES_NA_NUVEM)[number];

function vaiParaANuvem(chave: string): chave is ChaveNaNuvem {
  return (CHAVES_NA_NUVEM as readonly string[]).includes(chave);
}

export function isMovieOp(op: OutboxOp): op is MovieOp {
  return op.kind === "movie-watched" || op.kind === "movie-unwatched";
}

export function isShowOp(op: OutboxOp): op is ShowOp {
  return op.kind === "show-deleted" || op.kind === "show-upserted";
}

export function isKvOp(op: OutboxOp): op is KvOp {
  return op.kind === "kv-upserted";
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
  /**
   * Um episódio pode vir em várias linhas: o visto original e as revisões
   * (`rewatch-episode`). Todas colapsam na mesma chave, e fica a **mais
   * recente** — que é o que responde a "quando é que eu vi isto pela última
   * vez", e é o que alimenta a ordenação por vistos recentemente e o corte
   * de 30 dias da fila.
   *
   * Escolher explicitamente, e não deixar o último `put` ganhar: a ordem das
   * linhas no CSV não é garantida, e antes disto o resultado dependia dela —
   * uma revisão de 2023 listada antes do visto de 2021 dava o contrário de
   * uma listada depois. O mesmo dado, duas respostas.
   */
  const porEpisodio = new Map<string, WatchedEpisode>();
  for (const ep of data.episodes) {
    // órfão → reatribui à série homónima; se não houver, mantém o UUID original
    const showUuid = showUuids.has(ep.seriesUuid)
      ? ep.seriesUuid
      : (followedByName.get(ep.seriesName) ?? ep.seriesUuid);
    const id = episodeKey(showUuid, ep.season, ep.episode);
    const anterior = porEpisodio.get(id);
    if (anterior && anterior.watchedAt >= ep.watchedAt) {
      // a que fica é mais recente; ainda assim, uma data exata vale mais do
      // que a data de um registo em massa com o mesmo instante
      if (!(anterior.watchedAt === ep.watchedAt && ep.dateIsExact && !anterior.dateIsExact)) continue;
    }
    porEpisodio.set(id, {
      id,
      showUuid,
      season: ep.season,
      episode: ep.episode,
      watchedAt: ep.watchedAt,
      dateIsExact: ep.dateIsExact,
      // O id do episódio no TheTVDB é a única chave estável entre sistemas
      // (ver `WatchedEpisode`). No export real todas as linhas o trazem — as
      // 3416 de visto e as 6 de revisão — mas se uma vencedora vier sem ele,
      // fica o que já se sabia: perder uma chave estável é sempre pior.
      episodeTvdbId: ep.episodeTvdbId ?? anterior?.episodeTvdbId ?? null,
    });
  }
  for (const ep of porEpisodio.values()) void tx.objectStore("watched").put(ep);
  for (const movie of data.movies) {
    void tx.objectStore("movies").put({
      key: movie.key,
      name: movie.name,
      watchedAt: movie.watchedAt,
      dateIsExact: movie.dateIsExact,
      releaseDate: movie.releaseDate ?? null,
      // um filme "para ver" não tem data de visto, e a Biblioteca ordena
      // essa lista por entrada recente — sem isto ficavam todos empatados
      addedAt: movie.watchedAt ?? new Date().toISOString(),
    });
  }
  const meta: ImportMeta = {
    importedAt: new Date().toISOString(),
    totalSeriesRuntimeSec: data.stats.totalSeriesRuntimeSec,
    totalMoviesRuntimeSec: data.stats.totalMoviesRuntimeSec,
  };
  void tx.objectStore("kv").put(meta, "import-meta");
  // O import escreve direto, sem fila: a próxima sincronização envia tudo
  // (ver `garantirEsquema` no autosync)
  void tx.objectStore("kv").delete("cloud:esquema");
  await tx.done;
  await enfileirarKv("import-meta");
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
/**
 * Grava o que veio da cloud, JÁ JUNTO com o que havia cá (ver `linhas.ts`).
 * Substituía cada série pela da cloud — e como a cloud não tinha a
 * numeração, cada "Sincronizar agora" apagava-a no telemóvel.
 */
export async function mergeFromCloud(
  shows: StoredShow[],
  watched: WatchedEpisode[],
  movies: StoredMovie[],
): Promise<void> {
  const database = await db();
  const tx = database.transaction(["shows", "watched", "movies"], "readwrite");
  for (const show of shows) void tx.objectStore("shows").put(show);
  for (const ep of watched) void tx.objectStore("watched").put(ep);
  for (const movie of movies) void tx.objectStore("movies").put(movie);
  await tx.done;
}

export async function getShow(uuid: string): Promise<StoredShow | null> {
  const database = await db();
  return (await database.get("shows", uuid)) ?? null;
}

export async function putShow(show: StoredShow): Promise<void> {
  const database = await db();
  await database.put("shows", show);
  await enfileirarSerie(show.uuid);
}

async function enfileirarSerie(uuid: string): Promise<void> {
  await enqueueOp({
    key: `show:${uuid}`,
    kind: "show-upserted",
    showUuid: uuid,
    at: new Date().toISOString(),
  });
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
  await enfileirarSerie(uuid);
  return next;
}

/** Apaga a série e tudo o que lhe pertence, aqui e na cloud. Usado só pela
 *  limpeza de séries duplicadas — a cópia a apagar nunca tem episódios
 *  marcados, mas apagar os dela à mesma evita deixar linhas órfãs se isso
 *  mudar. */
export async function deleteShow(uuid: string): Promise<void> {
  const database = await db();
  const tx = database.transaction(["shows", "watched"], "readwrite");
  void tx.objectStore("shows").delete(uuid);
  const index = tx.objectStore("watched").index("by-show");
  let cursor = await index.openCursor(IDBKeyRange.only(uuid));
  while (cursor) {
    void cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
  await enqueueOp({
    key: `show:${uuid}`,
    kind: "show-deleted",
    showUuid: uuid,
    at: new Date().toISOString(),
  });
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

/**
 * Ver um episódio é começar a ver a série: se estava só em «Para ver»
 * (`inWatchlist` sem `followed`), passa a seguida e sai dessa lista. Não mexe
 * numa série que deixaste de seguir — essa só volta com um «Seguir» à mão.
 */
async function comecarASeguir(showUuid: string): Promise<void> {
  const show = await getShow(showUuid);
  if (show && show.inWatchlist && !show.followed) {
    await updateShow(showUuid, { followed: true, inWatchlist: false });
  }
}

/**
 * `at` só é passado por quem está a REPOR uma marcação antiga (o anular da
 * reparação da Fase P): sem ele, desfazer devolvia o episódio com a data de
 * hoje e a data original perdia-se — que é precisamente o que "reverter" não
 * pode fazer. No uso normal fica a hora atual.
 */
export async function markWatched(
  showUuid: string,
  season: number,
  episode: number,
  at?: string,
): Promise<void> {
  const database = await db();
  const watchedAt = at ?? new Date().toISOString();
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
    at: new Date().toISOString(),
  });
  // repor uma marcação antiga (`at`) não é ver nada agora
  if (!at) await comecarASeguir(showUuid);
}

/**
 * Marca muitos episódios de uma vez, numa só escrita.
 *
 * Existe para o "vi tudo" e para os buracos: marcar os 465 episódios do
 * Grey's Anatomy um a um eram mais de 900 escritas no telemóvel. E marca-os
 * com `exata: false` — sabes que os viste, não sabes quando, e sem isto as
 * estatísticas diziam que tinhas visto 465 episódios hoje.
 */
export async function markWatchedMany(
  showUuid: string,
  episodios: { season: number; episode: number }[],
  { exata }: { exata: boolean },
): Promise<void> {
  if (episodios.length === 0) return;
  const database = await db();
  const agora = new Date().toISOString();
  const tx = database.transaction(["watched", "outbox"], "readwrite");
  for (const { season, episode } of episodios) {
    void tx.objectStore("watched").put({
      id: episodeKey(showUuid, season, episode),
      showUuid,
      season,
      episode,
      watchedAt: agora,
      dateIsExact: exata,
    });
    void tx.objectStore("outbox").put({
      key: `ep:${episodeKey(showUuid, season, episode)}`,
      kind: "episode-watched",
      showUuid,
      season,
      episode,
      watchedAt: agora,
      dateIsExact: exata,
      at: agora,
    } satisfies EpisodeOp);
  }
  await tx.done;
  await comecarASeguir(showUuid);
  if (typeof window !== "undefined") {
    void import("./autosync").then((m) => m.scheduleFlush());
  }
}

/** O inverso, para o anular de uma marcação em lote. */
export async function unmarkWatchedMany(
  showUuid: string,
  episodios: { season: number; episode: number }[],
): Promise<void> {
  if (episodios.length === 0) return;
  const database = await db();
  const agora = new Date().toISOString();
  const tx = database.transaction(["watched", "outbox"], "readwrite");
  for (const { season, episode } of episodios) {
    void tx.objectStore("watched").delete(episodeKey(showUuid, season, episode));
    void tx.objectStore("outbox").put({
      key: `ep:${episodeKey(showUuid, season, episode)}`,
      kind: "episode-unwatched",
      showUuid,
      season,
      episode,
      watchedAt: agora,
      at: agora,
    } satisfies EpisodeOp);
  }
  await tx.done;
  if (typeof window !== "undefined") {
    void import("./autosync").then((m) => m.scheduleFlush());
  }
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
  await enqueueOp({
    key: `movie:${movie.key}`,
    kind: "movie-watched",
    movieKey: movie.key,
    name: movie.name,
    dateIsExact: movie.dateIsExact,
    watchedAt: movie.watchedAt,
    at: new Date().toISOString(),
  });
}

export async function deleteMovie(key: string): Promise<void> {
  const database = await db();
  const current = await database.get("movies", key);
  await database.delete("movies", key);
  await enqueueOp({
    key: `movie:${key}`,
    kind: "movie-unwatched",
    movieKey: key,
    name: current?.name ?? "",
    dateIsExact: current?.dateIsExact ?? true,
    // null é um valor válido aqui (filme "para ver" apagado) — só cai para
    // agora se o registo já não existisse de todo
    watchedAt: current ? current.watchedAt : new Date().toISOString(),
    at: new Date().toISOString(),
  });
}

export async function updateMovie(
  key: string,
  patch: Partial<StoredMovie>,
): Promise<void> {
  const database = await db();
  const current = await database.get("movies", key);
  if (!current) return;
  const next = { ...current, ...patch, key };
  await database.put("movies", next);
  // o enriquecimento (id, capa, estreia, nomes) também sobe — antes só o
  // telemóvel o sabia, e uma instalação nova refazia-o pesquisando pelo nome
  await enqueueOp({
    key: `movie:${key}`,
    kind: "movie-watched",
    movieKey: key,
    name: next.name,
    dateIsExact: next.dateIsExact,
    watchedAt: next.watchedAt,
    at: new Date().toISOString(),
  });
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
  if (vaiParaANuvem(key)) await enfileirarKv(key);
}

/** Para gravar o que veio da cloud sem o mandar outra vez para lá. */
export async function kvSetDaNuvem(key: string, value: unknown): Promise<void> {
  const database = await db();
  await database.put("kv", value, key);
}

async function enfileirarKv(chave: ChaveNaNuvem): Promise<void> {
  await enqueueOp({ key: `kv:${chave}`, kind: "kv-upserted", chave, at: new Date().toISOString() });
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

/**
 * `crypto.randomUUID` só existe em contextos seguros (https ou localhost): no
 * iPhone, a abrir o servidor de desenvolvimento por `http://192.168…`, é
 * `undefined` e criar uma lista rebentava. `getRandomValues` existe sempre.
 */
function novoId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export async function createList(name: string): Promise<CustomList> {
  const database = await db();
  const list: CustomList = {
    id: novoId(),
    name,
    createdAt: new Date().toISOString(),
    items: [],
  };
  await database.put("lists", list);
  await enfileirarKv("listas");
  return list;
}

export async function renameList(id: string, name: string): Promise<void> {
  const database = await db();
  const list = await database.get("lists", id);
  if (!list) return;
  await database.put("lists", { ...list, name });
  await enfileirarKv("listas");
}

export async function deleteList(id: string): Promise<void> {
  const database = await db();
  await database.delete("lists", id);
  await enfileirarKv("listas");
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
  await enfileirarKv("listas");
}

/**
 * Repõe uma lista tal e qual — id, data de criação e itens incluídos.
 * Existe para o anular de "apagar lista": recriá-la com `createList` dava-lhe
 * um id novo e perdia a ordem e as datas de entrada dos itens.
 */
export async function restoreList(list: CustomList): Promise<void> {
  const database = await db();
  await database.put("lists", list);
  await enfileirarKv("listas");
}

/** As listas que vieram da cloud (instalação nova) — sem voltar a subi-las. */
export async function gravarListasDaNuvem(listas: CustomList[]): Promise<void> {
  const database = await db();
  const tx = database.transaction("lists", "readwrite");
  for (const lista of listas) void tx.objectStore("lists").put(lista);
  await tx.done;
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
  await enfileirarKv("listas");
}

/**
 * Faz as listas apontarem para `para` em vez de `de`. Serve para juntar
 * duplicados: a cópia que sai pode estar numa lista tua, e sem isto essa
 * lista ficava com um item a apontar para nada. Se a lista já tiver os dois,
 * fica só um.
 */
export async function reapontarListas(
  kind: ListItem["kind"],
  de: string,
  para: string,
): Promise<void> {
  const database = await db();
  const listas = await database.getAll("lists");
  for (const lista of listas) {
    if (!lista.items.some((i) => i.kind === kind && i.refId === de)) continue;
    const vistos = new Set<string>();
    const items = lista.items
      .map((i) => (i.kind === kind && i.refId === de ? { ...i, refId: para } : i))
      .filter((i) => {
        const chave = `${i.kind}:${i.refId}`;
        if (vistos.has(chave)) return false;
        vistos.add(chave);
        return true;
      });
    await database.put("lists", { ...lista, items });
    await enfileirarKv("listas");
  }
}
