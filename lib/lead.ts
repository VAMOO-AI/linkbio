import { createHash } from "node:crypto";
import { z } from "zod";

/** Quanto tempo o formulário precisa ficar aberto antes do envio (corta robô que dispara na hora). */
export const ESPERA_MINIMA_MS = 2_000;
/** Envios aceitos por aparelho nesta janela. O que passa disso recebe "tente mais tarde". */
export const LIMITE_POR_HORA = 5;
const JANELA_MS = 60 * 60 * 1000;
const FORMULARIO_VELHO_MS = 7 * 24 * 60 * 60 * 1000;

export const MENSAGEM_CEDO = "Espere um instante e envie de novo.";
export const MENSAGEM_LIMITE = "Muitos envios agora. Tente de novo mais tarde.";
export const MENSAGEM_SEM_BANCO = "O formulário não está disponível agora. Chame no WhatsApp.";
export const MENSAGEM_FALHA = "Não foi possível guardar o contato. Tente de novo em instantes.";
export const MENSAGEM_RECARREGAR = "Recarregue a página e envie de novo.";
export const MENSAGEM_SUMIU = "Este formulário não está mais disponível.";
export const MENSAGEM_CONCORDANCIA = "Marque a caixa de concordância para enviar.";
export const MENSAGEM_WHATSAPP = "Informe um WhatsApp com DDD.";
export const MENSAGEM_EMAIL = "Informe um e-mail válido.";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Bloco como a página enxerga: o índice conta só os ligados, igual ao formulário. */
export type BlocoNaPagina = {
  type: string;
  enabled?: boolean;
  id?: string;
  pedir?: "whatsapp" | "email" | "ambos";
  entrega?: { url: string };
};

export type LeadGravado = {
  bloco: string;
  nome: string;
  whatsapp: string | null;
  email: string | null;
  entrega: string | null;
  ip_hash: string;
};

export type AvisoLead = {
  bloco: string;
  nome: string;
  whatsapp: string | null;
  email: string | null;
  entrega: string | null;
  criado_em: string;
};

export type ResultadoLead =
  | { tipo: "ok"; gravado: LeadGravado; avisosFalhos: string[] }
  | { tipo: "isca" }
  | { tipo: "cedo" }
  | { tipo: "limite" }
  | { tipo: "invalido"; mensagem: string }
  | { tipo: "sem-banco" }
  | { tipo: "falha"; mensagem: string };

export type ContatoLista = {
  id: string;
  bloco: string;
  nome: string;
  whatsapp: string | null;
  email: string | null;
  created_at: string;
};

const EntradaSchema = z.object({
  bloco: z.string().trim().min(1, MENSAGEM_SUMIU).max(80, MENSAGEM_SUMIU),
  nome: z.string().trim().min(2, "O nome precisa ter ao menos 2 letras.").max(80, "O nome deve ter no máximo 80 caracteres."),
  whatsapp: z.string().optional().default(""),
  email: z.string().optional().default(""),
  consentimento: z.string().optional().default(""),
  aberto: z.string().optional().default(""),
});

/** SHA-256 do IP com um sal do servidor. O banco guarda só este texto, nunca o IP. */
export function hashIp(ip: string, sal: string): string {
  return createHash("sha256").update(`linkbio-lead\n${sal}\n${ip}`).digest("hex");
}

/** Hora em que a bio foi aberta, gravada pelo proxy em `lead_aberto`. Vazio se o cookie não veio. */
export function abertoDoCookie(cabecalho: string | null): string | undefined {
  if (!cabecalho) return undefined;
  const parte = cabecalho.split(";").map((s) => s.trim()).find((s) => s.startsWith("lead_aberto="));
  const valor = parte?.slice("lead_aberto=".length);
  return valor && /^\d{10,16}$/.test(valor) ? valor : undefined;
}

export function ipDoPedido(request: Request): string {
  const encaminhado = request.headers.get("x-forwarded-for");
  const bruto = (encaminhado?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "desconhecido").trim();
  return bruto.slice(0, 80) || "desconhecido";
}

function telefone(valor: string): string | null {
  const digitos = valor.replace(/\D/g, "");
  if (digitos.length < 10 || digitos.length > 15) return null;
  return digitos;
}

function acharBloco(blocos: BlocoNaPagina[], id: string): BlocoNaPagina | undefined {
  const ativos = blocos.filter((b) => b.enabled !== false);
  return ativos.find((b, i) => b.type === "lead" && (b.id ?? `lead-${i}`) === id);
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor : "";
}

/**
 * Decide se o envio entra. Não fala com a rede: quem chama grava e avisa.
 * Isca (honeypot) parece sucesso e não grava. Aviso que falha não desfaz o contato.
 */
