import "server-only";
import { obterConfig } from "@/lib/config-fonte";
import { diaNoFuso, ehRobo, normalizarOrigem } from "@/lib/cliques";
import { rest, supabaseConfigurado } from "@/lib/supabase";

/** Uma visita por sessão do navegador (o script da origem guarda a marca). Sem cache. */
export const dynamic = "force-dynamic";

const SEM_CACHE = { "Cache-Control": "no-store" };

// atalho: qualquer um pode somar visitas com POST repetido, como no /r/ dos cliques; o número é um termômetro, não auditoria; revisitar se o painel virar base de cobrança ou de decisão paga.
export async function POST(request: Request): Promise<Response> {
  const config = await obterConfig();
  if (config.features.analytics !== true || !supabaseConfigurado()) return new Response(null, { status: 204, headers: SEM_CACHE });
  const robo = ehRobo(request.headers.get("user-agent"), {
    purpose: request.headers.get("purpose"),
    secPurpose: request.headers.get("sec-purpose"),
    xPurpose: request.headers.get("x-purpose"),
    xMoz: request.headers.get("x-moz"),
  });
  if (robo) return new Response(null, { status: 204, headers: SEM_CACHE });
  let origem = "direto";
  try {
    const corpo = (await request.json()) as { origem?: unknown };
    origem = normalizarOrigem(typeof corpo?.origem === "string" ? corpo.origem : null);
  } catch {
    origem = "direto";
  }
  try {
    await rest("rpc/registrar_visita", {
      method: "POST",
      cache: "no-store",
      body: JSON.stringify({ p_dia: diaNoFuso(config.site.tz), p_origem: origem }),
    });
  } catch (erro) {
    console.error("[linkbio] não foi possível contar a visita (rodou supabase/migrations/0010_origem.sql?)", erro);
  }
  return new Response(null, { status: 204, headers: SEM_CACHE });
}
