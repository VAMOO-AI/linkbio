import "server-only";
import arquivo from "@/linkbio.config";
import { consultarSaude } from "@/lib/saude";

/** Nunca em cache: a origem (banco ou arquivo) muda quando o painel publica. */
export const dynamic = "force-dynamic";

/** Saúde da frota: versão do template e de onde a config veio. Sem conteúdo da bio. */
export async function GET(): Promise<Response> {
  const corpo = await consultarSaude({
    supabaseUrl: process.env.SUPABASE_URL,
    chave: process.env.SUPABASE_SERVICE_ROLE_KEY,
    arquivo,
  });
  return Response.json(corpo, { headers: { "Cache-Control": "no-store" } });
}
