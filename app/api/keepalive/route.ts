import "server-only";
import arquivo from "@/linkbio.config";
import { executarKeepalive } from "@/lib/keepalive";
import { pingAposKeepalive } from "@/lib/ping-versao";
import { versaoDoPacote } from "@/lib/versao-pacote";

/** Nunca em cache: cada chamada da cron precisa chegar ao banco (resposta em cache nem aparece no log da Vercel). */
export const dynamic = "force-dynamic";

/** Chamada uma vez por dia pela cron do vercel.json. Detalhes em lib/keepalive.ts. */
export async function GET(request: Request): Promise<Response> {
  const r = await executarKeepalive({
    supabaseUrl: process.env.SUPABASE_URL,
    chave: process.env.SUPABASE_SERVICE_ROLE_KEY,
    cronSecret: process.env.CRON_SECRET,
    authorization: request.headers.get("authorization"),
  });
  await pingAposKeepalive({
    statusKeepalive: r.status,
    pingUrl: process.env.LINKBIO_PING_URL,
    supabaseUrl: process.env.SUPABASE_URL,
    chave: process.env.SUPABASE_SERVICE_ROLE_KEY,
    arquivo,
    versao: versaoDoPacote(),
  });
  return Response.json(r.corpo, { status: r.status, headers: { "Cache-Control": "no-store" } });
}
