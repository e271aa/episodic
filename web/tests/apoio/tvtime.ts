/**
 * Um export GDPR do TV Time, falso mas com a **forma** do verdadeiro.
 *
 * Os cabeçalhos e os tipos de linha foram tirados do export real do Ruben
 * (3416 `watch-episode`, 135 `user-series`, 6 `rewatch-episode`, 1
 * `tracking-stats` no v2; `watch`/`towatch`/`follow`/`rewatch_count` de filmes
 * no v1). O conteúdo é inventado — nada de dados pessoais no repositório.
 *
 * Cada caso aqui existe porque existe no export real:
 *  · datas exatas via `gsi` (3112) e datas do registo em massa (310)
 *  · um episódio **órfão** — uuid de série sem `user-series`, recuperável pelo
 *    nome (1 no export real: é o caso que duplicava o Prison Break)
 *  · `rewatch-episode` do mesmo episódio, que tem de colapsar
 *  · filmes `towatch` (22 reais), que são "para ver" e não vistos
 */

const CABECALHO_V2 =
  "updated_at,user_id,created_at,total_movies_runtime,ep_watch_count,movie_watch_count," +
  "total_series_runtime,key,s_id,is_followed,is_for_later,most_recent_ep_watched,is_archived," +
  "uuid,is_unitary,s_no,ep_id,rewatch_count,ep_no,gsi,movie_name,series_name,season_number,episode_number";

const CABECALHO_V1 =
  "type-uuid-n,created_at,type,user_id,watch_count,uuid,series_id,updated_at,watches," +
  "follow_date_range_key,entity_type,release_date,release_date_range_key,alpha_range_key,runtime," +
  "rewatch_count,series_uuid,season_number,episode_id,episode_number,watch_date," +
  "watched_episode_range_key,total_series_runtime,total_movies_runtime,watch_date_range_key," +
  "unitarian,country,bulk_type,movie_name,series_name";

const linha = (cabecalho: string, campos: Record<string, string>): string =>
  cabecalho
    .split(",")
    .map((c) => {
      const v = campos[c] ?? "";
      return v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
    })
    .join(",");

export const UUID_A = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
export const UUID_B = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";
export const UUID_C = "cccccccc-3333-4333-8333-cccccccccccc";
/** uuid sem `user-series` — os episódios dele são órfãos */
export const UUID_ORFAO = "dddddddd-4444-4444-8444-dddddddddddd";

const serie = (uuid: string, nome: string, tvdb: string, campos: Record<string, string>) =>
  linha(CABECALHO_V2, {
    key: `user-series-${uuid}`,
    uuid,
    series_name: nome,
    s_id: tvdb,
    created_at: "2019-05-02 10:00:00",
    is_followed: "false",
    is_for_later: "false",
    is_archived: "false",
    ...campos,
  });

const episodio = (
  uuidSerie: string,
  nome: string,
  temporada: number,
  ep: number,
  opcoes: { gsi?: string; epId?: string; rewatch?: boolean } = {},
) =>
  linha(CABECALHO_V2, {
    key: `${opcoes.rewatch ? "rewatch" : "watch"}-episode-${uuidSerie}-${ep}f7cbcacd-0000`,
    series_name: nome,
    s_no: String(temporada),
    ep_no: String(ep),
    ep_id: opcoes.epId ?? "",
    gsi: opcoes.gsi ?? "",
    created_at: "2021-03-10 21:15:00",
  });

/** O v2: séries, episódios e os totais da conta. */
export function trackingV2(): string {
  return [
    CABECALHO_V2,
    linha(CABECALHO_V2, {
      key: "tracking-stats",
      ep_watch_count: "5",
      movie_watch_count: "2",
      total_series_runtime: "12600",
      total_movies_runtime: "7200",
    }),
    serie(UUID_A, "Serie Seguida", "111111", { is_followed: "true" }),
    serie(UUID_B, "Serie Para Ver", "222222", { is_for_later: "true" }),
    serie(UUID_C, "Serie Arquivada", "333333", { is_archived: "true" }),
    // duas com o momento exato do check-in, uma só com a data do registo
    episodio(UUID_A, "Serie Seguida", 1, 1, { gsi: "watch-episode-1615000000", epId: "5001" }),
    episodio(UUID_A, "Serie Seguida", 1, 2, { gsi: "watch-episode-1615086400", epId: "5002" }),
    episodio(UUID_A, "Serie Seguida", 1, 3, { epId: "5003" }),
    // revisão do MESMO episódio — tem de colapsar, não contar duas vezes.
    // Esta é MAIS RECENTE que o visto original: fica ela.
    episodio(UUID_A, "Serie Seguida", 1, 1, { gsi: "watch-episode-1700000000", epId: "5001", rewatch: true }),
    // E esta é MAIS ANTIGA que o visto do E02, mas vem depois no ficheiro:
    // se o resultado dependesse da ordem das linhas, esta ganhava.
    episodio(UUID_A, "Serie Seguida", 1, 2, { gsi: "watch-episode-1500000000", epId: "5002", rewatch: true }),
    // órfão: uuid sem `user-series`, mas com o nome de uma série seguida
    episodio(UUID_ORFAO, "Serie Seguida", 2, 1, { gsi: "watch-episode-1650000000" }),
    // um tipo de linha que a app ainda não interpreta
    linha(CABECALHO_V2, { key: "list-item-eeeeeeee-5555-4555-8555-eeeeeeeeeeee" }),
  ].join("\n");
}

/** O v1: é aqui que vivem os filmes. */
export function trackingV1(): string {
  const filme = (
    tipo: string,
    uuid: string,
    nome: string,
    campos: Record<string, string> = {},
  ) =>
    linha(CABECALHO_V1, {
      type: tipo,
      entity_type: "movie",
      uuid,
      movie_name: nome,
      created_at: "2023-07-04 19:30:00",
      ...campos,
    });

  return [
    CABECALHO_V1,
    filme("watch", "m-visto-1", "Filme Visto Um", {
      watch_date: "2023-07-04 19:30:00",
      release_date: "2016-11-04 00:00:00",
    }),
    filme("watch", "m-visto-2", "Filme Visto Dois", { watch_date: "2022-01-09 22:00:00" }),
    // marcado "para ver" no TV Time: tem nome e uuid, e não tem data de visto
    filme("towatch", "m-para-ver", "Filme Para Ver"),
    // ruído que o parser deve ignorar
    filme("rewatch_count", "m-visto-1", "Filme Visto Um", { rewatch_count: "2" }),
    filme("follow", "m-seguido", "Filme Seguido"),
  ].join("\n");
}

/** Como o Playwright os entrega ao `<input type=file>`. */
export function ficheirosDoExport() {
  return [
    {
      name: "tracking-prod-records-v2.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(trackingV2(), "utf8"),
    },
    {
      name: "tracking-prod-records.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(trackingV1(), "utf8"),
    },
  ];
}
