-- ─────────────────────────────────────────────────────────────
-- Fase P — recolha de dados para desenhar a migração
--
-- Uma linha por (série, temporada) com quantos episódios estão marcados e
-- até que número vão. É o suficiente para eu reconstruir a divisão de
-- temporadas com que cada série foi vista e compará-la, aqui do meu lado,
-- com o que o TMDB publica hoje (o tmdb_id vem na linha).
--
-- NÃO leva datas nem nada além disto: para o problema das temporadas só
-- interessam os números.
--
-- COMO CORRER
--   1. Cola no SQL Editor do Supabase e corre
--   2. No canto do resultado: "Download CSV"
--   3. Manda-me o ficheiro
--
-- Vem tudo, também as séries que estão bem — preciso delas para garantir
-- que a migração não parte o que já funciona.
-- ─────────────────────────────────────────────────────────────

select
  s.name                        as serie,
  s.uuid                        as uuid,
  s.tvdb_id                     as tvdb_id,
  s.tmdb_id                     as tmdb_id,
  s.tvmaze_id                   as tvmaze_id,
  s.total_episodes              as total_fornecedor,
  s.followed                    as a_seguir,
  s.archived                    as arquivada,
  w.season                      as temporada,
  count(*)                      as vistos,
  min(w.episode)                as episodio_min,
  max(w.episode)                as episodio_max,
  -- buracos: se vistos < (max - min + 1), a temporada tem falhas pelo meio,
  -- e isso muda o que a migração pode assumir com segurança
  (max(w.episode) - min(w.episode) + 1) - count(*) as em_falta
from public.shows s
join public.watched_episodes w
  on w.user_id = s.user_id
 and w.show_uuid = s.uuid
where s.user_id = (select id from auth.users where email = 'rubentinocomartins2001@gmail.com')
group by
  s.name, s.uuid, s.tvdb_id, s.tmdb_id, s.tvmaze_id,
  s.total_episodes, s.followed, s.archived, w.season
order by s.name, w.season;
