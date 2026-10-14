import "server-only";
import { NextResponse } from "next/server";
import { obterConfig } from "@/lib/config-fonte";
import { diaNoFuso, ehRobo, origemDoPedido } from "@/lib/cliques";
import { resolverDestino } from "@/lib/cliques-destino";
import { rest, supabaseConfigurado } from "@/lib/supabase";

/** Cada toque chega aqui. Sem cache: um 302 guardado não contaria o próximo. */
export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<{ alvo: string }> }): Promise<Response> {
  const { alvo: bruto } = await ctx.params;
  let alvo = bruto;
  try {
    alvo = decodeURIComponent(bruto);
  } catch {
    alvo = bruto;
  }

  const config = await obterConfig();
  const pedido = new URL(request.url);
  const destino = resolverDestino(config, alvo, pedido.searchParams.get("r"));
  if (!destino) {
    return new NextResponse("Esse botão não está mais na bio.", {
      status: 404,
      headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const contar = config.features.analytics === true && supabaseConfigurado();
  const robo = ehRobo(request.headers.get("user-agent"), {
    purpose: request.headers.get("purpose"),
    secPurpose: request.headers.get("sec-purpose"),
    xPurpose: request.headers.get("x-purpose"),
    xMoz: request.headers.get("x-moz"),
  });
  if (contar && !robo) {
    try {
      await rest("rpc/registrar_clique", {
        method: "POST",
        cache: "no-store",
        body: JSON.stringify({
          p_dia: diaNoFuso(config.site.tz),
          p_alvo: alvo,
          p_origem: origemDoPedido(request.url, request.headers.get("referer")),
        }),
      });
    } catch (erro) {
      console.error("[linkbio] não foi possível contar o clique", erro);
    }
  }

  const resp = NextResponse.redirect(destino.url, 302);
  resp.headers.set("Cache-Control", "no-store");
  return resp;
}
