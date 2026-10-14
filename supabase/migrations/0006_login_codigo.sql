-- LINKBIO /admin: a senha passa a ser opcional. O código de 6 dígitos fica só como hash
-- (HMAC com o segredo da sessão), vale 10 minutos e é de uso único.
-- Só o servidor fala com esta tabela (service role). RLS ligada e sem policy.

alter table public.admin_users alter column password_hash drop not null;

create table if not exists public.admin_login_codes (
  id bigint generated always as identity primary key,
  email text not null check (email = lower(email)),
  code_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists admin_login_codes_email_idx on public.admin_login_codes (email, created_at desc);

alter table public.admin_login_codes enable row level security;

revoke all on public.admin_login_codes from anon, authenticated;
