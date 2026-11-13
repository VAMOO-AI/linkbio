import "server-only";
import { semColunaDeOrigem } from "@/lib/origem";
import { rest } from "@/lib/supabase";
import type { ReservaPaga } from "./pagamento";
import type { ReservaGravada, ReservaNova, ResultadoInsercao } from "./reserva";

const SEM_CACHE = { cache: "no-store" } as const;

/** Reservas confirmadas e as que esperam o Pix que cruzam o intervalo (tiram o horário da lista e contam no teto do dia). */
export async function reservasEntre(deIso: string, ateIso: string): Promise<{ inicio: string; fim: string }[]> {
  const linhas = await rest<{ inicio: string; fim: string }[]>(
    `agendamentos?select=inicio,fim&status=in.(confirmado,aguardando_pagamento)&fim=gt.${encodeURIComponent(deIso)}&inicio=lt.${encodeURIComponent(ateIso)}&order=inicio`,
    SEM_CACHE,
  );
  return linhas ?? [];
}

export async function reservaPorPedido(requestId: string): Promise<ReservaGravada | null> {
  const linhas = await rest<ReservaGravada[]>(
    `agendamentos?select=id,servico,inicio,fim,meet_url,status,valor_centavos,expira_em&request_id=eq.${encodeURIComponent(requestId)}&limit=1`,
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
    // A ordem importa: as duas constraints dão 23P01.
    if (msg.includes("agendamentos_valor_unico_email")) return { ok: false, motivo: "valor" };
    if (msg.includes("23P01") || msg.includes("agendamentos_sem_sobrepor")) return { ok: false, motivo: "ocupado" };
    if (msg.includes("23505")) return { ok: false, motivo: "repetido" };
    return { ok: false, motivo: "falha" };
  }
}

export async function anexarEvento(id: string, evento: { eventoId: string; meetUrl: string | null }): Promise<void> {
  await rest(`agendamentos?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ google_evento_id: evento.eventoId, evento_id: evento.eventoId, meet_url: evento.meetUrl }),
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

/** Prazo do Pix vencido vira "expirado" (função da 0013). */
export async function expirarPrazos(): Promise<void> {
  await rest("rpc/agendamentos_expirar", { method: "POST", body: "{}", ...SEM_CACHE });
}

export async function anexarCobranca(id: string, ref: string): Promise<void> {
  await rest(`agendamentos?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ pagamento_ref: ref }),
    ...SEM_CACHE,
  });
}

const CAMPOS_PAGA =
  "id,bloco,servico,inicio,fim,status,nome,whatsapp,email,valor_centavos,pagamento_modo,pagamento_ref,expira_em,created_at,valor_preso_ate,meet_url,evento_id,request_id";

export async function reservaPorToken(hash: string): Promise<ReservaPaga | null> {
  const linhas = await rest<ReservaPaga[]>(`agendamentos?select=${CAMPOS_PAGA}&token_hash=eq.${encodeURIComponent(hash)}&limit=1`, SEM_CACHE);
  return linhas?.[0] ?? null;
}

export async function reservaPorId(id: string): Promise<ReservaPaga | null> {
  const linhas = await rest<ReservaPaga[]>(`agendamentos?select=${CAMPOS_PAGA}&id=eq.${encodeURIComponent(id)}&limit=1`, SEM_CACHE);
  return linhas?.[0] ?? null;
}

/** Reservas do modo e-mail que ainda podem receber Pix (aguardando ou expiradas dentro das 48 h). */
export async function reservasEsperandoPixEmail(agoraIso: string): Promise<ReservaPaga[]> {
  const linhas = await rest<ReservaPaga[]>(
    `agendamentos?select=${CAMPOS_PAGA}&pagamento_modo=eq.email&status=in.(aguardando_pagamento,expirado)&valor_preso_ate=gt.${encodeURIComponent(agoraIso)}&order=created_at&limit=500`,
    SEM_CACHE,
  );
  return linhas ?? [];
}

/** Reservas do Mercado Pago aguardando, para a varredura conferir no PSP. */
export async function reservasEsperandoMercadoPago(desdeIso: string): Promise<ReservaPaga[]> {
  const linhas = await rest<ReservaPaga[]>(
    `agendamentos?select=${CAMPOS_PAGA}&pagamento_modo=eq.mercadopago&status=in.(aguardando_pagamento,expirado)&pagamento_ref=not.is.null&created_at=gt.${encodeURIComponent(desdeIso)}&limit=200`,
    SEM_CACHE,
  );
  return linhas ?? [];
}

/** Aguardando/expirado → confirmado, uma vez só. "ocupado": o horário foi de outra pessoa (23P01). */
export async function marcarConfirmado(id: string, pago: { em: string; ref: string | null }): Promise<"ok" | "ocupado" | "ja"> {
  try {
    const linhas = await rest<{ id: string }[]>(
      `agendamentos?id=eq.${encodeURIComponent(id)}&status=in.(aguardando_pagamento,expirado)&select=id`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ status: "confirmado", pago_em: pago.em, ...(pago.ref ? { pagamento_ref: pago.ref } : {}) }),
        ...SEM_CACHE,
      },
    );
    return linhas && linhas.length > 0 ? "ok" : "ja";
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("23P01") || msg.includes("agendamentos_sem_sobrepor")) return "ocupado";
    throw e;
  }
}

export async function marcarSemHorario(id: string, pago: { em: string; ref: string | null }): Promise<void> {
  await rest(`agendamentos?id=eq.${encodeURIComponent(id)}&status=neq.confirmado`, {
    method: "PATCH",
    body: JSON.stringify({ status: "pago_sem_horario", pago_em: pago.em, ...(pago.ref ? { pagamento_ref: pago.ref } : {}) }),
    ...SEM_CACHE,
  });
}

/** Grava o Pix recebido uma vez só. false: já tinha sido visto (outra varredura ou webhook repetido). */
export async function registrarRecebido(p: { id: string; origem: "mercadopago" | "email"; valorCentavos: number; recebidoEm: string; agendamentoId: string | null }): Promise<boolean> {
  const linhas = await rest<{ id: string }[]>("pagamentos_recebidos?on_conflict=id&select=id", {
    method: "POST",
    headers: { Prefer: "return=representation,resolution=ignore-duplicates" },
    body: JSON.stringify({ id: p.id, origem: p.origem, valor_centavos: p.valorCentavos, recebido_em: p.recebidoEm, agendamento_id: p.agendamentoId }),
    ...SEM_CACHE,
  });
  return (linhas?.length ?? 0) > 0;
}

/** No máximo uma varredura por nome a cada `segundos` (função da 0013). */
export async function pegarTrava(nome: string, segundos: number): Promise<boolean> {
  const r = await rest<boolean>("rpc/agenda_pegar_trava", {
    method: "POST",
    body: JSON.stringify({ p_nome: nome, p_segundos: segundos }),
    ...SEM_CACHE,
  });
  return r === true;
}

/** Remarcar: troca o horário de uma reserva confirmada ou paga sem horário. A constraint barra sobreposição. */
export async function moverReserva(id: string, inicio: string, fim: string): Promise<"ok" | "ocupado"> {
  try {
    await rest(`agendamentos?id=eq.${encodeURIComponent(id)}&status=in.(confirmado,pago_sem_horario)`, {
      method: "PATCH",
      body: JSON.stringify({ inicio, fim, status: "confirmado" }),
      ...SEM_CACHE,
    });
    return "ok";
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("23P01") || msg.includes("agendamentos_sem_sobrepor")) return "ocupado";
    throw e;
  }
}

/** Conta Microsoft conectada (a Google fica em agenda_google). */
export async function lerConexaoMicrosoft(): Promise<{ refreshToken: string; conta: string | null } | null> {
  const linhas = await rest<{ refresh_token: string; conta: string | null }[]>(
    "agenda_conexao?select=refresh_token,conta&provedor=eq.microsoft&limit=1",
    SEM_CACHE,
  );
  const l = linhas?.[0];
  return l?.refresh_token ? { refreshToken: l.refresh_token, conta: l.conta } : null;
}

/** O refresh token da Microsoft gira a cada uso: grava o novo. */
export async function salvarRefreshMicrosoft(refreshToken: string): Promise<void> {
  await rest("agenda_conexao?provedor=eq.microsoft", {
    method: "PATCH",
    body: JSON.stringify({ refresh_token: refreshToken, updated_at: new Date().toISOString() }),
    ...SEM_CACHE,
  });
}
