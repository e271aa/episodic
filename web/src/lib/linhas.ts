import {
  episodeKey,
  type StoredMovie,
  type StoredShow,
  type WatchedEpisode,
} from "./db";

/**
 * A conversão entre o que a app guarda e as linhas da cloud — e as regras de
 * junção quando elas voltam.
 *
 * Estava dentro do `cloud.ts`, sem testes, e perdia coisas nos dois sentidos
 * (medido na Ronda 12):
 *
 *  · na IDA, nunca subiam a numeração das séries, os nomes alternativos, e dos
 *    filmes a estreia, o id, a capa, os nomes e a data de entrada
 *  · na VOLTA, cada série local era SUBSTITUÍDA pela da cloud. Como a cloud
 *    não tinha a numeração, carregar em "Sincronizar agora" apagava-a no
 *    telemóvel — e 11 séries mudavam de numeração por baixo (729 marcações)
 *
 * Aqui não há rede nem IndexedDB: é o que permite provar por teste que tudo o
 * que a app sabe vai e volta igual.
 */

// ── Séries ────────────────────────────────────────────────────

export function showToRow(s: StoredShow, userId: string) {
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
    tmdb_aliases: s.tmdbAliases ?? null,
    numeracao: s.numeracao ?? null,
    followed: s.followed,
    in_watchlist: s.inWatchlist,
    archived: s.archived,
    added_at: s.addedAt,
    updated_at: new Date().toISOString(),
  };
}

export interface ShowRow {
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
  /** só existem depois de correr `ronda12-sync-completo.sql` */
  tmdb_aliases?: string[] | null;
  numeracao?: string | null;
  followed: boolean;
  in_watchlist: boolean;
  archived: boolean;
  added_at: string;
}

export function rowToShow(r: ShowRow): StoredShow {
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
    ...(r.tmdb_aliases ? { tmdbAliases: r.tmdb_aliases } : null),
    ...(r.numeracao === "tmdb" || r.numeracao === "tvmaze" ? { numeracao: r.numeracao } : null),
    followed: r.followed,
    inWatchlist: r.in_watchlist,
    archived: r.archived,
    addedAt: r.added_at,
  };
}

/**
 * A série que fica depois de juntar a local com a que veio da cloud.
 *
 * O que é INTENÇÃO (seguir, arquivar, para ver, o nome) vem da cloud — é
 * assim que uma mudança feita noutro dispositivo chega aqui. O que é SABER
 * (ids, numeração, capa, totais, nomes alternativos) só entra se a cloud o
 * tiver: um vazio na cloud quer dizer "a cloud não sabe", nunca "apaga".
 */
export function juntarSerie(local: StoredShow | undefined, nuvem: StoredShow): StoredShow {
  if (!local) return nuvem;
  const saber = Object.fromEntries(
    Object.entries(nuvem).filter(([, v]) => v !== null && v !== undefined),
  ) as Partial<StoredShow>;
  return {
    ...local,
    ...saber,
    name: nuvem.name,
    followed: nuvem.followed,
    inWatchlist: nuvem.inWatchlist,
    archived: nuvem.archived,
  };
}

// ── Episódios ─────────────────────────────────────────────────

