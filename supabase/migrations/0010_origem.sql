-- LINKBIO origem (v0.9.0): visitas por dia e por origem, para a taxa de conversão do painel,
-- e a origem gravada junto do contato e da reserva.
-- Visitas: só o total, como os cliques. Sem IP, sem navegador, sem cookie. Uma por sessão do navegador.
-- Só o servidor fala com esta tabela (service role). RLS ligada e sem policy.

create table if not exists public.visitas (
  dia date not null,
  origem text not null,
  total integer not null default 0 check (total >= 0),
  primary key (dia, origem),
  constraint visitas_origem_ok check (origem ~ '^[a-z0-9-]{1,20}$')
);

alter table public.visitas enable row level security;

revoke all on public.visitas from anon, authenticated;

-- Soma 1 no total do dia. security definer: o papel do servidor executa; anon não chama.
create or replace function public.registrar_visita(p_dia date, p_origem text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.visitas (dia, origem, total)
  values (p_dia, p_origem, 1)
  on conflict (dia, origem)
  do update set total = visitas.total + 1;
$$;

revoke all on function public.registrar_visita(date, text) from public, anon, authenticated;
grant execute on function public.registrar_visita(date, text) to service_role;

-- De onde veio quem deixou contato ou marcou horário (?src= ou utm_source) e a campanha (utm_*, fbclid).
alter table public.leads add column if not exists origem text;
alter table public.leads add column if not exists utm jsonb;

do $$
begin
  if to_regclass('public.agendamentos') is not null then
    alter table public.agendamentos add column if not exists origem text;
    alter table public.agendamentos add column if not exists utm jsonb;
  end if;
end $$;
