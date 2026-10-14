-- LINKBIO cliques: quantas pessoas tocaram em cada botão, por dia e por origem (bio, stories, reels).
-- Só o total. Sem IP, sem navegador, sem cookie.
-- Só o servidor fala com esta tabela (service role). RLS ligada e sem policy: anon e authenticated não leem nada.

create table if not exists public.cliques (
  dia date not null,
  alvo text not null,
  origem text not null,
  total integer not null default 0 check (total >= 0),
  primary key (dia, alvo, origem),
  constraint cliques_alvo_ok check (char_length(alvo) between 1 and 180 and alvo ~ '^[a-z0-9.-]+$'),
  constraint cliques_origem_ok check (origem ~ '^[a-z0-9-]{1,20}$')
);

alter table public.cliques enable row level security;

revoke all on public.cliques from anon, authenticated;

-- Soma 1 no total do dia. security definer: o papel do servidor executa; anon não chama.
create or replace function public.registrar_clique(p_dia date, p_alvo text, p_origem text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.cliques (dia, alvo, origem, total)
  values (p_dia, p_alvo, p_origem, 1)
  on conflict (dia, alvo, origem)
  do update set total = cliques.total + 1;
$$;

revoke all on function public.registrar_clique(date, text, text) from public, anon, authenticated;
grant execute on function public.registrar_clique(date, text, text) to service_role;
