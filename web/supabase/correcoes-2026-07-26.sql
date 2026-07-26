-- ─────────────────────────────────────────────────────────────
-- Correções pontuais de datas de visto — 26-07-2026
--
-- Três filmes foram adicionados hoje e ficaram com a data de hoje, mas
-- foram vistos noutros anos. Só sabemos o ANO, por isso:
--   · watched_at fica a 1 de julho (meio do ano — o ponto menos errado
--     quando não há dia, e não finge ser um check-in de Ano Novo)
--   · date_is_exact fica false, e a app passa a mostrar só "Visto em 2024"
--     em vez de inventar um dia
--
-- Os nomes dos filmes podem estar guardados em português ou em inglês
-- (depende do que o TV Time exportou), por isso cada filme tem várias
-- grafias. Para o "%teu nome%" não apanhar o "Chama-me Pelo Teu Nome",
-- e o "%notebook%" não apanhar outro filme qualquer, o update só toca em
-- linhas adicionadas nos últimos 3 dias — que são exatamente estas três.
--
-- CORRE POR PARTES: primeiro o PASSO 1, confirma, depois o PASSO 2.
-- ─────────────────────────────────────────────────────────────


-- ── PASSO 1: ver o que vai ser mexido ─────────────────────────
-- Devem aparecer 3 linhas e só 3. Se aparecerem mais (ou menos), pára e
-- diz-me o que apareceu — faço a query pelas chaves exatas.

select key, name, watched_at, date_is_exact
from public.watched_movies
where user_id = (select id from auth.users where email = 'rubentinocomartins2001@gmail.com')
  and watched_at >= current_date - interval '3 days'
  and name ilike any (array[
    '%your name%', '%teu nome%', '%kimi no na%',
    '%notebook%', '%diário da nossa paixão%', '%diario da nossa paixao%',
    '%la la land%'
  ])
order by name;


-- ── PASSO 2: corrigir ─────────────────────────────────────────
-- Os anos estão todos no bloco `valores` — se algum estiver trocado, muda
-- aqui e volta a correr. O `returning` mostra que linhas mudaram: se não
-- mostrar 3, alguma coisa não bateu certo.

with valores (padroes, ano) as (
  values
    (array['%your name%', '%teu nome%', '%kimi no na%'],                          2024),
    (array['%notebook%', '%diário da nossa paixão%', '%diario da nossa paixao%'], 2024),
    (array['%la la land%'],                                                       2025)
)
update public.watched_movies m
set
  watched_at    = make_timestamptz(v.ano, 7, 1, 12, 0, 0),
  date_is_exact = false,
  updated_at    = now()
from valores v
where m.user_id = (select id from auth.users where email = 'rubentinocomartins2001@gmail.com')
  and m.watched_at >= current_date - interval '3 days'
  and m.name ilike any (v.padroes)
returning m.key, m.name, m.watched_at, m.date_is_exact;


-- ── DEPOIS ────────────────────────────────────────────────────
-- Isto muda a cloud, não o telemóvel. Em CADA dispositivo (iPhone e
-- computador) abre Perfil → "Sincronizar agora" para puxar as datas novas.
-- A sincronização preserva capas e ids TMDB locais — não perdes nada.
