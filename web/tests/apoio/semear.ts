import type { Page } from "@playwright/test";

/**
 * Põe dados na base local antes de a app abrir.
 *
 * A app guarda tudo em IndexedDB ("tvlog", v4 — ver `src/lib/db.ts`). Um teste
 * que comece por importar um ficheiro do TV Time demoraria segundos e testaria
 * o importador em vez do ecrã em causa; escrever direto na base é instantâneo
 * e deixa cada teste dizer exatamente de que estado parte.
 *
 * O esquema está repetido aqui de propósito: se alguém mudar a versão ou os
 * stores em `db.ts` sem mexer nisto, os testes falham — que é o que se quer.
 * Um helper que importasse `db.ts` seguiria a mudança em silêncio.
 */

export interface SerieSemeada {
  uuid: string;
  name: string;
  tvdbId?: number | null;
  tmdbId?: number | null;
  tvmazeId?: number | null;
  posterPath?: string | null;
  backdropPath?: string | null;
  totalEpisodes?: number | null;
  status?: string | null;
  genres?: string[] | null;
  /** qual dos fornecedores define a numeração — ver `StoredShow.numeracao` */
  numeracao?: "tmdb" | "tvmaze";
  /** minutos de um episódio típico — ver `StoredShow.runtime` */
  runtime?: number | null;
  /** data de estreia (ISO) — ver `StoredShow.firstAired` */
  firstAired?: string | null;
  followed?: boolean;
  inWatchlist?: boolean;
  archived?: boolean;
  addedAt?: string;
}

export interface EpisodioVisto {
  showUuid: string;
  season: number;
  episode: number;
  watchedAt?: string;
  /** false = data da marcação, não do visto (import em massa, "vi tudo") */
  dateIsExact?: boolean;
}

export interface FilmeSemeado {
  key: string;
  name: string;
  /** null = está em "para ver" */
  watchedAt?: string | null;
  releaseDate?: string | null;
  posterPath?: string | null;
  tmdbId?: number | null;
  addedAt?: string;
}

export interface ListaSemeada {
  id: string;
  name: string;
  items?: { kind: "show" | "movie"; refId: string; addedAt?: string }[];
  createdAt?: string;
}

export interface Semente {
  series?: SerieSemeada[];
  vistos?: EpisodioVisto[];
  filmes?: FilmeSemeado[];
  listas?: ListaSemeada[];
  /** entradas cruas do store `kv` (ex.: "nextup-cache", preferências) */
  kv?: Record<string, unknown>;
}

interface Registos {
  shows: Record<string, unknown>[];
  watched: Record<string, unknown>[];
  movies: Record<string, unknown>[];
  lists: Record<string, unknown>[];
  kv: [string, unknown][];
}

const ONTEM = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

function registos(semente: Semente): Registos {
  return {
    shows: (semente.series ?? []).map((s) => ({
      uuid: s.uuid,
      name: s.name,
      tvdbId: s.tvdbId ?? null,
      tmdbId: s.tmdbId ?? null,
      tvmazeId: s.tvmazeId ?? null,
      posterPath: s.posterPath ?? null,
      backdropPath: s.backdropPath ?? null,
      overview: null,
      totalEpisodes: s.totalEpisodes ?? null,
      status: s.status ?? "Ended",
      genres: s.genres ?? null,
      ...(s.numeracao ? { numeracao: s.numeracao } : {}),
      ...(s.runtime !== undefined ? { runtime: s.runtime } : {}),
      ...(s.firstAired !== undefined ? { firstAired: s.firstAired } : {}),
      followed: s.followed ?? true,
      inWatchlist: s.inWatchlist ?? false,
      archived: s.archived ?? false,
      addedAt: s.addedAt ?? ONTEM,
    })),
    watched: (semente.vistos ?? []).map((v) => ({
      id: `${v.showUuid}:${v.season}:${v.episode}`,
      showUuid: v.showUuid,
      season: v.season,
      episode: v.episode,
      watchedAt: v.watchedAt ?? ONTEM,
      dateIsExact: v.dateIsExact ?? true,
    })),
    movies: (semente.filmes ?? []).map((f) => ({
      key: f.key,
      name: f.name,
      watchedAt: f.watchedAt ?? null,
      dateIsExact: true,
      releaseDate: f.releaseDate ?? null,
      addedAt: f.addedAt ?? ONTEM,
      tmdbId: f.tmdbId ?? null,
      posterPath: f.posterPath ?? null,
    })),
    lists: (semente.listas ?? []).map((l) => ({
      id: l.id,
      name: l.name,
      createdAt: l.createdAt ?? ONTEM,
      items: (l.items ?? []).map((i) => ({
        kind: i.kind,
        refId: i.refId,
        addedAt: i.addedAt ?? ONTEM,
      })),
    })),
    kv: [
      // As instruções da primeira utilização (arrastar o cartão) tapam a
      // pilha e apanham o toque. Um teste que tenha de as dispensar sempre
      // passa a testar as instruções em vez do ecrã — por omissão a app
      // parte do princípio de que já foi usada uma vez.
      ["em-dia:coach-visto", true] as [string, unknown],
      ["explorar:coach-visto", true] as [string, unknown],
      ...Object.entries(semente.kv ?? {}),
    ],
  };
}

