-- Episodic — esquema Supabase (Postgres)
-- Cola tudo isto no SQL Editor do teu projeto Supabase e corre uma vez.
-- Espelha o modelo local (IndexedDB): cada linha pertence a um utilizador,
-- e a Row Level Security garante que cada um só vê/edita o que é seu.

-- ─────────────────────────────────────────────────────────────
-- profiles: 1 linha por utilizador (id = auth.users.id)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text,
  created_at timestamptz not null default now()
);

-- Migração (26-07): cartão de identidade do perfil. `add column if not
-- exists` é seguro correr outra vez — não mexe no que já existe.
alter table public.profiles add column if not exists display_name        text;
alter table public.profiles add column if not exists avatar_url          text;
alter table public.profiles add column if not exists favorite_show_uuid  text;
alter table public.profiles add column if not exists favorite_character  text;
alter table public.profiles add column if not exists favorite_actor      text;
alter table public.profiles add column if not exists favorite_person_img text;
alter table public.profiles add column if not exists updated_at          timestamptz not null default now();

-- Cria o perfil automaticamente quando um utilizador se regista
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- shows: séries seguidas / watchlist / arquivadas (com metadados)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.shows (
  user_id        uuid not null references auth.users (id) on delete cascade,
  uuid           text not null,                 -- uuid do TV Time ou "tmdb-<id>"
  name           text not null,
  tvdb_id        integer,
  tmdb_id        integer,
  tvmaze_id      integer,
  poster_path    text,
  backdrop_path  text,
  overview       text,
  total_episodes integer,
  first_aired    text,
  status         text,
  genres         text[],
  imdb_id        text,
  followed       boolean not null default false,
  in_watchlist   boolean not null default false,
  archived       boolean not null default false,
  added_at       timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (user_id, uuid)
);

-- ─────────────────────────────────────────────────────────────
-- watched_episodes: 1 linha por episódio visto
-- ─────────────────────────────────────────────────────────────
create table if not exists public.watched_episodes (
  user_id       uuid not null references auth.users (id) on delete cascade,
  show_uuid     text not null,
  season        integer not null,
  episode       integer not null,
  watched_at    timestamptz not null default now(),
  date_is_exact boolean not null default true,
  updated_at    timestamptz not null default now(),
  primary key (user_id, show_uuid, season, episode)
);

create index if not exists watched_episodes_by_show
  on public.watched_episodes (user_id, show_uuid);

-- ─────────────────────────────────────────────────────────────
-- watched_movies: 1 linha por filme visto OU por ver (watched_at null =
-- ainda não visto, está só na lista "para ver")
-- ─────────────────────────────────────────────────────────────
create table if not exists public.watched_movies (
  user_id       uuid not null references auth.users (id) on delete cascade,
  key           text not null,
  name          text not null,
  watched_at    timestamptz,
  date_is_exact boolean not null default true,
  updated_at    timestamptz not null default now(),
  primary key (user_id, key)
);

-- Migração (pedido 26-07): se já correste este schema antes, a tabela existe
-- com watched_at NOT NULL — corre isto UMA VEZ no SQL Editor para libertar a
-- coluna (o "create table if not exists" acima não mexe em tabelas existentes).
alter table public.watched_movies alter column watched_at drop not null;
alter table public.watched_movies alter column watched_at drop default;

-- Ronda 12: o que até aqui só o telemóvel sabia (ver ronda12-sync-completo.sql)
alter table public.shows add column if not exists numeracao text;
alter table public.shows add column if not exists tmdb_aliases text[];
alter table public.watched_movies add column if not exists tmdb_id integer;
alter table public.watched_movies add column if not exists release_date text;
alter table public.watched_movies add column if not exists added_at timestamptz;
alter table public.watched_movies add column if not exists poster_path text;
alter table public.watched_movies add column if not exists aliases text[];

create table if not exists public.user_kv (
  user_id    uuid not null references auth.users (id) on delete cascade,
  key        text not null,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security: cada utilizador só acede às suas linhas
-- ─────────────────────────────────────────────────────────────
alter table public.profiles         enable row level security;
alter table public.shows            enable row level security;
alter table public.watched_episodes enable row level security;
alter table public.watched_movies   enable row level security;
alter table public.user_kv          enable row level security;

-- profiles: o dono lê e edita o seu perfil
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- shows / watched_*: o dono faz tudo nas suas linhas
drop policy if exists "own shows" on public.shows;
create policy "own shows" on public.shows
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own watched episodes" on public.watched_episodes;
create policy "own watched episodes" on public.watched_episodes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own watched movies" on public.watched_movies;
create policy "own watched movies" on public.watched_movies
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own kv" on public.user_kv;
create policy "own kv" on public.user_kv
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- Storage: fotos de perfil (26-07)
-- ─────────────────────────────────────────────────────────────
-- Bucket público: os avatares são para ser vistos, e um bucket privado
-- obrigaria a assinar cada URL. O que protege é a política de escrita —
-- cada um só escreve dentro da pasta com o seu próprio id.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatares visíveis" on storage.objects;
create policy "avatares visíveis" on storage.objects
  for select using (bucket_id = 'avatars');

-- O caminho tem de começar pelo id do utilizador: "<uid>/qualquer-coisa.jpg"
drop policy if exists "avatar próprio: criar" on storage.objects;
create policy "avatar próprio: criar" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- O `with check` é tão importante como o `using`: sem ele, uma atualização
-- podia mover o ficheiro para a pasta de outro utilizador.
drop policy if exists "avatar próprio: substituir" on storage.objects;
create policy "avatar próprio: substituir" on storage.objects
  for update
  using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatar próprio: apagar" on storage.objects;
create policy "avatar próprio: apagar" on storage.objects
  for delete using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );
