import "server-only";
import { semColunaDeOrigem } from "@/lib/origem";
import { rest } from "@/lib/supabase";
import type { ReservaGravada, ReservaNova, ResultadoInsercao } from "./reserva";

const SEM_CACHE = { cache: "no-store" } as const;

/** Reservas confirmadas que cruzam o intervalo (para tirar da agenda e para o teto do dia). */
export async function reservasEntre(deIso: string, ateIso: string): Promise<{ inicio: string; fim: string }[]> {
  const linhas = await rest<{ inicio: string; fim: string }[]>(
    `agendamentos?select=inicio,fim&status=eq.confirmado&fim=gt.${encodeURIComponent(deIso)}&inicio=lt.${encodeURIComponent(ateIso)}&order=inicio`,
    SEM_CACHE,
  );
  return linhas ?? [];
}

export async function reservaPorPedido(requestId: string): Promise<ReservaGravada | null> {
  const linhas = await rest<ReservaGravada[]>(
    `agendamentos?select=id,servico,inicio,fim,meet_url&request_id=eq.${encodeURIComponent(requestId)}&limit=1`,
    SEM_CACHE,
  );
  return linhas?.[0] ?? null;
}

export async function contarReservasDoIp(hash: string, desdeIso: string): Promise<number> {
  const linhas = await rest<{ id: string }[]>(
    `agendamentos?select=id&ip_hash=eq.${encodeURIComponent(hash)}&created_at=gte.${encodeURIComponent(desdeIso)}&limit=10`,
    SEM_CACHE,
  );
  return linhas?.length ?? 0;
}

/** Grava a reserva. Horário já tomado (constraint de sobreposição) volta como "ocupado". */
export async function inserirReserva(nova: ReservaNova): Promise<ResultadoInsercao> {
  const gravar = (corpo: unknown) =>
    rest<{ id: string }[]>("agendamentos?select=id", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(corpo),
      ...SEM_CACHE,
    });
  try {
    let linhas: { id: string }[];
    try {
      linhas = await gravar(nova);
    } catch (e) {
      // Banco que ainda não rodou a 0010: grava sem a origem em vez de perder a reserva.
      if (!semColunaDeOrigem(e)) throw e;
      console.error("[linkbio] agendamentos sem as colunas origem/utm: rode supabase/migrations/0010_origem.sql.");
      const { origem: _o, utm: _u, ...semOrigem } = nova;
      linhas = await gravar(semOrigem);
    }
    const id = linhas?.[0]?.id;
    return id ? { ok: true, id } : { ok: false, motivo: "falha" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("23P01") || msg.includes("agendamentos_sem_sobrepor")) return { ok: false, motivo: "ocupado" };
    if (msg.includes("23505")) return { ok: false, motivo: "repetido" };
    return { ok: false, motivo: "falha" };
  }
}

export async function anexarEvento(id: string, evento: { eventoId: string; meetUrl: string | null }): Promise<void> {
  await rest(`agendamentos?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ google_evento_id: evento.eventoId, meet_url: evento.meetUrl }),
    ...SEM_CACHE,
  });
}

export async function removerReserva(id: string): Promise<void> {
  await rest(`agendamentos?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", ...SEM_CACHE });
}

/** Refresh token da conta Google conectada. Nulo se ninguém conectou ainda. */
export async function lerConexaoGoogle(): Promise<{ refreshToken: string; conta: string | null } | null> {
  const linhas = await rest<{ refresh_token: string; conta: string | null }[]>(
    "agenda_google?select=refresh_token,conta&id=eq.1&limit=1",
    SEM_CACHE,
  );
  const l = linhas?.[0];
  return l?.refresh_token ? { refreshToken: l.refresh_token, conta: l.conta } : null;
}
