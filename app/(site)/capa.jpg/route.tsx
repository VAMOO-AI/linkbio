import { obterConfig } from "@/lib/config-fonte";
import { gerarCapa } from "@/lib/capa";

/**
 * Capa ao compartilhar (og:image), em /capa.jpg. Estática como a página: é gerada uma vez e refeita
 * quando o /admin publica (a config lida aqui usa a mesma tag de cache). Ver lib/capa.tsx.
 */
export const dynamic = "force-static";

export async function GET() {
  const { corpo, tipo } = await gerarCapa(await obterConfig());
  return new Response(new Uint8Array(corpo), {
    headers: { "Content-Type": tipo, "Content-Length": String(corpo.length) },
  });
}
