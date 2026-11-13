import "server-only";
import { avisarDono } from "@/lib/lead";
import { supabaseConfigurado } from "@/lib/supabase";
import {
  anexarCobranca,
  anexarEvento,
  contarReservasDoIp,
  expirarPrazos,
  inserirReserva,
  lerConexaoGoogle,
  lerConexaoMicrosoft,
  marcarConfirmado,
  marcarSemHorario,
  moverReserva,
  pegarTrava,
  registrarRecebido,
  removerReserva,
  reservaPorId,
  reservaPorPedido,
  reservaPorToken,
  reservasEntre,
  reservasEsperandoPixEmail,
  salvarRefreshMicrosoft,
} from "./banco";
import { imapNoAmbiente, lerAvisosRecentes } from "./caixa-email";
import { criarEventoGoogle, ErroGoogle, moverEventoGoogle, ocupadoGoogle, type CredenciaisGoogle, type EventoNovo } from "./google";
import type { Ocupado } from "./horarios";
import { cancelarPagamentoMP, consultarPagamentoMP, criarCobrancaMP } from "./mercadopago";
import { criarEventoMicrosoft, ErroMicrosoft, moverEventoMicrosoft, msNoAmbiente, ocupadoMicrosoft, type CredMicrosoft } from "./microsoft";
import type { Block } from "@/config/schema";
import { lerSupabase } from "@/lib/supabase-chave";
import { tokenDoPedido } from "./pagamento";
import { acharBlocoAgendamento, type BlocoAgendamento } from "./regra";
import type { DepsRemarcar } from "./remarcar";
import type { AvisoReserva, DepsReserva } from "./reserva";
import type { DadosDoBloco, DepsStatus } from "./status";

/** Sal do token da reserva e do hash do IP. Mudar este valor invalida os links de trocar horário. */
export function salDaAgenda(env: Record<string, string | undefined> = process.env): string {
  return env.ADMIN_SESSION_SECRET || lerSupabase(env)?.url || "linkbio-agenda";
}

export type Provedor = "google" | "microsoft";