/** Corre dentro do browser — não pode fechar sobre nada de fora. */
function escrever(dados: Registos): Promise<void> {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open("tvlog", 4);
    pedido.onupgradeneeded = () => {
      const base = pedido.result;
      if (!base.objectStoreNames.contains("kv")) base.createObjectStore("kv");
      if (!base.objectStoreNames.contains("shows"))
        base.createObjectStore("shows", { keyPath: "uuid" });
      if (!base.objectStoreNames.contains("watched")) {
        const watched = base.createObjectStore("watched", { keyPath: "id" });
        watched.createIndex("by-show", "showUuid");
      }
      if (!base.objectStoreNames.contains("movies"))
        base.createObjectStore("movies", { keyPath: "key" });
      if (!base.objectStoreNames.contains("lists"))
        base.createObjectStore("lists", { keyPath: "id" });
      if (!base.objectStoreNames.contains("outbox"))
        base.createObjectStore("outbox", { keyPath: "key" });
    };
    pedido.onerror = () => reject(pedido.error);
    pedido.onsuccess = () => {
      const base = pedido.result;
      const tx = base.transaction(["kv", "shows", "watched", "movies", "lists"], "readwrite");
      for (const s of dados.shows) tx.objectStore("shows").put(s);
      for (const w of dados.watched) tx.objectStore("watched").put(w);
      for (const m of dados.movies) tx.objectStore("movies").put(m);
      for (const l of dados.lists) tx.objectStore("lists").put(l);
      for (const [chave, valor] of dados.kv) tx.objectStore("kv").put(valor, chave);
      tx.oncomplete = () => {
        base.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
  });
}

/**
 * Escreve a semente e deixa a página pronta a navegar para onde o teste quiser.
 *
 * Passa primeiro pelo `/login` (a única rota leve e sempre pública) só para
 * ganhar a origem certa: escrever a partir de `about:blank` iria para uma
 * origem opaca, que a app nunca veria. E é escrito **antes** de a app abrir,
 * não num `addInitScript`, porque escrever é assíncrono — a app podia ler a
 * base a meio da escrita e o teste dependia de quem chegasse primeiro.
 */
export async function semear(page: Page, semente: Semente): Promise<void> {
  await page.goto("/login");
  await page.evaluate(escrever, registos(semente));
  // A dica "instala o Flicki no teu iPhone" só aparece no iOS — e os testes
  // correm precisamente num iPhone. Flutua sobre o fundo do ecrã e apanha os
  // toques das ações que vivem lá (as do "Pôr em dia", as do Explorar).
  await page.evaluate(() => localStorage.setItem("episodic-ios-install-dismissed", "1"));
}

/**
 * Preferências da app (`usePref`) — localStorage, não a base, e com o mesmo
 * prefixo que o `prefs.ts` usa. Chama-se com a chave nua ("explorar-modo").
 */
export async function preferir(page: Page, prefs: Record<string, string>): Promise<void> {
  await page.evaluate((entradas) => {
    for (const [chave, valor] of entradas) localStorage.setItem(`episodic:pref:${chave}`, valor);
  }, Object.entries(prefs));
}
