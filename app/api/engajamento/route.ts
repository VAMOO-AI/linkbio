import "server-only";
import { obterConfig } from "@/lib/config-fonte";
import { chavesDosBlocos, diaNoFuso, ehRobo } from "@/lib/cliques";
import { lerEnvioEngajamento, type TipoEngajamento } from "@/lib/engajamento";
import { rest, supabaseConfigurado } from "@/lib/supabase";

/** Lote do script da origem: seções vistas, toques sem link e saída rápida. Sem cache. */
export const dynamic = "force-dynamic";

const SEM_CACHE = { "Cache-Control": "no-store" };

// atalho: qualquer um pode somar com POST repetido, como na /api/visita; só entra chave que existe na bio, então o estrago é número inflado, não tabela cheia; revisitar se o painel virar base de cobrança ou de decisão paga.
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
  let bruto: unknown = null;
  try {
    bruto = await request.json();
  } catch {
    bruto = null;
  }
  const envio = lerEnvioEngajamento(bruto, chavesDosBlocos(config.blocks));
  const dia = diaNoFuso(config.site.tz);
  const lotes: [TipoEngajamento, string[]][] = [
    ["secao", envio.secoes],
    ["toque_sem_link", envio.toques],
    ["saida_rapida", envio.rapida ? [""] : []],
  ];
  for (const [tipo, chaves] of lotes) {
    if (!chaves.length) continue;
    try {
      await rest("rpc/registrar_engajamento", {
        method: "POST",
        cache: "no-store",
        body: JSON.stringify({ p_dia: dia, p_tipo: tipo, p_chaves: chaves, p_origem: envio.origem }),
      });
    } catch (erro) {
      console.error("[linkbio] não foi possível contar o engajamento (rodou supabase/migrations/0012_engajamento.sql?)", erro);
      break;
    }
  }
  return new Response(null, { status: 204, headers: SEM_CACHE });
}
