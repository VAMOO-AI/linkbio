import "server-only";
import { URL_PING } from "@/config/distribuicao";
import arquivo from "@/linkbio.config";
import { executarKeepalive } from "@/lib/keepalive";
import { pingAposKeepalive, urlDoPing } from "@/lib/ping-versao";
import { lerSupabase } from "@/lib/supabase-chave";
import { versaoDoPacote } from "@/lib/versao-pacote";

/** Nunca em cache: cada chamada da cron precisa chegar ao banco (resposta em cache nem aparece no log da Vercel). */
export const dynamic = "force-dynamic";

/** Chamada uma vez por dia pela cron do vercel.json. Detalhes em lib/keepalive.ts. */
export async function GET(request: Request): Promise<Response> {
  const sb = lerSupabase(process.env);
  const r = await executarKeepalive({
    supabaseUrl: sb?.url,
    chave: sb?.chave,
    cronSecret: process.env.CRON_SECRET,
    authorization: request.headers.get("authorization"),
  });
  await pingAposKeepalive({
    statusKeepalive: r.status,
    pingUrl: urlDoPing(process.env.LINKBIO_PING_URL, URL_PING),
    supabaseUrl: sb?.url,
    chave: sb?.chave,
    arquivo,
    versao: versaoDoPacote(),
  });
  return Response.json(r.corpo, { status: r.status, headers: { "Cache-Control": "no-store" } });
}
