-- ─────────────────────────────────────────────────────────────
-- Séries repetidas na biblioteca — só LEITURA, não altera nada
--
-- Junta séries cujo nome normalizado é igual (minúsculas, sem acentos,
-- sem pontuação) OU que partilham o mesmo id TMDB. Para cada uma diz
-- quantos episódios tem marcados, que é o que decide qual fica.
--
-- A app já sabe fazer esta limpeza sozinha (Perfil → Verificar
-- biblioteca), e a partir de agora a remoção também sobe para a cloud.
-- Esta query serve para eu ver a dimensão real do problema antes de
-- confiares na limpeza automática.
--
-- Corre e manda-me o resultado (Download CSV, ou copia e cola).
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
    -- mesma normalização que a app usa: minúsculas, sem acentos, só
    -- letras e números, espaços colapsados
    trim(regexp_replace(lower(unaccent(s.name)), '[^a-z0-9]+', ' ', 'g')) as nome_normalizado,
    (
      select count(*)
      from public.watched_episodes w
      where w.user_id = s.user_id and w.show_uuid = s.uuid
    ) as episodios_marcados
  from public.shows s
  where s.user_id = (select id from auth.users where email = 'rubentinocomartins2001@gmail.com')
),
grupos as (
  select
    *,
    count(*)      over (partition by nome_normalizado) as no_grupo_por_nome,
    count(*)      over (partition by tmdb_id)          as no_grupo_por_tmdb
  from minhas
)
select
  nome_normalizado,
  name            as nome_guardado,
  uuid,
  tmdb_id,
  tvdb_id,
  tvmaze_id,
  episodios_marcados,
  followed        as a_seguir,
  in_watchlist    as para_ver,
  archived        as arquivada,
  added_at        as adicionada_em
from grupos
where no_grupo_por_nome > 1
   or (tmdb_id is not null and no_grupo_por_tmdb > 1)
order by nome_normalizado, episodios_marcados desc;


-- ── SE DER ERRO NO `unaccent` ─────────────────────────────────
-- A extensão pode não estar ligada. Corre isto uma vez e repete a
-- query acima:
--
--   create extension if not exists unaccent;
--
-- Se não quiseres instalar extensões, troca a linha do
-- `nome_normalizado` por esta versão sem acentos tratados (apanha na
-- mesma o Arrow e o Prison Break, que não têm acentos):
--
--   trim(regexp_replace(lower(s.name), '[^a-z0-9]+', ' ', 'g'))
