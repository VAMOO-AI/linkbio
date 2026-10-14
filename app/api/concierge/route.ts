import "server-only";
import { ipDoPedido, responderDuvida, testeLiberado } from "@/lib/concierge-ia-servidor";

/** POST não entra em cache. A resposta ainda pede para não guardar. */
export const dynamic = "force-dynamic";

const SEM_CACHE = { "Cache-Control": "no-store" };

/** Dúvida livre do concierge. Sem chave, no limite ou com falha, devolve o roteiro — sem detalhe do erro. */
export async function POST(request: Request): Promise<Response> {
  const tamanho = Number(request.headers.get("content-length") || 0);
  if (tamanho > 4_000) return Response.json({ tipo: "roteiro" }, { headers: SEM_CACHE });
  let pergunta: unknown;
  try {
    const corpo = (await request.json()) as { pergunta?: unknown };
    pergunta = corpo?.pergunta;
  } catch {
    return Response.json({ tipo: "roteiro" }, { headers: SEM_CACHE });
  }
  const resultado = await responderDuvida(pergunta, ipDoPedido(request), testeLiberado(request));
  return Response.json(resultado, { headers: SEM_CACHE });
}
