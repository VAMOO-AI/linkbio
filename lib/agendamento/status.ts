/**
 * Depois da reserva paga: consulta pelo token, aviso (webhook) do Mercado Pago e varredura da
 * caixa de e-mail. Tudo termina em `confirmarPagamento`. Não fala com a rede: tudo vem em `deps`.
 */
import { casarPagamento, confirmarPagamento, hashDoToken, lerAvisoPix, type DepsConfirmacao, type ReservaPaga } from "./pagamento";

/** Varredura da caixa: no máximo uma a cada 20 s, olhando os últimos 3 dias. */
export const INTERVALO_VARREDURA_S = 20;
const JANELA_CAIXA_MS = 3 * 24 * 60 * 60 * 1000;

export type PagamentoMP = { id: string; status: string; reservaId: string | null; valorCentavos: number; aprovadoEm: string | null };

/** O que o confirmar precisa saber do bloco da reserva (título do serviço, local, intervalo). */
export type DadosDoBloco = (r: ReservaPaga) => { titulo: string; local: string | null; intervaloMin: number; linkTrocar?: string | null } | null;

export type DepsStatus = DepsConfirmacao & {
  porToken: (hash: string) => Promise<ReservaPaga | null>;
  porId: (id: string) => Promise<ReservaPaga | null>;
  expirar: () => Promise<void>;
  registrarRecebido: (p: { id: string; origem: "mercadopago" | "email"; valorCentavos: number; recebidoEm: string; agendamentoId: string | null }) => Promise<boolean>;
  pegarTrava: (nome: string, segundos: number) => Promise<boolean>;
  esperandoPixEmail: (agoraIso: string) => Promise<ReservaPaga[]>;
  /** Modo email: avisos da caixa desde a data. Sem caixa configurada: ausente. */
  lerAvisos?: (desde: Date) => Promise<{ id: string; recebidoEm: string; texto: string }[]>;
  /** Modo mercadopago. */
  consultarMP?: (id: string) => Promise<PagamentoMP>;
  cancelarMP?: (id: string) => Promise<void>;
};

export type CtxStatus = { tz: string; agora: number; dados: DadosDoBloco; deps: DepsStatus };

export type EstadoPublico =
  | { estado: "aguardando"; expiraEm: string; valorCentavos: number | null }
  | { estado: "confirmado"; servico: string; inicio: string; fim: string; meetUrl: string | null }
  | { estado: "expirado" }
  | { estado: "pago_sem_horario"; servico: string }
  | { estado: "cancelado" };

async function confirmar(r: ReservaPaga, pago: { em: string; ref: string | null }, ctx: CtxStatus) {
  const d = ctx.dados(r);
  if (!d) return null;
  return confirmarPagamento(r, pago, { ...d, tz: ctx.tz, deps: ctx.deps });
}

/** Pix aprovado no Mercado Pago → confirma a reserva dele. Usado pelo webhook, pelo status e pela varredura. */
export async function processarPagamentoMP(id: string, ctx: CtxStatus): Promise<"confirmado" | "pago_sem_horario" | "ja" | "ignorado"> {
  const { deps } = ctx;
  if (!deps.consultarMP) return "ignorado";
  const p = await deps.consultarMP(id);
  if (p.status !== "approved" || !p.reservaId) return "ignorado";
  const r = await deps.porId(p.reservaId);
  if (!r || r.pagamento_modo !== "mercadopago") return "ignorado";
  await deps
    .registrarRecebido({ id: `mp:${p.id}`, origem: "mercadopago", valorCentavos: p.valorCentavos, recebidoEm: p.aprovadoEm ?? new Date(ctx.agora).toISOString(), agendamentoId: r.id })
    .catch(() => false);
  return (await confirmar(r, { em: p.aprovadoEm ?? new Date(ctx.agora).toISOString(), ref: p.id }, ctx)) ?? "ignorado";
}

/**
 * Lê a caixa e confirma o que casar. A trava no banco segura a frequência: muita gente olhando o
 * status ao mesmo tempo gera uma leitura só.
 */
export async function varrerCaixa(ctx: CtxStatus): Promise<number> {
  const { deps } = ctx;
  if (!deps.lerAvisos) return 0;
  if (!(await deps.pegarTrava("caixa-email", INTERVALO_VARREDURA_S))) return 0;
  const agoraIso = new Date(ctx.agora).toISOString();
  const candidatas = await deps.esperandoPixEmail(agoraIso);
  if (candidatas.length === 0) return 0;
  const avisos = await deps.lerAvisos(new Date(ctx.agora - JANELA_CAIXA_MS));
  let confirmadas = 0;
  for (const a of avisos) {
    const lido = lerAvisoPix(a.texto);
    if (!lido) continue;
    const r = casarPagamento({ valorCentavos: lido.valorCentavos, recebidoEm: a.recebidoEm }, candidatas);
    if (!r) continue;
    // Mesmo aviso visto em duas varreduras: só a primeira confirma.
    const novo = await deps.registrarRecebido({ id: a.id, origem: "email", valorCentavos: lido.valorCentavos, recebidoEm: a.recebidoEm, agendamentoId: r.id });
    if (!novo) continue;
    const res = await confirmar(r, { em: a.recebidoEm, ref: a.id }, ctx);
    if (res === "confirmado") confirmadas++;
    r.status = res === "pago_sem_horario" ? "pago_sem_horario" : "confirmado";
  }
  return confirmadas;
}

function publico(r: ReservaPaga, agora: number): EstadoPublico {
  if (r.status === "confirmado") return { estado: "confirmado", servico: r.servico, inicio: r.inicio, fim: r.fim, meetUrl: r.meet_url ?? null };
  if (r.status === "pago_sem_horario") return { estado: "pago_sem_horario", servico: r.servico };
  if (r.status === "cancelado") return { estado: "cancelado" };
  if (r.status === "expirado" || (r.expira_em && Date.parse(r.expira_em) < agora)) return { estado: "expirado" };
  return { estado: "aguardando", expiraEm: r.expira_em ?? new Date(agora).toISOString(), valorCentavos: r.valor_centavos };
}

/**
 * Estado da reserva para a tela do Pix (consultada a cada ~10 s). Enquanto espera, confere o
 * pagamento na fonte (Mercado Pago ou caixa). Prazo vencido no Mercado Pago: cancela o Pix lá,
 * para ninguém pagar um horário que já foi solto.
 */
export async function consultarStatus(token: string, ctx: CtxStatus): Promise<EstadoPublico | null> {
  const { deps } = ctx;
  let r = await deps.porToken(hashDoToken(token));
  if (!r) return null;
  if (r.status === "aguardando_pagamento" || r.status === "expirado") {
    if (r.pagamento_modo === "mercadopago" && r.pagamento_ref) {
      const res = await processarPagamentoMP(r.pagamento_ref, ctx).catch(() => "ignorado" as const);
      if (res === "ignorado" && publico(r, ctx.agora).estado === "expirado") {
        await deps.cancelarMP?.(r.pagamento_ref).catch(() => undefined);
      }
    } else if (r.pagamento_modo === "email") {
      await varrerCaixa(ctx).catch(() => 0);
    }
    await deps.expirar().catch(() => undefined);
    r = (await deps.porToken(hashDoToken(token))) ?? r;
  }
  return publico(r, ctx.agora);
}
