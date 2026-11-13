/**
 * Mercado Pago do dono, só pelo servidor: cria a cobrança Pix da reserva, consulta e cancela o
 * pagamento e confere a assinatura do webhook. Sem SDK: fetch na API REST v1/payments.
 * O access token vem do ambiente/segredo do dono; nada aqui vai para o navegador.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Busca } from "./google";
import type { Cobranca } from "./reserva";

const API = "https://api.mercadopago.com/v1/payments";
/** A doc do Pix exige expiração de no mínimo 30 min; 31 dá folga para o relógio e a latência. */
const EXPIRACAO_MINIMA_MS = 31 * 60_000;
/** Brasília sem horário de verão desde 2019: offset fixo. */
const OFFSET_BRASILIA_MS = -3 * 3600_000;

export type CredMP = { accessToken: string };

/** "token": o access token foi recusado (revogado, trocado, sem permissão). Gere outro no painel. */
export class ErroMP extends Error {
  constructor(
    public tipo: "token" | "api",
    mensagem: string,
  ) {
    super(mensagem);
    this.name = "ErroMP";
  }
}

async function chamar(cred: CredMP, busca: Busca, url: string, init: RequestInit = {}, extras: Record<string, string> = {}) {
  const resp = await busca(url, {
    ...init,
    headers: { authorization: `Bearer ${cred.accessToken}`, "content-type": "application/json", ...extras },
    signal: AbortSignal.timeout(10_000),
  });
  if (resp.status === 401 || resp.status === 403) {
    throw new ErroMP("token", `Mercado Pago recusou o access token (${resp.status}).`);
  }
  return resp;
}

async function falha(resp: Response): Promise<never> {
  throw new ErroMP("api", `Mercado Pago respondeu ${resp.status}: ${(await resp.text().catch(() => "")).slice(0, 200)}`);
}

/** Instante em ms no formato que o MP pede: yyyy-MM-ddTHH:mm:ss.SSS-03:00 (parede de Brasília). */
function paraBrasilia(ms: number): string {
  return `${new Date(ms + OFFSET_BRASILIA_MS).toISOString().slice(0, 23)}-03:00`;
}

type RespostaPagamento = {
  id?: number | string;
  status?: string;
  external_reference?: string | null;
  transaction_amount?: number;
  date_approved?: string | null;
  point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string | null } };
};

/**
 * Cria o pagamento Pix da reserva. A chave de idempotência é a reserva: repetir a chamada (retry,
 * clique duplo) devolve o mesmo pagamento em vez de cobrar duas vezes. A expiração vale o maior
 * entre o prazo da reserva e agora + 31 min, porque o MP recusa Pix que expira antes de 30 min.
 */
export async function criarCobrancaMP(
  cred: CredMP,
  c: {
    reservaId: string;
    valorCentavos: number;
    descricao: string;
    /** ISO 8601. */
    expiraEm: string;
    email: string;
    nome: string;
    notificacaoUrl?: string;
  },
  busca: Busca,
  agora = Date.now(),
): Promise<Cobranca> {
  const expiraMs = Math.max(Date.parse(c.expiraEm), agora + EXPIRACAO_MINIMA_MS);
  const corpo: Record<string, unknown> = {
    transaction_amount: c.valorCentavos / 100,
    description: c.descricao,
    payment_method_id: "pix",
    external_reference: c.reservaId,
    payer: { email: c.email, first_name: c.nome },
    date_of_expiration: paraBrasilia(expiraMs),
  };
  if (c.notificacaoUrl) corpo.notification_url = c.notificacaoUrl;

  const resp = await chamar(
    cred,
    busca,
    API,
    { method: "POST", body: JSON.stringify(corpo) },
    { "X-Idempotency-Key": `linkbio-agenda-${c.reservaId}` },
  );
  if (!resp.ok) return falha(resp);
  const pg = (await resp.json()) as RespostaPagamento;
  const dados = pg.point_of_interaction?.transaction_data;
  if (!dados?.qr_code || pg.id == null) throw new ErroMP("api", "Mercado Pago criou o pagamento sem o código Pix.");
  return { ref: String(pg.id), copiaECola: dados.qr_code, qrBase64: dados.qr_code_base64 ?? null };
}

export type PagamentoMP = {
  id: string;
  status: string;
  /** external_reference: o id da reserva que criou a cobrança. */
  reservaId: string | null;
  valorCentavos: number;
  aprovadoEm: string | null;
};

/** Estado atual do pagamento. É a fonte da verdade: o corpo do webhook só diz "olhe o pagamento X". */
export async function consultarPagamentoMP(cred: CredMP, id: string, busca: Busca): Promise<PagamentoMP> {
  const resp = await chamar(cred, busca, `${API}/${encodeURIComponent(id)}`, { method: "GET" });
  if (!resp.ok) return falha(resp);
  const pg = (await resp.json()) as RespostaPagamento;
  return {
    id: String(pg.id ?? id),
    status: pg.status ?? "",
    reservaId: pg.external_reference ?? null,
    valorCentavos: Math.round((pg.transaction_amount ?? 0) * 100),
    aprovadoEm: pg.date_approved ?? null,
  };
}

/**
 * Cancela o Pix pendente (reserva expirou ou foi desfeita). 400 (já não está pendente: pago,
 * expirado ou cancelado) e 404 não são erro: o objetivo, não cobrar mais, já está cumprido ou
 * quem decide é a confirmação do pagamento.
 */
export async function cancelarPagamentoMP(cred: CredMP, id: string, busca: Busca): Promise<void> {
  const resp = await chamar(cred, busca, `${API}/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ status: "cancelled" }),
  });
  if (resp.ok || resp.status === 400 || resp.status === 404) return;
  return falha(resp);
}

/**
 * Confere a assinatura do webhook do Mercado Pago (header `x-signature: ts=...,v1=...`).
 * Manifest: `id:<data.id em minúsculas>;request-id:<x-request-id>;ts:<ts>;`, omitindo o par cujo
 * valor não veio; v1 é o HMAC SHA256 hex do manifest com a secret do webhook.
 *
 * `dataId` vem da query string `data.id` da URL do webhook (ex.: `?data.id=123&type=payment`),
 * NÃO do corpo JSON: é o que o MP assina.
 */
export function assinaturaMPValida(o: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
  secret: string;
}): boolean {
  if (!o.xSignature || !o.secret) return false;
  let ts: string | undefined;
  let v1: string | undefined;
  for (const parte of o.xSignature.split(",")) {
    const i = parte.indexOf("=");
    if (i < 0) continue;
    const chave = parte.slice(0, i).trim();
    const valor = parte.slice(i + 1).trim();
    if (chave === "ts") ts = valor;
    else if (chave === "v1") v1 = valor;
  }
  if (!ts || !v1) return false;

  let manifest = "";
  if (o.dataId) manifest += `id:${o.dataId.toLowerCase()};`;
  if (o.xRequestId) manifest += `request-id:${o.xRequestId};`;
  manifest += `ts:${ts};`;

  const esperado = Buffer.from(createHmac("sha256", o.secret).update(manifest).digest("hex"));
  const recebido = Buffer.from(v1.toLowerCase());
  if (esperado.length !== recebido.length) return false;
  return timingSafeEqual(esperado, recebido);
}
