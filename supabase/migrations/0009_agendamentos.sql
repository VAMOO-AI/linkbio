-- Reservas do bloco agendamento e a conexão com o Google Agenda do dono.
-- Só o servidor fala com estas tabelas (service role). RLS ligada e sem policy:
-- anon e authenticated não leem nem escrevem. O IP não entra: a rota guarda só o hash.

create table if not exists public.agendamentos (
  id uuid primary key default gen_random_uuid(),
  -- Repetir o envio (duplo clique, rede caindo) devolve a mesma reserva.
  request_id uuid not null unique,
  bloco text not null,
  servico text not null,
  inicio timestamptz not null,
  fim timestamptz not null,
  nome text not null,
  whatsapp text not null,
  email text,
  ip_hash text,
  status text not null default 'confirmado' check (status in ('confirmado', 'cancelado')),
  google_evento_id text,
  meet_url text,
  created_at timestamptz not null default now(),
  constraint agendamentos_fim_depois check (fim > inicio),
  -- Dois envios no mesmo horário: o segundo bate aqui (erro 23P01) e recebe "horário ocupado".
  constraint agendamentos_sem_sobrepor exclude using gist (tstzrange(inicio, fim, '[)') with &&)
    where (status = 'confirmado')
);

create index if not exists agendamentos_inicio_idx on public.agendamentos (inicio);
create index if not exists agendamentos_ip_hash_created_idx on public.agendamentos (ip_hash, created_at desc);

alter table public.agendamentos enable row level security;
revoke all on public.agendamentos from anon, authenticated;

-- Uma linha só: a conta Google conectada por `npm run google:conectar`.
-- O refresh token dá acesso à agenda do dono: nunca sai do servidor.
create table if not exists public.agenda_google (
  id smallint primary key default 1 check (id = 1),
  refresh_token text not null,
  conta text,
  updated_at timestamptz not null default now()
);

alter table public.agenda_google enable row level security;
revoke all on public.agenda_google from anon, authenticated;
