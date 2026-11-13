import "server-only";
import { obterConfig } from "@/lib/config-fonte";
import { reservaPorId } from "@/lib/agendamento/banco";
import { assinaturaMPValida, consultarPagamentoMP } from "@/lib/agendamento/mercadopago";
import { acharBlocoAgendamento } from "@/lib/agendamento/regra";
import { dadosDosBlocos, depsDeStatus, mpNoAmbiente } from "@/lib/agendamento/servidor";
import { processarPagamentoMP } from "@/lib/agendamento/status";

export const dynamic = "force-dynamic";

const ID = /^[A-Za-z0-9-]{1,40}$/;

/**
 * Aviso de pagamento do Mercado Pago (configure esta URL em Suas integrações > Webhooks, evento
 * Pagamentos). A assinatura (MP_WEBHOOK_SECRET) prova que veio do Mercado Pago; mesmo assim o
 * estado do pagamento é sempre lido na API, nunca do corpo do aviso. Responde 200 rápido: o
 * Mercado Pago reenvia o que não recebe 200 em 22 s.
 */
export async function POST(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const dataId = url.searchParams.get("data.id") ?? url.searchParams.get("id");
  const tipo = url.searchParams.get("type") ?? url.searchParams.get("topic");
  const secret = process.env.MP_WEBHOOK_SECRET?.trim();
  const cred = mpNoAmbiente();
  if (!cred || !secret) {
    console.error("agendamento: aviso do Mercado Pago sem MP_ACCESS_TOKEN ou MP_WEBHOOK_SECRET no ambiente; ignorado.");
    return new Response(null, { status: 503 });
  }
  const valida = assinaturaMPValida({
    xSignature: request.headers.get("x-signature"),
    xRequestId: request.headers.get("x-request-id"),
    dataId,
    secret,
  });
  if (!valida) return new Response(null, { status: 401 });
  if (tipo !== "payment" || !dataId || !ID.test(dataId)) return new Response(null, { status: 200 });

  try {
    const busca = (u: string, init?: RequestInit) => fetch(u, { ...init, cache: "no-store" });
    const p = await consultarPagamentoMP(cred, dataId, busca);
    if (!p.reservaId) return new Response(null, { status: 200 });
    const r = await reservaPorId(p.reservaId);
    if (!r) return new Response(null, { status: 200 });
    const config = await obterConfig();
    const bloco = acharBlocoAgendamento(config.blocks, r.bloco);
    const tz = config.site.tz;
    await processarPagamentoMP(dataId, {
      tz,
      agora: Date.now(),
      dados: dadosDosBlocos(config.blocks, config.site.url),
      deps: depsDeStatus(tz, bloco?.provedor ?? "google"),
    });
    return new Response(null, { status: 200 });
  } catch (e) {
    // 500 faz o Mercado Pago tentar de novo daqui a 15 min; a tela do Pix também confere sozinha.
    console.error("agendamento: aviso do Mercado Pago falhou", e instanceof Error ? e.message : e);
    return new Response(null, { status: 500 });
  }
}