export function watchedToRow(w: WatchedEpisode, userId: string) {
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

export interface WatchedRow {
  show_uuid: string;
  season: number;
  episode: number;
  watched_at: string;
  date_is_exact: boolean;
}

export function rowToWatched(r: WatchedRow): WatchedEpisode {
  return {
    id: episodeKey(r.show_uuid, r.season, r.episode),
    showUuid: r.show_uuid,
    season: r.season,
    episode: r.episode,
    watchedAt: r.watched_at,
    dateIsExact: r.date_is_exact,
  };
}

/** O id do TheTVDB do episódio só existe no telemóvel (veio do import) —
 *  a cloud não o apaga. */
export function juntarEpisodio(
  local: WatchedEpisode | undefined,
  nuvem: WatchedEpisode,
): WatchedEpisode {
  return local?.episodeTvdbId != null ? { ...nuvem, episodeTvdbId: local.episodeTvdbId } : nuvem;
}

// ── Filmes ────────────────────────────────────────────────────

export function movieToRow(m: StoredMovie, userId: string) {
  return {
    user_id: userId,
    key: m.key,
    name: m.name,
    watched_at: m.watchedAt,
    date_is_exact: m.dateIsExact,
    tmdb_id: m.tmdbId ?? null,
    release_date: m.releaseDate ?? null,
    added_at: m.addedAt ?? null,
    poster_path: m.posterPath ?? null,
    aliases: m.aliases ?? null,
    updated_at: new Date().toISOString(),
  };
}

export interface MovieRow {
  key: string;
  name: string;
  watched_at: string | null;
  date_is_exact: boolean;
  /** só existem depois de correr `ronda12-sync-completo.sql` */
  tmdb_id?: number | null;
  release_date?: string | null;
  added_at?: string | null;
  poster_path?: string | null;
  aliases?: string[] | null;
}

export function rowToMovie(r: MovieRow): StoredMovie {
  return {
    key: r.key,
    name: r.name,
    watchedAt: r.watched_at,
    dateIsExact: r.date_is_exact,
    ...(r.tmdb_id != null ? { tmdbId: r.tmdb_id } : null),
    ...(r.release_date != null ? { releaseDate: r.release_date } : null),
    ...(r.added_at != null ? { addedAt: r.added_at } : null),
    ...(r.poster_path != null ? { posterPath: r.poster_path } : null),
    ...(r.aliases != null ? { aliases: r.aliases } : null),
  };
}

/**
 * O filme depois de juntar. `watchedAt` vem SEMPRE da cloud, mesmo vazio —
 * vazio num filme quer dizer "para ver", não "não sei". O resto só entra se a
 * cloud o tiver.
 */
export function juntarFilme(local: StoredMovie | undefined, nuvem: StoredMovie): StoredMovie {
  return { ...local, ...nuvem };
}

// ── O resto: listas, horas do import, respostas ───────────────

export interface KvRow {
  key: string;
  value: unknown;
}


/**
 * Para estas, a cloud é um cofre, não um espelho: se o telemóvel já tem o
 * valor, fica o do telemóvel; se não tem (instalação nova), vem o da cloud.
 * Juntar listas elemento a elemento faria voltar as que apagaste enquanto
 * estavas sem rede.
 */
export function juntarKv<T>(local: T | null | undefined, nuvem: T): T {
  if (local === null || local === undefined) return nuvem;
  if (Array.isArray(local) && local.length === 0) return nuvem;
  return local;
}

// ── A prova: o que está na cloud chega para uma instalação nova? ──────────

export interface Contagem {
  series: number;
  episodios: number;
  filmes: number;
  listas: number;
  /** `null` na cloud = a coluna ainda não existe (falta o SQL da Ronda 12) */
  seriesComNumeracao: number | null;
}

export interface LinhaDaProva {
  nome: string;
  local: number;
  nuvem: number | null;
  certo: boolean;
}

/**
 * Compara o telemóvel com a cloud. É a prova que a Fase 2 pedia — "uma
 * instalação nova recupera a biblioteca inteira?" — sem precisar de uma
 * janela privada: se a cloud tem o mesmo que o telemóvel, com a numeração,
 * a instalação nova recebe o mesmo (a conversão de volta está provada nos
 * testes de `linhas.ts`).
 *
 * A cloud com MAIS também é diferença: seriam coisas que apagaste aqui e
 * voltariam numa instalação nova.
 */
export function compararComNuvem(
  local: Contagem,
  nuvem: Contagem,
): { linhas: LinhaDaProva[]; tudoCerto: boolean; faltaSql: boolean } {
  const linhas: LinhaDaProva[] = [
    { nome: "Séries", local: local.series, nuvem: nuvem.series, certo: false },
    { nome: "Episódios vistos", local: local.episodios, nuvem: nuvem.episodios, certo: false },
    { nome: "Filmes", local: local.filmes, nuvem: nuvem.filmes, certo: false },
    { nome: "Listas", local: local.listas, nuvem: nuvem.listas, certo: false },
    {
      nome: "Séries com numeração",
      local: local.seriesComNumeracao ?? 0,
      nuvem: nuvem.seriesComNumeracao,
      certo: false,
    },
  ].map((l) => ({ ...l, certo: l.nuvem === l.local }));
  const faltaSql = nuvem.seriesComNumeracao === null;
  return { linhas, tudoCerto: !faltaSql && linhas.every((l) => l.certo), faltaSql };
}
