import "server-only";
import arquivo from "@/linkbio.config";
import { consultarSaude } from "@/lib/saude";
import { lerSupabase } from "@/lib/supabase-chave";

/** Nunca em cache: a origem (banco ou arquivo) muda quando o painel publica. */
export const dynamic = "force-dynamic";

/** Saúde da frota: versão do template e de onde a config veio. Sem conteúdo da bio. */
export async function GET(): Promise<Response> {
  const sb = lerSupabase(process.env);
  const corpo = await consultarSaude({
    supabaseUrl: sb?.url,
    chave: sb?.chave,
    arquivo,
  });
  return Response.json(corpo, { headers: { "Cache-Control": "no-store" } });
}
