// Modelo limpo extraído do export GDPR do TV Time.
// Todos os IDs externos (série e episódio) são da TheTVDB — o TV Time era
// construído sobre essa base de dados. O TMDB consegue mapeá-los via /find.

export interface TvTimeStats {
  epWatchCount: number | null;
  movieWatchCount: number | null;
  totalSeriesRuntimeSec: number | null;
  totalMoviesRuntimeSec: number | null;
}

export interface TvTimeShow {
  uuid: string;
  tvdbId: number | null;
  name: string;
  followed: boolean;
  inWatchlist: boolean;
  archived: boolean;
  createdAt: string;
}

export interface TvTimeEpisodeWatch {
  seriesUuid: string;
  seriesTvdbId: number | null;
  seriesName: string;
  season: number;
  episode: number;
  episodeTvdbId: number | null;
  rewatchCount: number;
  watchedAt: string;
  // true quando o export traz o timestamp real do check-in (gsi);
  // false quando a data é a do registo em massa (ex.: marcar temporada inteira)
  dateIsExact: boolean;
}

export interface TvTimeMovieWatch {
  key: string;
  name: string;
  watchedAt: string;
  dateIsExact: boolean;
  /** data de estreia (YYYY-MM-DD) — ajuda a casar com a TMDB sem ambiguidade */
  releaseDate?: string | null;
}

export interface TvTimeEmotion {
  seriesName: string;
  season: number | null;
  episode: number | null;
  episodeTvdbId: number | null;
  emotionId: number;
  createdAt: string;
}

export interface TvTimeExport {
  stats: TvTimeStats;
  shows: TvTimeShow[];
  episodes: TvTimeEpisodeWatch[];
  movies: TvTimeMovieWatch[];
  emotions: TvTimeEmotion[];
  // prefixos de `key` que o parser não reconheceu → contagem,
  // para detetarmos tipos de linha novos num export diferente
  unknownKeys: Record<string, number>;
}
