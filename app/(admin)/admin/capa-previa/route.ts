import "server-only";
import { previaDaCapa } from "@/lib/admin/capa-previa";
import { obterSessao } from "@/lib/admin/sessao";

/**
 * Prévia da capa do link para o painel ("Assim aparece no WhatsApp"). Rota comum, e não server action:
 * o Next despacha as server actions uma de cada vez por navegador, e desenhar a capa (baixar a imagem,
 * redimensionar) segurava o salvamento do rascunho na fila. Pelo fetch ela roda em paralelo e o painel
 * cancela o pedido velho quando a pessoa continua digitando.
 */
export const dynamic = "force-dynamic";

const LIMITE = 64 * 1024;

export async function POST(request: Request): Promise<Response> {
  const semCache = { "Cache-Control": "no-store" };
  if (!(await obterSessao())) return Response.json({ ok: false }, { status: 401, headers: semCache });
  const corpo = await request.text();
  if (corpo.length > LIMITE) return Response.json({ ok: false }, { status: 413, headers: semCache });
  let rascunho: unknown;
  try {
    rascunho = JSON.parse(corpo);
  } catch {
    return Response.json({ ok: false }, { status: 400, headers: semCache });
  }
  try {
    return Response.json(await previaDaCapa(rascunho), { headers: semCache });
  } catch (erro) {
    console.error("[linkbio admin] prévia da capa", erro);
    return Response.json({ ok: false }, { status: 500, headers: semCache });
  }
}
