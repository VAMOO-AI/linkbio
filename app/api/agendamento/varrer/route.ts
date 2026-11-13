import "server-only";
import { timingSafeEqual } from "node:crypto";
import { obterConfig } from "@/lib/config-fonte";
import { expirarPrazos, reservasEsperandoMercadoPago } from "@/lib/agendamento/banco";
import { idDoBloco } from "@/lib/agendamento/regra";
import { dadosDosBlocos, depsDeStatus } from "@/lib/agendamento/servidor";
import { processarPagamentoMP, varrerCaixa } from "@/lib/agendamento/status";

export const dynamic = "force-dynamic";

function autorizado(cabecalho: string | null, secret: string | undefined): boolean {
  if (!secret || !cabecalho) return false;
  const a = Buffer.from(cabecalho);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Varredura dos Pix que chegaram com ninguém olhando a tela: lê a caixa de e-mail (modo email),
 * confere no Mercado Pago o que ficou pendente (modo mercadopago) e solta prazos vencidos.
 * Chame de fora a cada 5 a 15 min (cron-job.org, n8n) com `Authorization: Bearer <CRON_SECRET>`;
 * a cron do vercel.json passa uma vez por dia (limite do plano grátis).
 */
export async function GET(request: Request): Promise<Response> {
  if (!autorizado(request.headers.get("authorization"), process.env.CRON_SECRET?.trim())) {
    return new Response(null, { status: 401 });
  }
  const config = await obterConfig();
  const tz = config.site.tz;
  const agora = Date.now();
  const resumo = { caixa: 0, mercadopago: 0, erros: 0 };
  await expirarPrazos().catch(() => undefined);

  const pagos = config.blocks.flatMap((b, i) =>
    b.type === "agendamento" && b.enabled !== false && b.pagamento ? [{ bloco: b, id: idDoBloco(b, i) }] : [],
  );
  for (const { bloco } of pagos) {
    const ctx = { tz, agora, dados: dadosDosBlocos(config.blocks, config.site.url), deps: depsDeStatus(tz, bloco.provedor ?? "google") };
    try {
      if (bloco.pagamento!.modo === "email") {
        resumo.caixa += await varrerCaixa(ctx);
      } else {
        const pendentes = await reservasEsperandoMercadoPago(new Date(agora - 2 * 24 * 60 * 60 * 1000).toISOString());
        for (const r of pendentes) {
          const res = await processarPagamentoMP(r.pagamento_ref!, ctx).catch(() => "ignorado" as const);
          if (res === "confirmado") resumo.mercadopago++;
          else if (res === "ignorado" && r.expira_em && Date.parse(r.expira_em) < agora) await ctx.deps.cancelarMP?.(r.pagamento_ref!).catch(() => undefined);
        }
      }
    } catch (e) {
      resumo.erros++;
      console.error("agendamento: varredura falhou", e instanceof Error ? e.message : e);
    }
  }
  return Response.json(resumo, { headers: { "Cache-Control": "no-store" } });
}
