import "server-only";
import { estourouPing, gravarPing, lerPing } from "@/lib/frota";
import { lerSupabase } from "@/lib/supabase-chave";

/** Nunca em cache: cada ping é uma escrita. */
export const dynamic = "force-dynamic";

const balde = new Map<string, number[]>();

function ipDe(request: Request): string {
  const encaminhado = request.headers.get("x-forwarded-for");
  const bruto = (encaminhado?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "desconhecido").trim();
  return bruto.slice(0, 80) || "desconhecido";
}

/**
 * Hub da frota. Só responde quando FROTA_RECEPCAO=1 (um deploy central, não a bio de cada pessoa).
 * Grava site, versão e origem da config. Sem conteúdo da bio.
 */
export async function POST(request: Request): Promise<Response> {
  if (process.env.FROTA_RECEPCAO !== "1") {
    return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  if (estourouPing(balde, ipDe(request), Date.now())) {
    return new Response(null, { status: 429, headers: { "Cache-Control": "no-store" } });
  }
  const texto = await request.text();
  if (texto.length > 800) return new Response(null, { status: 400, headers: { "Cache-Control": "no-store" } });
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    return new Response(null, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const ping = lerPing(bruto);
  if (!ping) return new Response(null, { status: 400, headers: { "Cache-Control": "no-store" } });
  const sb = lerSupabase(process.env);
  const status = await gravarPing({
    ligado: true,
    supabaseUrl: sb?.url,
    chave: sb?.chave,
    ping,
  });
  return new Response(null, { status, headers: { "Cache-Control": "no-store" } });
}
