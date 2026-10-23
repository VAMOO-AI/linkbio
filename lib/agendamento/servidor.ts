import "server-only";
import { avisarDono } from "@/lib/lead";
import { supabaseConfigurado } from "@/lib/supabase";
import {
  anexarEvento,
  contarReservasDoIp,
  inserirReserva,
  lerConexaoGoogle,
  removerReserva,
  reservaPorPedido,
  reservasEntre,
} from "./banco";
import { criarEventoGoogle, ErroGoogle, ocupadoGoogle, type CredenciaisGoogle } from "./google";
import type { DepsReserva } from "./reserva";

/** Client id e secret do Google no ambiente (o refresh token fica no banco). */
export function googleNoAmbiente(env: Record<string, string | undefined> = process.env): { clientId: string; clientSecret: string } | null {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** Banco e Google configurados no ambiente. A conexão em si (refresh token) só se sabe na hora. */
export function agendamentoNoAmbiente(): boolean {
  return supabaseConfigurado() && googleNoAmbiente() !== null;
}

async function credenciais(): Promise<CredenciaisGoogle> {
  const app = googleNoAmbiente();
  if (!app) throw new ErroGoogle("token", "GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET não estão no ambiente.");
  const conexao = await lerConexaoGoogle();
  if (!conexao) throw new ErroGoogle("token", "Nenhuma conta Google conectada (rode npm run google:conectar).");
  return { ...app, refreshToken: conexao.refreshToken };
}

const busca = (url: string, init?: RequestInit) => fetch(url, { ...init, cache: "no-store" });

/** Dependências reais da reserva: banco pelo PostgREST, Google pela API e aviso pelo canal do lead. */
export function depsDoServidor(tz: string): DepsReserva {
  return {
    ocupado: async (de, ate) => ocupadoGoogle(await credenciais(), de, ate, tz, busca),
    reservasEntre,
    porPedido: reservaPorPedido,
    contarDoIp: contarReservasDoIp,
    inserir: inserirReserva,
    criarEvento: async (ev) => criarEventoGoogle(await credenciais(), { ...ev, tz }, busca),
    anexarEvento,
    remover: removerReserva,
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
  };
}
