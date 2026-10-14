import { cabecalhosDaChave } from "./supabase-chave";

/**
 * Keep-alive do Supabase: o plano grátis pausa o projeto depois de 7 dias sem atividade, e aí a bio
 * volta em silêncio ao linkbio.config.ts (lib/config-fonte.ts). Uma cron diária (vercel.json) chama
 * GET /api/keepalive, que grava o horário numa linha única da tabela `keepalive` (migration 0003).
 * Escrita de verdade, sem acumular lixo (sempre a linha 1) e sem tocar no conteúdo da bio.
 *
 * Função pura (recebe env e fetch) para dar para testar sem servidor; a rota é só a casca.
 */
export type EntradaKeepalive = {
  supabaseUrl?: string;
  chave?: string;
  cronSecret?: string;
  /** Cabeçalho Authorization do pedido. A Vercel manda `Bearer <CRON_SECRET>` sozinha nas crons. */
  authorization?: string | null;
  fetch?: typeof fetch;
  agora?: () => Date;
};

export type SaidaKeepalive = { status: number; corpo: Record<string, unknown> };

export async function executarKeepalive(e: EntradaKeepalive): Promise<SaidaKeepalive> {
  const segredo = e.cronSecret?.trim();
  if (segredo && e.authorization !== `Bearer ${segredo}`) {
    return { status: 401, corpo: { ok: false, erro: "Não autorizado: falta Authorization: Bearer <CRON_SECRET>." } };
  }
  const url = e.supabaseUrl?.trim().replace(/\/$/, "");
  const chave = e.chave?.trim();
  if (!url || !chave) return { status: 200, corpo: { ok: true, skipped: "supabase-off" } };

  const pinged_at = (e.agora ?? (() => new Date()))().toISOString();
  const buscar = e.fetch ?? fetch;
  let resp: Response;
  try {
    resp = await buscar(`${url}/rest/v1/keepalive?on_conflict=id`, {
      method: "POST",
      headers: {
        ...cabecalhosDaChave(chave),
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({ id: 1, pinged_at }),
      cache: "no-store",
    });
  } catch (erro) {
    return { status: 502, corpo: { ok: false, erro: `Não foi possível falar com o Supabase: ${String(erro)}` } };
  }
  if (resp.ok) return { status: 200, corpo: { ok: true, pinged_at } };

  const texto = (await resp.text()).slice(0, 300);
  // PostgREST responde 404 com PGRST205 (ou 42P01) quando a tabela não existe.
  if (resp.status === 404 || /PGRST205|42P01/.test(texto)) {
    return {
      status: 500,
      corpo: {
        ok: false,
        erro: "A tabela keepalive não existe no Supabase: rode a migration supabase/migrations/0003_keepalive.sql (SQL Editor ou supabase db push).",
      },
    };
  }
  return { status: 500, corpo: { ok: false, erro: `Supabase ${resp.status} no keepalive: ${texto}` } };
}
