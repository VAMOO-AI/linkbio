-- LINKBIO /admin: rascunho automático por pessoa (a prévia ao vivo lê daqui; publicar vira versão em site_config).
create table if not exists public.site_config_rascunho (
  email text primary key,
  config jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.site_config_rascunho enable row level security;
revoke all on public.site_config_rascunho from anon, authenticated;
