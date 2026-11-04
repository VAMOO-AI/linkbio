-- LINKBIO engajamento (v0.14.0): até onde as pessoas rolam, onde tocam sem ter link e quem sai em
-- menos de 3 segundos. Por dia, tipo, seção (a chave do bloco, a mesma dos cliques) e origem.
-- Só o total, como cliques e visitas. Sem IP, sem navegador, sem cookie.
-- Só o servidor fala com esta tabela (service role). RLS ligada e sem policy.

create table if not exists public.engajamento (
  dia date not null,
  tipo text not null,
  chave text not null default '',
  origem text not null,
  total integer not null default 0 check (total >= 0),
  primary key (dia, tipo, chave, origem),
  constraint engajamento_tipo_ok check (tipo in ('secao', 'toque_sem_link', 'saida_rapida')),
  constraint engajamento_chave_ok check (chave ~ '^[a-z0-9-]{0,80}$'),
  constraint engajamento_origem_ok check (origem ~ '^[a-z0-9-]{1,20}$')
);

alter table public.engajamento enable row level security;

revoke all on public.engajamento from anon, authenticated;

-- Soma 1 em cada chave do lote. O servidor só manda chave que existe na bio, sem repetir;
-- o distinct protege do "on conflict" que não aceita a mesma linha duas vezes no mesmo insert.
create or replace function public.registrar_engajamento(p_dia date, p_tipo text, p_chaves text[], p_origem text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.engajamento (dia, tipo, chave, origem, total)
  select p_dia, p_tipo, c, p_origem, 1
  from (select distinct unnest(p_chaves) as c) as lote
  on conflict (dia, tipo, chave, origem)
  do update set total = engajamento.total + 1;
$$;

revoke all on function public.registrar_engajamento(date, text, text[], text) from public, anon, authenticated;
grant execute on function public.registrar_engajamento(date, text, text[], text) to service_role;
