-- ─────────────────────────────────────────────────────────────
-- Ronda 12 · Fase 2 — a cloud passa a guardar tudo o que a app sabe
--
-- MEDIDO (25-09): uma instalação nova da app, a partir da cloud, perdia:
--   · a numeração de cada série (qual fornecedor manda nas temporadas) —
--     11 das tuas séries dividem as temporadas de forma diferente na TVmaze
--     e na TMDB, e 729 marcações mudavam de sítio (Naruto 220, Friends 163…)
--   · as tuas listas, inteiras
--   · dos filmes: estreia, id da TMDB, capa, nomes, data em que entraram
--   · as horas vistas do import, e o que respondeste no "Rever a biblioteca"
--
-- É isto que tem de estar certo ANTES de o nome novo chegar ao iPhone: o
-- iOS só mostra nome e ícone novos numa instalação nova, e apagar a app do
-- ecrã principal apaga os dados que ela guarda no telemóvel.
--
-- COMO CORRER
--   1. Cola no SQL Editor do Supabase e corre (Run)
--   2. Deve dizer "Success. No rows returned"
--   3. Diz-me que já está
--
-- Pode correr-se mais do que uma vez sem estragar nada (if not exists).
-- Não apaga nem altera nenhuma linha que já exista.
-- ─────────────────────────────────────────────────────────────

-- Séries: a numeração e os outros nomes
alter table public.shows add column if not exists numeracao text;
alter table public.shows add column if not exists tmdb_aliases text[];

-- Filmes: o que até aqui só o telemóvel sabia
alter table public.watched_movies add column if not exists tmdb_id integer;
alter table public.watched_movies add column if not exists release_date text;
alter table public.watched_movies add column if not exists added_at timestamptz;
alter table public.watched_movies add column if not exists poster_path text;
alter table public.watched_movies add column if not exists aliases text[];

-- O resto (listas, horas do import, respostas da revisão, o que dispensaste
-- no Explorar): pequeno, variado e sem pesquisas — uma linha por chave.
create table if not exists public.user_kv (
  user_id    uuid not null references auth.users (id) on delete cascade,
  key        text not null,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.user_kv enable row level security;

drop policy if exists "own kv" on public.user_kv;
create policy "own kv" on public.user_kv
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
