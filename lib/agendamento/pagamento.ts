/**
 * Agenda paga: token da reserva, centavos próprios do modo e-mail, leitura do aviso do banco e a
 * confirmação depois do Pix. Não fala com a rede: banco, agenda e aviso chegam em `deps`.
 *
 * Um caminho só confirma (webhook do Mercado Pago, consulta de status e varredura da caixa de
 * e-mail chamam `confirmarPagamento`), e ele é idempotente: o banco só troca o status uma vez.
 */
import { createHash, createHmac } from "node:crypto";
import type { Ocupado } from "./horarios";
import type { AvisoReserva } from "./reserva";

export const PRAZO_PADRAO_MIN = 15;
/** O mesmo valor com centavos não volta a ser usado por 48 h depois do prazo. */
export const VALOR_PRESO_MS = 48 * 60 * 60 * 1000;

export type ModoPagamento = "mercadopago" | "email";
export type StatusReserva = "confirmado" | "cancelado" | "aguardando_pagamento" | "expirado" | "pago_sem_horario";

export type ReservaPaga = {
  id: string;
  bloco: string;
  servico: string;
  inicio: string;
  fim: string;
  status: StatusReserva | string;
  nome: string;
  whatsapp: string;
  email: string | null;
  valor_centavos: number | null;
  pagamento_modo: ModoPagamento | string | null;
  pagamento_ref?: string | null;
  expira_em: string | null;
  created_at: string;
  valor_preso_ate: string | null;
  meet_url?: string | null;
  /** Id do evento na agenda (Google ou Microsoft); antes da 0013 só existia google_evento_id. */
  evento_id?: string | null;
  /** Dá o token (com o sal do servidor) para o link de trocar horário no convite. */
  request_id?: string;
};

/**
 * Token da reserva (vai para a pessoa e serve para consultar e remarcar). Sai do request_id com
 * o sal do servidor: o mesmo pedido repetido recebe o mesmo token, sem guardar o token no banco.
 */
export function tokenDoPedido(requestId: string, sal: string): string {
  return createHmac("sha256", sal).update(`linkbio-agenda\n${requestId}`).digest("base64url");
}

/** O banco guarda só o hash do token. */
export function hashDoToken(token: string): string {
  return createHash("sha256").update(`linkbio-agenda-token\n${token}`).digest("hex");
}

/**
 * Os 99 valores possíveis (preço + 1 a 99 centavos: R$ 300,00 vira R$ 300,17) em ordem
 * embaralhada: cada um é tentado uma vez só.
 */
export function centavosEmbaralhados(baseCentavos: number, sorteio: () => number = Math.random): number[] {
  const lista = Array.from({ length: 99 }, (_, i) => baseCentavos + 1 + i);
  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(sorteio() * (i + 1));
    [lista[i], lista[j]] = [lista[j]!, lista[i]!];
  }
  return lista;
}

export function reais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function quando(inicioIso: string, tz: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz,
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(inicioIso));
}

const VALOR = /R\$\s?(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})/;
const SAIDA = /\b(enviad[oa]|envio|voc[eê] (pagou|enviou)|pagamento efetuado|fatura|boleto|d[eé]bito)\b/i;

/**
 * Lê o aviso de Pix recebido que o banco manda por e-mail. Genérico de propósito: pede "pix",
 * alguma forma de "receb" e um valor em reais; recusa aviso de saída (Pix enviado, fatura).
 */
export function lerAvisoPix(texto: string): { valorCentavos: number } | null {
  const t = texto.replace(/\s+/g, " ");
  if (!/pix/i.test(t) || !/receb/i.test(t) || SAIDA.test(t)) return null;
  const m = VALOR.exec(t);
  if (!m) return null;
  const valorCentavos = Number(m[1]!.replace(/\./g, "")) * 100 + Number(m[2]);
  return valorCentavos > 0 ? { valorCentavos } : null;
}

/**
 * Reserva do modo e-mail que esse Pix paga: valor exato, recebido entre a criação e o fim da
 * janela de 48 h. Pix recebido antes de a reserva existir não é dela.
 */
export function casarPagamento(
  pago: { valorCentavos: number; recebidoEm: string },
  candidatas: ReservaPaga[],
): ReservaPaga | null {
  const em = Date.parse(pago.recebidoEm);
  return (
    candidatas.find(
      (r) =>
        r.pagamento_modo === "email" &&
        r.valor_centavos === pago.valorCentavos &&
        (r.status === "aguardando_pagamento" || r.status === "expirado") &&
        Date.parse(r.created_at) <= em &&
        r.valor_preso_ate !== null &&
        em <= Date.parse(r.valor_preso_ate),
    ) ?? null
  );
}

