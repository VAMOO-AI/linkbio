import "server-only";
import { obterConfig } from "@/lib/config-fonte";
import { supabaseConfigurado } from "@/lib/supabase";
import { lerSupabase } from "@/lib/supabase-chave";
import {
  MENSAGEM_CEDO,
  MENSAGEM_FALHA,
  MENSAGEM_LIMITE,
  MENSAGEM_SEM_BANCO,
  abertoDoCookie,
  avisarDono,
  ipDoPedido,
  tratarLead,
  type BlocoNaPagina,
  type ResultadoLead,
} from "@/lib/lead";
import { contarLeadsRecentes, gravarLead } from "@/lib/lead-banco";
import type { LinkbioConfig } from "@/config/schema";

export const dynamic = "force-dynamic";

const LIMITE_CORPO = 20_000;

function blocosDaPagina(config: LinkbioConfig): BlocoNaPagina[] {
  return config.blocks.map((b) => {
    if (b.type === "lead") return { type: b.type, enabled: b.enabled, id: b.id, pedir: b.pedir, entrega: b.entrega };
    return { type: b.type, enabled: b.enabled, id: "id" in b ? b.id : undefined };
  });
}

async function lerBruto(request: Request): Promise<Record<string, unknown>> {
  const tipo = request.headers.get("content-type") ?? "";
  if (tipo.includes("application/json")) {
    const json = (await request.json()) as unknown;
    return json && typeof json === "object" && !Array.isArray(json) ? (json as Record<string, unknown>) : {};
  }
  const dados = await request.formData();
  const bruto: Record<string, unknown> = {};
  for (const [chave, valor] of dados.entries()) if (typeof valor === "string") bruto[chave] = valor;
  return bruto;
}

function querJson(request: Request): boolean {
  const tipo = request.headers.get("content-type") ?? "";
  if (tipo.includes("application/json")) return true;
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("application/json") && !accept.includes("text/html");
}

function mensagemDe(r: ResultadoLead): string {
  if (r.tipo === "cedo") return MENSAGEM_CEDO;
  if (r.tipo === "limite") return MENSAGEM_LIMITE;
  if (r.tipo === "sem-banco") return MENSAGEM_SEM_BANCO;
  if (r.tipo === "falha") return r.mensagem || MENSAGEM_FALHA;
  if (r.tipo === "invalido") return r.mensagem;
  return "";
}

function statusDe(tipo: ResultadoLead["tipo"]): number {
  if (tipo === "limite") return 429;
  if (tipo === "sem-banco" || tipo === "falha") return 503;
  return 400;
}

function escapar(texto: string): string {
  return texto.replace(/[&<>]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"));
}

function responder(request: Request, r: ResultadoLead, bloco: string): Response {
  const semCache = { "cache-control": "no-store" };
  if (r.tipo === "ok" || r.tipo === "isca") {
    if (querJson(request)) return Response.json({ ok: true }, { headers: semCache });
    return Response.redirect(new URL(`/contato/enviado?bloco=${encodeURIComponent(bloco)}`, request.url), 303);
  }
  const mensagem = mensagemDe(r);
  const status = statusDe(r.tipo);
  if (querJson(request)) return Response.json({ ok: false, mensagem }, { status, headers: semCache });
  const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Contato</title><p>${escapar(mensagem)}</p><p><a href="/">Voltar para a bio</a></p></html>`;
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8", ...semCache } });
}

/** Recebe o formulário do bloco lead (HTML ou JSON). Falha no aviso não apaga o contato. */
export async function POST(request: Request): Promise<Response> {
  const tamanho = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(tamanho) && tamanho > LIMITE_CORPO) {
    return responder(request, { tipo: "invalido", mensagem: "Envio grande demais." }, "");
  }
  let bruto: Record<string, unknown>;
  try {
    bruto = await lerBruto(request);
  } catch {
    return responder(request, { tipo: "invalido", mensagem: "Não foi possível ler o formulário." }, "");
  }
  const bloco = typeof bruto.bloco === "string" ? bruto.bloco : "";
  // O HTML pode estar em cache. A hora da visita vem do cookie, senão do campo escondido.
  const peloCookie = abertoDoCookie(request.headers.get("cookie"));
  if (peloCookie) bruto.aberto = peloCookie;
  const config = await obterConfig();
  const r = await tratarLead(bruto, {
    agora: Date.now(),
    blocos: blocosDaPagina(config),
    supabase: supabaseConfigurado(),
    ip: ipDoPedido(request),
    sal: process.env.ADMIN_SESSION_SECRET || lerSupabase(process.env)?.url || "linkbio-lead",
    contar: contarLeadsRecentes,
    gravar: gravarLead,
    avisar: (aviso) =>
      avisarDono(
        aviso,
        {
          LEAD_WEBHOOK_URL: process.env.LEAD_WEBHOOK_URL,
          RESEND_API_KEY: process.env.RESEND_API_KEY,
          LEAD_EMAIL_PARA: process.env.LEAD_EMAIL_PARA,
          LEAD_EMAIL_DE: process.env.LEAD_EMAIL_DE,
        },
        (url, init) => fetch(url, init),
      ),
  });
  return responder(request, r, bloco);
}