export async function tratarLead(
  bruto: Record<string, unknown>,
  ctx: {
    agora: number;
    blocos: BlocoNaPagina[];
    supabase: boolean;
    ip: string;
    sal: string;
    contar: (hash: string, desdeIso: string) => Promise<number>;
    gravar: (lead: LeadGravado) => Promise<void>;
    avisar: (aviso: AvisoLead) => Promise<string[]>;
  },
): Promise<ResultadoLead> {
  if (texto(bruto.empresa).trim()) return { tipo: "isca" };

  const lido = EntradaSchema.safeParse({
    bloco: bruto.bloco,
    nome: bruto.nome,
    whatsapp: bruto.whatsapp,
    email: bruto.email,
    consentimento: bruto.consentimento,
    aberto: bruto.aberto,
  });
  if (!lido.success) {
    return { tipo: "invalido", mensagem: lido.error.issues[0]?.message ?? MENSAGEM_RECARREGAR };
  }
  const entrada = lido.data;
  const bloco = acharBloco(ctx.blocos, entrada.bloco);
  if (!bloco || bloco.pedir === undefined) return { tipo: "invalido", mensagem: MENSAGEM_SUMIU };
  if (entrada.consentimento !== "sim") return { tipo: "invalido", mensagem: MENSAGEM_CONCORDANCIA };

  const pedeWhatsapp = bloco.pedir === "whatsapp" || bloco.pedir === "ambos";
  const pedeEmail = bloco.pedir === "email" || bloco.pedir === "ambos";
  const whatsapp = pedeWhatsapp ? telefone(entrada.whatsapp) : null;
  if (pedeWhatsapp && !whatsapp) return { tipo: "invalido", mensagem: MENSAGEM_WHATSAPP };
  const email = pedeEmail ? entrada.email.trim() : "";
  if (pedeEmail && !EMAIL.test(email)) return { tipo: "invalido", mensagem: MENSAGEM_EMAIL };

  const aberto = Number(entrada.aberto);
  if (!Number.isFinite(aberto)) return { tipo: "invalido", mensagem: MENSAGEM_RECARREGAR };
  const delta = ctx.agora - aberto;
  if (delta < -60_000 || delta > FORMULARIO_VELHO_MS) return { tipo: "invalido", mensagem: MENSAGEM_RECARREGAR };
  if (delta < ESPERA_MINIMA_MS) return { tipo: "cedo" };

  if (!ctx.supabase) return { tipo: "sem-banco" };

  const ipHash = hashIp(ctx.ip, ctx.sal);
  const desde = new Date(ctx.agora - JANELA_MS).toISOString();
  if ((await ctx.contar(ipHash, desde)) >= LIMITE_POR_HORA) return { tipo: "limite" };

  const gravado: LeadGravado = {
    bloco: entrada.bloco,
    nome: entrada.nome,
    whatsapp,
    email: email || null,
    entrega: bloco.entrega?.url ?? null,
    ip_hash: ipHash,
  };
  try {
    await ctx.gravar(gravado);
  } catch {
    return { tipo: "falha", mensagem: MENSAGEM_FALHA };
  }

  let avisosFalhos: string[] = [];
  try {
    avisosFalhos = await ctx.avisar({
      bloco: gravado.bloco,
      nome: gravado.nome,
      whatsapp: gravado.whatsapp,
      email: gravado.email,
      entrega: gravado.entrega,
      criado_em: new Date(ctx.agora).toISOString(),
    });
  } catch {
    avisosFalhos = ["aviso"];
  }
  return { tipo: "ok", gravado, avisosFalhos };
}

type Busca = (input: string, init?: RequestInit) => Promise<Response>;

/** Avisa o dono. Cada canal que falha entra na lista; nenhum erro sobe. */
export async function avisarDono(
  aviso: AvisoLead,
  env: { LEAD_WEBHOOK_URL?: string; RESEND_API_KEY?: string; LEAD_EMAIL_PARA?: string; LEAD_EMAIL_DE?: string },
  fetchImpl: Busca,
): Promise<string[]> {
  const falhas: string[] = [];
  const webhook = env.LEAD_WEBHOOK_URL?.trim();
  if (webhook) {
    try {
      const resposta = await fetchImpl(webhook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(aviso),
        signal: AbortSignal.timeout(8_000),
      });
      if (!resposta.ok) falhas.push("webhook");
    } catch {
      falhas.push("webhook");
    }
  }

  const chave = env.RESEND_API_KEY?.trim();
  const para = env.LEAD_EMAIL_PARA?.trim();
  if (chave && para) {
    const linhas = [
      `${aviso.nome} enviou o formulário "${aviso.bloco}".`,
      aviso.whatsapp ? `WhatsApp: ${aviso.whatsapp}` : "",
      aviso.email ? `E-mail: ${aviso.email}` : "",
      aviso.entrega ? `Material: ${aviso.entrega}` : "",
      `Quando: ${aviso.criado_em}`,
    ].filter(Boolean);
    try {
      const resposta = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${chave}`, "content-type": "application/json" },
        body: JSON.stringify({
          from: env.LEAD_EMAIL_DE?.trim() || "Bio <onboarding@resend.dev>",
          to: [para],
          subject: `Novo contato na bio: ${aviso.nome}`,
          text: linhas.join("\n"),
        }),
        signal: AbortSignal.timeout(8_000),
      });
      if (!resposta.ok) falhas.push("email");
    } catch {
      falhas.push("email");
    }
  }
  return falhas;
}

function celula(valor: string | null): string {
  const textoCelula = valor ?? "";
  if (/[",\n\r]/.test(textoCelula)) return `"${textoCelula.replace(/"/g, '""')}"`;
  return textoCelula;
}

/** Planilha dos contatos (Excel abre o acento por causa do marcador no começo). */
export function csvDeContatos(linhas: Pick<ContatoLista, "nome" | "whatsapp" | "email" | "bloco" | "created_at">[]): string {
  const corpo = linhas.map((l) => [celula(l.nome), celula(l.whatsapp), celula(l.email), celula(l.bloco), celula(l.created_at)].join(","));
  return `\uFEFFnome,whatsapp,email,bloco,quando\n${corpo.join("\n")}`;
}