export type DepsConfirmacao = {
  /** Troca para confirmado se ainda está aguardando ou expirado. "ocupado": o horário foi de outra pessoa (23P01). "ja": outro caminho confirmou antes. */
  marcarConfirmado: (id: string, pago: { em: string; ref: string | null }) => Promise<"ok" | "ocupado" | "ja">;
  marcarSemHorario: (id: string, pago: { em: string; ref: string | null }) => Promise<void>;
  /** Ocupado da agenda do dono (Google ou Microsoft). */
  ocupado: (deIso: string, ateIso: string) => Promise<Ocupado[]>;
  criarEvento: (ev: {
    titulo: string;
    descricao: string;
    inicio: string;
    fim: string;
    convidado: string | null;
    local: string | null;
    requestId: string;
  }) => Promise<{ id: string; meetUrl: string | null }>;
  anexarEvento: (id: string, evento: { eventoId: string; meetUrl: string | null }) => Promise<void>;
  avisar: (aviso: AvisoReserva) => Promise<string[]>;
};

export type ResultadoConfirmacao = "confirmado" | "pago_sem_horario" | "ja";

/** Pix recebido → reserva confirmada com evento na agenda, ou "pago sem horário" com aviso ao dono. */
export async function confirmarPagamento(
  r: ReservaPaga,
  pago: { em: string; ref: string | null },
  ctx: { titulo: string; tz: string; local: string | null; intervaloMin: number; linkTrocar?: string | null; deps: DepsConfirmacao },
): Promise<ResultadoConfirmacao> {
  const { deps, tz } = ctx;
  if (r.status === "confirmado" || r.status === "pago_sem_horario" || r.status === "cancelado") return "ja";

  const valor = r.valor_centavos ? `R$ ${reais(r.valor_centavos)}` : "Pix";
  const aviso = (entrega: string): AvisoReserva => ({
    bloco: r.bloco,
    nome: r.nome,
    whatsapp: r.whatsapp,
    email: r.email,
    entrega,
    origem: null,
    utm: null,
    criado_em: pago.em,
  });
  const semHorario = async (porque: string): Promise<ResultadoConfirmacao> => {
    await deps.marcarSemHorario(r.id, pago);
    await deps
      .avisar(aviso(`${valor} recebido, sem horário (${porque}): ${ctx.titulo}, ${quando(r.inicio, tz)}. Combine outro horário com a pessoa ou devolva o Pix.`))
      .catch(() => ["aviso"]);
    return "pago_sem_horario";
  };

  // Prazo vencido: a agenda do dono pode ter ganhado compromisso nesse meio tempo.
  if (r.status === "expirado") {
    const ini = Date.parse(r.inicio);
    const fim = Date.parse(r.fim);
    const folga = ctx.intervaloMin * 60_000;
    let ocupado: Ocupado[];
    try {
      ocupado = await deps.ocupado(new Date(ini - 86_400_000).toISOString(), new Date(fim + 86_400_000).toISOString());
    } catch {
      return semHorario("agenda fora do ar");
    }
    if (ocupado.some((o) => ini < o.fimMs + folga && o.inicioMs - folga < fim)) return semHorario("o horário foi ocupado");
  }

  const marcado = await deps.marcarConfirmado(r.id, pago);
  if (marcado === "ja") return "ja";
  if (marcado === "ocupado") return semHorario("outra pessoa ficou com o horário");

  let evento: { id: string; meetUrl: string | null };
  try {
    evento = await deps.criarEvento({
      titulo: `${ctx.titulo} · ${r.nome}`,
      descricao: ["Marcado e pago pela bio.", `Nome: ${r.nome}`, `WhatsApp: https://wa.me/${r.whatsapp}`, r.email ? `E-mail: ${r.email}` : "", `Pago: ${valor}`, ctx.linkTrocar ? `Trocar horário: ${ctx.linkTrocar}` : ""]
        .filter(Boolean)
        .join("\n"),
      inicio: r.inicio,
      fim: r.fim,
      convidado: r.email,
      local: ctx.local,
      requestId: r.id,
    });
  } catch {
    return semHorario("a agenda não aceitou o evento");
  }
  await deps.anexarEvento(r.id, { eventoId: evento.id, meetUrl: evento.meetUrl }).catch(() => undefined);
  await deps
    .avisar(aviso(`${ctx.titulo}, ${quando(r.inicio, tz)} · pago ${valor}${evento.meetUrl ? ` · ${evento.meetUrl}` : ctx.local ? ` · ${ctx.local}` : ""}`))
    .catch(() => ["aviso"]);
  return "confirmado";
}
