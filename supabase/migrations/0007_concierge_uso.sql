-- Uso do concierge em modo IA: só contagem por dia. ip_hash é um resumo, nunca o IP.
-- A linha ip_hash = 'dia' é o total do dia. Não guarda a pergunta nem dado pessoal.
-- Só o servidor fala com esta tabela (service role). RLS ligada e sem policy.
create table if not exists public.concierge_uso (
  dia date not null,
  ip_hash text not null check (char_length(ip_hash) between 1 and 80),
  n integer not null default 0 check (n >= 0),
  primary key (dia, ip_hash)
);

alter table public.concierge_uso enable row level security;
revoke all on public.concierge_uso from anon, authenticated;

-- Sobe a contagem só se ainda cabe no teto do IP e no teto do dia. Devolve false quando não cabe.
create or replace function public.concierge_uso_reservar(p_dia date, p_ip_hash text, p_teto_ip int, p_teto_dia int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n_ip int;
  n_dia int;
begin
  if p_ip_hash is null or char_length(p_ip_hash) < 1 or char_length(p_ip_hash) > 80 then
    return false;
  end if;
  if p_teto_ip < 1 or p_teto_dia < 1 then
    return false;
  end if;
  perform pg_advisory_xact_lock(hashtext('concierge-ia'), hashtext(p_dia::text));
  select n into n_ip from public.concierge_uso where dia = p_dia and ip_hash = p_ip_hash;
  select n into n_dia from public.concierge_uso where dia = p_dia and ip_hash = 'dia';
  if coalesce(n_ip, 0) >= p_teto_ip or coalesce(n_dia, 0) >= p_teto_dia then
    return false;
  end if;
  insert into public.concierge_uso (dia, ip_hash, n) values (p_dia, p_ip_hash, 1)
    on conflict (dia, ip_hash) do update set n = public.concierge_uso.n + 1;
  insert into public.concierge_uso (dia, ip_hash, n) values (p_dia, 'dia', 1)
    on conflict (dia, ip_hash) do update set n = public.concierge_uso.n + 1;
  return true;
end;
$$;

revoke all on function public.concierge_uso_reservar(date, text, int, int) from public, anon, authenticated;
grant execute on function public.concierge_uso_reservar(date, text, int, int) to service_role;
