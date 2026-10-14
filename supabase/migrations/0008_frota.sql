-- LINKBIO frota: um deploy central (FROTA_RECEPCAO=1) guarda o último ping de cada bio.
-- POST /api/frota faz upsert por site. Sem conteúdo da bio. As bios em si não ligam esta rota.
-- Só o servidor fala com esta tabela (service role). RLS ligada e sem policy.
create table if not exists public.frota_ping (
  site text primary key,
  versao text not null,
  fonte text not null check (fonte in ('banco', 'arquivo')),
  motivo text,
  visto_em timestamptz not null default now()
);

alter table public.frota_ping enable row level security;
revoke all on public.frota_ping from anon, authenticated;
