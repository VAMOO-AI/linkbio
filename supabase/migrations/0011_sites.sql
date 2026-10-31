-- LINKBIO sites (v0.12.0): de qual site veio a visita (o domínio do referrer), por dia.
-- Só o domínio, sem caminho nem busca. Sem IP, sem navegador, sem cookie, como a 0010.
-- Só o servidor fala com esta tabela (service role). RLS ligada e sem policy.

create table if not exists public.visitas_sites (
  dia date not null,
  site text not null,
  total integer not null default 0 check (total >= 0),
  primary key (dia, site),
  constraint visitas_sites_site_ok check (site ~ '^[a-z0-9.-]{3,100}$')
);

alter table public.visitas_sites enable row level security;

revoke all on public.visitas_sites from anon, authenticated;

-- Soma 1 no total do dia. O POST da visita é aberto: depois de 200 domínios no mesmo dia, o resto
-- vai para "outros", para ninguém encher a tabela com domínio inventado.
create or replace function public.registrar_site_visita(p_dia date, p_site text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  alvo text := p_site;
begin
  if not exists (select 1 from public.visitas_sites where dia = p_dia and site = p_site)
     and (select count(*) from public.visitas_sites where dia = p_dia) >= 200 then
    alvo := 'outros';
  end if;
  insert into public.visitas_sites (dia, site, total)
  values (p_dia, alvo, 1)
  on conflict (dia, site)
  do update set total = visitas_sites.total + 1;
end;
$$;

revoke all on function public.registrar_site_visita(date, text) from public, anon, authenticated;
grant execute on function public.registrar_site_visita(date, text) to service_role;