/** Client id e secret do Google no ambiente (o refresh token fica no banco). */
export function googleNoAmbiente(env: Record<string, string | undefined> = process.env): { clientId: string; clientSecret: string } | null {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function mpNoAmbiente(env: Record<string, string | undefined> = process.env): { accessToken: string } | null {
  const accessToken = env.MP_ACCESS_TOKEN?.trim();
  return accessToken ? { accessToken } : null;
}

/** Banco e agenda configurados no ambiente. A conexão em si (refresh token) só se sabe na hora. */
export function agendamentoNoAmbiente(provedor: Provedor = "google"): boolean {
  if (!supabaseConfigurado()) return false;
  return provedor === "microsoft" ? msNoAmbiente() !== null : googleNoAmbiente() !== null;
}

/** O que falta no ambiente para o bloco cobrar. Vazio: pronto. */
export function pagamentoNoAmbiente(bloco: BlocoAgendamento): string[] {
  const pago = bloco.pagamento && bloco.servicos.some((s) => (s.price_cents ?? 0) > 0);
  if (!pago) return [];
  if (bloco.pagamento!.modo === "mercadopago") return mpNoAmbiente() ? [] : ["MP_ACCESS_TOKEN"];
  return imapNoAmbiente() ? [] : ["IMAP_HOST", "IMAP_USER", "IMAP_PASS"];
}

/** Conexão caída (reconectar a conta), para a rota responder "desconectado". */
export function erroDeConexao(e: unknown): boolean {
  return (e instanceof ErroGoogle || e instanceof ErroMicrosoft) && e.tipo === "token";
}

async function credGoogle(): Promise<CredenciaisGoogle> {
  const app = googleNoAmbiente();
  if (!app) throw new ErroGoogle("token", "GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET não estão no ambiente.");
  const conexao = await lerConexaoGoogle();
  if (!conexao) throw new ErroGoogle("token", "Nenhuma conta Google conectada (rode npm run google:conectar).");
  return { ...app, refreshToken: conexao.refreshToken };
}

async function credMicrosoft(): Promise<CredMicrosoft> {
  const app = msNoAmbiente();
  if (!app) throw new ErroMicrosoft("token", "MS_CLIENT_ID não está no ambiente.");
  const conexao = await lerConexaoMicrosoft();
  if (!conexao) throw new ErroMicrosoft("token", "Nenhuma conta Microsoft conectada (rode npm run microsoft:conectar).");
  return { ...app, refreshToken: conexao.refreshToken };
}

const busca = (url: string, init?: RequestInit) => fetch(url, { ...init, cache: "no-store" });

/** Agenda do dono: lê o ocupado e cria o evento, no Google ou na Microsoft. */
function agenda(provedor: Provedor, tz: string) {
  if (provedor === "microsoft") {
    return {
      ocupado: async (de: string, ate: string): Promise<Ocupado[]> => ocupadoMicrosoft(await credMicrosoft(), de, ate, tz, busca, salvarRefreshMicrosoft),
      criarEvento: async (ev: Omit<EventoNovo, "tz">) => criarEventoMicrosoft(await credMicrosoft(), { ...ev, tz }, busca, salvarRefreshMicrosoft),
      moverEvento: async (id: string, inicio: string, fim: string) =>
        moverEventoMicrosoft(await credMicrosoft(), { id, inicio, fim }, busca, salvarRefreshMicrosoft),
    };
  }
  return {
    ocupado: async (de: string, ate: string): Promise<Ocupado[]> => ocupadoGoogle(await credGoogle(), de, ate, tz, busca),
    criarEvento: async (ev: Omit<EventoNovo, "tz">) => criarEventoGoogle(await credGoogle(), { ...ev, tz }, busca),
    moverEvento: async (id: string, inicio: string, fim: string) => moverEventoGoogle(await credGoogle(), { id, inicio, fim, tz }, busca),
  };
}

/** Dependências do remarcar pelo link do convite. */
export function depsDeRemarcar(tz: string, provedor: Provedor): DepsRemarcar {
  return {
    ...agenda(provedor, tz),
    porToken: reservaPorToken,
    reservasEntre,
    mover: moverReserva,
    anexarEvento,
    marcarSemHorario,
    avisar,
  };
}

function avisar(aviso: AvisoReserva): Promise<string[]> {
  return avisarDono(
    aviso,
    {
      LEAD_WEBHOOK_URL: process.env.LEAD_WEBHOOK_URL,
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      LEAD_EMAIL_PARA: process.env.LEAD_EMAIL_PARA,
      LEAD_EMAIL_DE: process.env.LEAD_EMAIL_DE,
    },
    (url, init) => fetch(url, init),
  );
}

/** URL pública do webhook do Mercado Pago (NEXT_PUBLIC_SITE_URL ou o domínio do Vercel). */
export function urlDoWebhookMP(env: Record<string, string | undefined> = process.env): string | undefined {
  const base = env.NEXT_PUBLIC_SITE_URL?.trim() || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  return base ? `${base.replace(/\/$/, "")}/api/agendamento/mercadopago` : undefined;
}

/** Dependências reais da reserva: banco pelo PostgREST, agenda pela API e aviso pelo canal do lead. */
export function depsDoServidor(tz: string, provedor: Provedor = "google"): DepsReserva {
  const mp = mpNoAmbiente();
  return {
    ...agenda(provedor, tz),
    reservasEntre,
    expirar: expirarPrazos,
    porPedido: reservaPorPedido,
    contarDoIp: contarReservasDoIp,
    inserir: inserirReserva,
    anexarEvento,
    remover: removerReserva,
    avisar,
    cobrar: mp ? (c) => criarCobrancaMP(mp, { ...c, notificacaoUrl: urlDoWebhookMP() }, busca) : undefined,
    anexarCobranca,
  };
}

/**
 * Dependências do que acontece depois da reserva paga. O provedor da agenda sai do bloco da
 * reserva (a bio tem um bloco agendamento por provedor no máximo).
 */
export function depsDeStatus(tz: string, provedor: Provedor): DepsStatus {
  const mp = mpNoAmbiente();
  const imap = imapNoAmbiente();
  return {
    ...agenda(provedor, tz),
    porToken: reservaPorToken,
    porId: reservaPorId,
    expirar: expirarPrazos,
    registrarRecebido,
    pegarTrava,
    esperandoPixEmail: reservasEsperandoPixEmail,
    lerAvisos: imap ? (desde) => lerAvisosRecentes(imap, desde) : undefined,
    consultarMP: mp ? (id) => consultarPagamentoMP(mp, id, busca) : undefined,
    cancelarMP: mp ? (id) => cancelarPagamentoMP(mp, id, busca) : undefined,
    marcarConfirmado,
    marcarSemHorario,
    anexarEvento,
    avisar,
  };
}

/** Título, local e intervalo do serviço da reserva, lidos do bloco publicado. */
export function dadosDosBlocos(blocos: readonly Block[], siteUrl?: string): DadosDoBloco {
  return (r) => {
    const bloco = acharBlocoAgendamento(blocos, r.bloco);
    const servico = bloco?.servicos.find((s) => s.id === r.servico);
    if (!bloco || !servico) return null;
    // Link de trocar horário no convite: abre a bio já na reserva (o token sai do request_id).
    const base = siteUrl?.replace(/\/$/, "");
    const linkTrocar =
      base && r.request_id ? `${base}/?agenda=${encodeURIComponent(tokenDoPedido(r.request_id, salDaAgenda()))}#agendamento-${r.bloco}` : null;
    return { titulo: servico.title, local: bloco.local?.trim() || null, intervaloMin: bloco.intervalo ?? 15, linkTrocar };
  };
}
