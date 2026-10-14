-- LINKBIO keep-alive: o plano grátis do Supabase pausa o projeto após 7 dias sem atividade.
-- A cron diária (vercel.json → GET /api/keepalive) grava o horário aqui. Uma linha só (id = 1), sempre
-- atualizada por upsert: nada acumula e o conteúdo da bio não é tocado.
-- Só o servidor fala com esta tabela (service role). RLS ligada e sem policy: anon e authenticated não leem nada.
create table if not exists public.keepalive (
  id smallint primary key default 1 check (id = 1),
  pinged_at timestamptz not null default now()
);

alter table public.keepalive enable row level security;
revoke all on public.keepalive from anon, authenticated;
