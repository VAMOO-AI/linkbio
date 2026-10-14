-- Contatos do bloco lead (isca digital, lista de espera).
-- Só o servidor fala com esta tabela (service role). RLS ligada e sem policy:
-- anon e authenticated não leem nem escrevem. O IP não entra: a rota guarda só o hash.
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  bloco text not null,
  nome text not null,
  whatsapp text,
  email text,
  entrega text,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_ip_hash_created_idx on public.leads (ip_hash, created_at desc);

alter table public.leads enable row level security;
revoke all on public.leads from anon, authenticated;
