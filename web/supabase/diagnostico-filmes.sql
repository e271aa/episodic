-- ─────────────────────────────────────────────────────────────
-- Ronda 12 · Fase 0 — os filmes que ficam em "para ver" depois de vistos
--
-- Causa encontrada e reproduzida: marcar um filme como visto a partir da
-- PESQUISA da Biblioteca cria um segundo registo (chave "tmdb-<id>") em vez
-- de atualizar o que já lá estava (chave do TV Time). O original fica com
-- watched_at vazio — e por isso continua em "para ver".
--
-- Aqui a tabela não guarda o id da TMDB, só o nome. Os duplicados não se
-- apanham por SQL: o original chama-se "The Shawshank Redemption" e o novo
-- "Os Condenados de Shawshank". Vem a lista inteira e o cruzamento com a
-- TMDB é feito do meu lado.
--
-- COMO CORRER
--   1. Cola no SQL Editor do Supabase e corre
--   2. No canto do resultado: "Download CSV"
--   3. Manda-me o ficheiro
--
-- Só lê. Não altera nada.
-- ─────────────────────────────────────────────────────────────

select
  m.key                              as chave,
  m.name                             as nome,
  m.watched_at                       as visto_em,
  m.key like 'tmdb-%'                as veio_da_app,
  m.updated_at                       as alterado_em
from public.watched_movies m
where m.user_id = (select id from auth.users where email = 'rubentinocomartins2001@gmail.com')
order by lower(m.name), m.watched_at nulls first;
