-- Agenda paga (PIX) e agenda Microsoft (v0.16.0). Só acrescenta: quem já tem a 0009 com reservas
-- reais roda esta por cima sem perder nada. Só o servidor fala com estas tabelas (service role).
--
-- Fluxo pago: a reserva nasce 'aguardando_pagamento' com prazo (expira_em). O horário fica preso
-- enquanto o prazo corre. Pagou: 'confirmado'. Venceu: 'expirado' (o servidor marca antes de listar
-- horários e antes de gravar). PIX que chega depois e o horário já foi de outra pessoa:
-- 'pago_sem_horario' (o dono devolve ou encaixa).

create extension if not exists btree_gist;

alter table public.agendamentos
  add column if not exists provedor text not null default 'google',
  add column if not exists evento_id text,
  add column if not exists valor_centavos integer,
  add column if not exists pagamento_modo text,
  add column if not exists pagamento_ref text,
  add column if not exists expira_em timestamptz,
  add column if not exists valor_preso_ate timestamptz,
  add column if not exists pago_em timestamptz,
  add column if not exists token_hash text;

alter table public.agendamentos drop constraint if exists agendamentos_status_check;
alter table public.agendamentos add constraint agendamentos_status_check
  check (status in ('confirmado', 'cancelado', 'aguardando_pagamento', 'expirado', 'pago_sem_horario'));

alter table public.agendamentos drop constraint if exists agendamentos_provedor_ok;
alter table public.agendamentos add constraint agendamentos_provedor_ok check (provedor in ('google', 'microsoft'));

alter table public.agendamentos drop constraint if exists agendamentos_pagamento_ok;
alter table public.agendamentos add constraint agendamentos_pagamento_ok check (
  pagamento_modo is null
  or (pagamento_modo in ('mercadopago', 'email') and valor_centavos > 0)
);

alter table public.agendamentos drop constraint if exists agendamentos_aguardando_tem_prazo;
alter table public.agendamentos add constraint agendamentos_aguardando_tem_prazo
  check (status <> 'aguardando_pagamento' or expira_em is not null);

-- O horário preso pelo PIX também bloqueia: a sobreposição vale para os dois estados.
alter table public.agendamentos drop constraint if exists agendamentos_sem_sobrepor;
alter table public.agendamentos add constraint agendamentos_sem_sobrepor
  exclude using gist (tstzrange(inicio, fim, '[)') with &&)
  where (status in ('confirmado', 'aguardando_pagamento'));

-- Modo e-mail: o aviso do banco só traz o valor. Cada reserva paga ganha centavos próprios
-- (R$ 300,17) e o mesmo valor não se repete até 48 h depois do prazo, para um PIX atrasado do
-- prazo velho não confirmar a reserva de outra pessoa. Dois pedidos juntos com os mesmos
-- centavos: o segundo bate aqui (23P01) e o servidor sorteia outro.
-- (timestamptz + interval não é IMMUTABLE e não entra em constraint: o servidor grava
-- valor_preso_ate = expira_em + 48 h.)
alter table public.agendamentos drop constraint if exists agendamentos_email_tem_trava;
alter table public.agendamentos add constraint agendamentos_email_tem_trava
  check (pagamento_modo is distinct from 'email' or valor_preso_ate > expira_em);
alter table public.agendamentos drop constraint if exists agendamentos_valor_unico_email;
alter table public.agendamentos add constraint agendamentos_valor_unico_email
  exclude using gist (valor_centavos with =, tstzrange(created_at, valor_preso_ate, '[)') with &&)
  where (pagamento_modo = 'email');

create unique index if not exists agendamentos_token_hash_idx on public.agendamentos (token_hash) where token_hash is not null;
create index if not exists agendamentos_aguardando_idx on public.agendamentos (expira_em) where status = 'aguardando_pagamento';
create unique index if not exists agendamentos_pagamento_ref_idx on public.agendamentos (pagamento_modo, pagamento_ref)
  where pagamento_ref is not null and pagamento_modo = 'mercadopago';

-- Prazo vencido vira 'expirado'. Chamado antes de listar horários e antes de gravar reserva.
create or replace function public.agendamentos_expirar()
returns integer
language sql
security definer
set search_path = public
as $$
  with vencidos as (
    update public.agendamentos set status = 'expirado'
    where status = 'aguardando_pagamento' and expira_em < now()
    returning 1
  )
  select count(*)::integer from vencidos;
$$;

revoke all on function public.agendamentos_expirar() from public, anon, authenticated;
grant execute on function public.agendamentos_expirar() to service_role;

-- Cada PIX recebido entra uma vez (id do pagamento no Mercado Pago ou da mensagem no e-mail).
-- Guarda só o necessário para casar e auditar: nada do corpo do e-mail.
create table if not exists public.pagamentos_recebidos (
  id text primary key,
  origem text not null check (origem in ('mercadopago', 'email')),
  valor_centavos integer not null check (valor_centavos > 0),
  recebido_em timestamptz not null,
  agendamento_id uuid references public.agendamentos (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.pagamentos_recebidos enable row level security;
revoke all on public.pagamentos_recebidos from anon, authenticated;

-- Conta Microsoft conectada (a do Google continua em agenda_google). O refresh token da
-- Microsoft muda a cada uso: o servidor grava o novo sempre que renova.
create table if not exists public.agenda_conexao (
  provedor text primary key check (provedor in ('microsoft')),
  refresh_token text not null,
  conta text,
  updated_at timestamptz not null default now()
);

alter table public.agenda_conexao enable row level security;
revoke all on public.agenda_conexao from anon, authenticated;

-- Trava curta por nome (varredura da caixa de e-mail): no máximo uma a cada p_segundos.
create table if not exists public.agenda_trava (
  nome text primary key,
  ate timestamptz not null
);

alter table public.agenda_trava enable row level security;
revoke all on public.agenda_trava from anon, authenticated;

create or replace function public.agenda_pegar_trava(p_nome text, p_segundos integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  pegou boolean;
begin
  insert into public.agenda_trava as t (nome, ate)
  values (p_nome, now() + make_interval(secs => p_segundos))
  on conflict (nome) do update set ate = excluded.ate
  where t.ate < now()
  returning true into pegou;
  return coalesce(pegou, false);
end;
$$;

revoke all on function public.agenda_pegar_trava(text, integer) from public, anon, authenticated;
grant execute on function public.agenda_pegar_trava(text, integer) to service_role;
