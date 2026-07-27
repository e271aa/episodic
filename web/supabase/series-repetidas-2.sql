-- ─────────────────────────────────────────────────────────────
-- Séries repetidas na cloud — LEITURA, não altera nada
--
-- Mais abrangente do que a primeira: além dos nomes repetidos, mostra
-- TUDO o que foi adicionado pelo Explorar (uuid começado por "tmdb-").
--
-- Porquê essa coluna: as séries só sobem para a cloud no "Sincronizar
-- agora". Adicionar pelo Explorar grava só no telemóvel. Se nunca
-- sincronizaste desde que adicionaste o Arrow e o Prison Break, eles
-- não aparecem aqui — e então não há nada para corrigir por SQL, a
-- limpeza tem mesmo de ser feita na app.
--
-- Corre e manda-me o resultado tal como vier.
-- ─────────────────────────────────────────────────────────────

with minhas as (
  select
    s.uuid,
    s.name,
    s.tmdb_id,
    s.tvdb_id,
    s.tvmaze_id,
    s.followed,
    s.in_watchlist,
    s.archived,
    s.added_at,
    trim(regexp_replace(lower(s.name), '[^a-z0-9]+', ' ', 'g')) as nome_norm,
    (
      select count(*)
      from public.watched_episodes w
      where w.user_id = s.user_id and w.show_uuid = s.uuid
    ) as episodios
  from public.shows s
  where s.user_id = (select id from auth.users where email = 'rubentinocomartins2001@gmail.com')
)
select
  case when uuid like 'tmdb-%' then 'Explorar' else 'TV Time' end as origem,
  nome_norm,
  name          as nome_guardado,
  uuid,
  tmdb_id,
  tvdb_id,
  tvmaze_id,
  episodios     as episodios_marcados,
  followed      as a_seguir,
  in_watchlist  as para_ver,
  archived      as arquivada,
  added_at      as adicionada_em,
  count(*) over (partition by nome_norm) as quantas_com_este_nome
from minhas
where
  -- nomes que aparecem mais do que uma vez
  nome_norm in (select nome_norm from minhas group by nome_norm having count(*) > 1)
  -- e tudo o que veio do Explorar, mesmo que o nome seja único
  or uuid like 'tmdb-%'
order by nome_norm, episodios desc, added_at;
