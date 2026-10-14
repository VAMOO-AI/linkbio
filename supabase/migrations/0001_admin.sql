-- LINKBIO /admin: config versionada, pessoas do painel e tentativas de login.
-- Só o servidor fala com estas tabelas (service role). RLS ligada e sem policy: anon e authenticated não leem nada.

create table if not exists public.site_config (
  id bigint generated always as identity primary key,
  config jsonb not null,
  created_at timestamptz not null default now(),
  created_by text,
  nota text
);

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  password_hash text not null,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists public.admin_login_attempts (
  id bigint generated always as identity primary key,
  email text not null,
  ok boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists admin_login_attempts_email_idx on public.admin_login_attempts (email, created_at desc);

alter table public.site_config enable row level security;
alter table public.admin_users enable row level security;
alter table public.admin_login_attempts enable row level security;

revoke all on public.site_config, public.admin_users, public.admin_login_attempts from anon, authenticated;

-- Imagens enviadas pelo /admin: leitura pública (a bio mostra), escrita só pelo servidor. Sem SVG (pode levar script).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('linkbio', 'linkbio', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;
