/**
 * Horários livres e reserva do bloco agendamento. Não fala com a rede: a rota passa o Google e o
 * banco em `deps`. É o que deixa o teste exercitar corrida, desfazer e repetição.
 *
 * Ordem da reserva: a linha entra no banco ANTES do evento no Google. Quem perde a corrida bate na
 * constraint de sobreposição. Se o Google falhar, a linha sai: reserva sem evento não bloqueia nada.
 */
import { ESPERA_MINIMA_MS, hashIp } from "@/lib/lead";
import { gerarBrCode } from "@/lib/pix";
import { lerOrigemDoEnvio } from "../origem";
import { calcularHorarios, chaveDoDia, contarPorDia, dentroDaRegra, type Horario, type Ocupado } from "./horarios";
import { centavosEmbaralhados, hashDoToken, PRAZO_PADRAO_MIN, quando, tokenDoPedido, VALOR_PRESO_MS, type ModoPagamento } from "./pagamento";
import { regraDoBloco, type BlocoAgendamento } from "./regra";

export const LIMITE_POR_IP_24H = 3;
const JANELA_IP_MS = 24 * 60 * 60 * 1000;
const FORMULARIO_VELHO_MS = 12 * 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MSG = {
  servico: "Escolha um dos serviços da lista.",
  horario: "Esse horário não está mais disponível. Escolha outro.",
  ocupado: "Esse horário acabou de ser ocupado. Escolha outro.",
  diaCheio: "Esse dia já está cheio. Escolha outro.",
  nome: "Escreva o seu nome.",
  whatsapp: "Informe um WhatsApp com DDD.",
  email: "Informe um e-mail válido.",
  recarregar: "Recarregue a página e tente de novo.",
  cedo: "Espere um instante e confirme de novo.",
  limite: "Você já marcou horários demais hoje. Chame no WhatsApp.",
  falha: "Não deu para marcar agora. Tente de novo em instantes ou chame no WhatsApp.",
};

export type ReservaNova = {
  request_id: string;
  bloco: string;
  servico: string;
  inicio: string;
  fim: string;
  nome: string;
  whatsapp: string;
  email: string | null;
  ip_hash: string;
  origem: string | null;
  utm: Record<string, string> | null;
  /** Só na reserva paga: nasce aguardando o Pix, com prazo. */
  status?: "confirmado" | "aguardando_pagamento";
  valor_centavos?: number;
  pagamento_modo?: ModoPagamento;
  expira_em?: string;
  valor_preso_ate?: string | null;
  token_hash?: string;
};

export type ReservaGravada = {
  id: string;
  servico: string;
  inicio: string;
  fim: string;
  meet_url: string | null;
  status?: string;
  valor_centavos?: number | null;
  expira_em?: string | null;
};
/** "valor": modo e-mail, os centavos sorteados já estão em uso (sorteia de novo). */
export type ResultadoInsercao = { ok: true; id: string } | { ok: false; motivo: "ocupado" | "repetido" | "valor" | "falha" };

export type AvisoReserva = {
  bloco: string;
  nome: string;
  whatsapp: string;
  email: string | null;
  entrega: string;
  origem: string | null;
  utm: Record<string, string> | null;
  criado_em: string;
};

export type DepsAgenda = {
  /** Ocupado do Google Agenda. Erro sobe: sem Google, nenhum horário (falha fechada). */
  ocupado: (deIso: string, ateIso: string) => Promise<Ocupado[]>;
  /** Reservas confirmadas e as que esperam o Pix (as duas tiram o horário da lista). */
  reservasEntre: (deIso: string, ateIso: string) => Promise<{ inicio: string; fim: string }[]>;
  /** Prazo do Pix vencido vira "expirado" e solta o horário. */
  expirar?: () => Promise<void>;
};

export type Cobranca = { ref: string | null; copiaECola: string; qrBase64: string | null };

export type DepsReserva = DepsAgenda & {
  porPedido: (requestId: string) => Promise<ReservaGravada | null>;
  contarDoIp: (hash: string, desdeIso: string) => Promise<number>;
  inserir: (nova: ReservaNova) => Promise<ResultadoInsercao>;
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
  remover: (id: string) => Promise<void>;
  /** Avisa o dono (webhook, e-mail). Devolve os canais que falharam; nunca derruba a reserva. */
  avisar: (aviso: AvisoReserva) => Promise<string[]>;
  /** Modo mercadopago: cria (ou devolve, pela chave de idempotência) a cobrança Pix no PSP. */
  cobrar?: (c: { reservaId: string; valorCentavos: number; descricao: string; expiraEm: string; email: string; nome: string }) => Promise<Cobranca>;
  anexarCobranca?: (id: string, ref: string) => Promise<void>;
};

export type PagamentoPendente = {
  modo: ModoPagamento;
  /** Vai para a pessoa: consulta o status e remarca. */
  token: string;
  valorCentavos: number;
  copiaECola: string;
  qrBase64: string | null;
  expiraEm: string;
};

export type Confirmacao = {
  servico: string;
  inicio: string;
  fim: string;
  meetUrl: string | null;
  local: string | null;
};

export type ResultadoReserva =
  | { tipo: "ok"; confirmacao: Confirmacao; repetido?: boolean }
  | { tipo: "pagar"; pagamento: PagamentoPendente; confirmacao: Confirmacao; repetido?: boolean }
  | { tipo: "isca" }
  | { tipo: "cedo" }
  | { tipo: "limite" }
  | { tipo: "invalido"; mensagem: string }
  | { tipo: "ocupado"; mensagem: string }
  | { tipo: "falha"; mensagem: string };

/** Ocupado do Google mais as reservas confirmadas do banco no intervalo. */
async function ocupadoTotal(deps: DepsAgenda, deIso: string, ateIso: string) {
  const [google, reservas] = await Promise.all([deps.ocupado(deIso, ateIso), deps.reservasEntre(deIso, ateIso)]);
  const doBanco = reservas.map((r) => ({ inicioMs: Date.parse(r.inicio), fimMs: Date.parse(r.fim) }));
  return { ocupado: [...google, ...doBanco], porDia: reservas.map((r) => r.inicio) };
}

/** Horários livres de um serviço, de agora até a janela do bloco. */
export async function horariosLivres(
  bloco: BlocoAgendamento,
  tz: string,
  servicoId: string,
  deps: DepsAgenda,
  agora: number,
): Promise<Horario[] | null> {
  const servico = bloco.servicos.find((s) => s.id === servicoId);
  if (!servico) return null;
  const regra = regraDoBloco(bloco, tz);
  await deps.expirar?.().catch(() => undefined);
  const de = new Date(agora).toISOString();
  const ate = new Date(agora + (regra.janelaDias + 2) * 24 * 60 * 60 * 1000).toISOString();
  const { ocupado, porDia } = await ocupadoTotal(deps, de, ate);
  return calcularHorarios({ regra, duracaoMin: servico.duracao, ocupado, porDia: contarPorDia(porDia, tz), agora });
}

function texto(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function telefone(v: string): string | null {
  const d = v.replace(/\D/g, "");
  return d.length >= 10 && d.length <= 15 ? d : null;
}


/**
 * Decide e grava a reserva. Isca (honeypot) parece sucesso e não grava. Mesmo `request_id`
 * devolve a reserva que já existe. Aviso ao dono que falha não desfaz nada.
 */
export async function reservar(
  bruto: Record<string, unknown>,
  ctx: {
    bloco: BlocoAgendamento;
    idBloco: string;
    tz: string;
    agora: number;
    ip: string;
    sal: string;
    /** Referer da reserva: sem origem no corpo, vale o `?src=` da bio. */
    referer?: string | null;
    deps: DepsReserva;
  },
): Promise<ResultadoReserva> {
  const { bloco, tz, agora, deps } = ctx;
  if (texto(bruto.empresa)) return { tipo: "isca" };

  const servico = bloco.servicos.find((s) => s.id === texto(bruto.servico));
  if (!servico) return { tipo: "invalido", mensagem: MSG.servico };
  const inicioMs = Date.parse(texto(bruto.inicio));
  if (Number.isNaN(inicioMs)) return { tipo: "invalido", mensagem: MSG.horario };
  const nome = texto(bruto.nome).slice(0, 80);
  if (nome.length < 2) return { tipo: "invalido", mensagem: MSG.nome };
  const whatsapp = telefone(texto(bruto.whatsapp));
  if (!whatsapp) return { tipo: "invalido", mensagem: MSG.whatsapp };
  const email = texto(bruto.email).slice(0, 120);
  const precoCentavos = bloco.pagamento ? (servico.price_cents ?? 0) : 0;
  const pago = precoCentavos > 0 && bloco.pagamento ? bloco.pagamento : null;
  // O Mercado Pago pede o e-mail de quem paga.
  if ((bloco.pedirEmail || pago?.modo === "mercadopago") && !EMAIL.test(email)) return { tipo: "invalido", mensagem: MSG.email };
  if (email && !EMAIL.test(email)) return { tipo: "invalido", mensagem: MSG.email };
  const requestId = texto(bruto.request_id);
  if (!UUID.test(requestId)) return { tipo: "invalido", mensagem: MSG.recarregar };

  const aberto = Number(texto(bruto.aberto));
  if (!Number.isFinite(aberto)) return { tipo: "invalido", mensagem: MSG.recarregar };
  const delta = agora - aberto;
  if (delta < -60_000 || delta > FORMULARIO_VELHO_MS) return { tipo: "invalido", mensagem: MSG.recarregar };
  if (delta < ESPERA_MINIMA_MS) return { tipo: "cedo" };

  const local = bloco.local?.trim() || null;
  const jaGravada = async (ja: ReservaGravada): Promise<ResultadoReserva> => {
    const confirmacao = { servico: servico.title, inicio: ja.inicio, fim: ja.fim, meetUrl: ja.meet_url, local };
    if (pago && ja.status === "aguardando_pagamento" && ja.valor_centavos && ja.expira_em) {
      const pendente = await cobranca(ja.id, ja.valor_centavos, ja.expira_em).catch(() => null);
      if (pendente) return { tipo: "pagar", repetido: true, pagamento: pendente, confirmacao };
      return { tipo: "falha", mensagem: MSG.falha };
    }
    return { tipo: "ok", repetido: true, confirmacao };
  };
  const cobranca = async (reservaId: string, valorCentavos: number, expiraEm: string): Promise<PagamentoPendente> => {
    if (!pago) throw new Error("sem pagamento");
    const token = tokenDoPedido(requestId, ctx.sal);
    if (pago.modo === "email") {
      const copiaECola = gerarBrCode({
        chave: pago.chave ?? "",
        nome: pago.nome ?? "",
        cidade: pago.cidade ?? "",
        valor_cents: valorCentavos,
        txid: `AG${requestId.replace(/-/g, "").slice(0, 20)}`,
      });
      return { modo: "email", token, valorCentavos, copiaECola, qrBase64: null, expiraEm };
    }
    if (!deps.cobrar) throw new Error("cobrança do Mercado Pago não configurada");
    const c = await deps.cobrar({
      reservaId,
      valorCentavos,
      descricao: `${servico.title} · ${quando(inicioIsoDe(), tz)}`,
      expiraEm,
      email,
      nome,
    });
    if (c.ref) await deps.anexarCobranca?.(reservaId, c.ref).catch(() => undefined);
    return { modo: "mercadopago", token, valorCentavos, copiaECola: c.copiaECola, qrBase64: c.qrBase64, expiraEm };
  };
  const inicioIsoDe = () => new Date(inicioMs).toISOString();

  const repetida = await deps.porPedido(requestId);
  if (repetida) return jaGravada(repetida);

  const regra = regraDoBloco(bloco, tz);
  if (!dentroDaRegra({ regra, inicioMs, duracaoMin: servico.duracao, agora })) {
    return { tipo: "ocupado", mensagem: MSG.horario };
  }

  const ipHash = hashIp(ctx.ip, ctx.sal);
  if ((await deps.contarDoIp(ipHash, new Date(agora - JANELA_IP_MS).toISOString())) >= LIMITE_POR_IP_24H) {
    return { tipo: "limite" };
  }

  const fimMs = inicioMs + servico.duracao * 60_000;
  const inicio = new Date(inicioMs).toISOString();
  const fim = new Date(fimMs).toISOString();

  // Confere de novo contra o Google e o banco: a lista que a pessoa viu pode ter minutos.
  const diaIni = new Date(inicioMs - 24 * 60 * 60 * 1000).toISOString();
  const diaFim = new Date(fimMs + 24 * 60 * 60 * 1000).toISOString();
  let ocupado: Ocupado[];
  let reservasDoDia: string[];
  await deps.expirar?.().catch(() => undefined);
  try {
    const total = await ocupadoTotal(deps, diaIni, diaFim);
    ocupado = total.ocupado;
    reservasDoDia = total.porDia;
  } catch {
    return { tipo: "falha", mensagem: MSG.falha };
  }
  const intervalo = regra.intervaloMin * 60_000;
  if (ocupado.some((o) => inicioMs < o.fimMs + intervalo && o.inicioMs - intervalo < fimMs)) {
    return { tipo: "ocupado", mensagem: MSG.ocupado };
  }
  // atalho: teto diário conferido antes de gravar, sem trava; dois pedidos juntos no último horário do dia passam os dois; revisitar se alguém reclamar de dia acima do teto (RPC com advisory lock).
  if (regra.maxPorDia !== null) {
    const dia = chaveDoDia(inicioMs, tz);
    if ((contarPorDia(reservasDoDia, tz)[dia] ?? 0) >= regra.maxPorDia) return { tipo: "ocupado", mensagem: MSG.diaCheio };
  }

  // atalho: a constraint do banco barra só sobreposição; duas reservas simultâneas encostadas (fim de uma = início da outra) ignoram o intervalo; revisitar se o respiro entre consultas da bio for regra dura.
  const deOnde = lerOrigemDoEnvio(bruto, ctx.referer);
  const base: ReservaNova = {
    request_id: requestId,
    bloco: ctx.idBloco,
    servico: servico.id,
    inicio,
    fim,
    nome,
    whatsapp,
    email: email || null,
    ip_hash: ipHash,
    ...deOnde,
  };
  const expiraEm = new Date(agora + (pago?.prazo ?? PRAZO_PADRAO_MIN) * 60_000).toISOString();
  // Modo e-mail: cada valor possível é tentado uma vez, em ordem embaralhada (sortear com
  // reposição erra o último livre em ~30% das vezes quando sobram poucos).
  const valores = pago?.modo === "email" ? centavosEmbaralhados(precoCentavos) : [];
  let proximoValor = 0;
  const nova = (): ReservaNova =>
    pago
      ? {
          ...base,
          status: "aguardando_pagamento",
          pagamento_modo: pago.modo,
          valor_centavos: pago.modo === "email" ? valores[proximoValor++]! : precoCentavos,
          expira_em: expiraEm,
          valor_preso_ate: pago.modo === "email" ? new Date(Date.parse(expiraEm) + VALOR_PRESO_MS).toISOString() : null,
          token_hash: hashDoToken(tokenDoPedido(requestId, ctx.sal)),
        }
      : base;

  // Centavos em uso: passa para o próximo valor da lista (no máximo os 99).
  // Horário preso por um prazo que acabou de vencer: expira e tenta uma vez mais.
  let linha = nova();
  let inserido = await deps.inserir(linha);
  let expirouUmaVez = false;
  for (let i = 0; !inserido.ok && i < 120; i++) {
    if (inserido.motivo === "valor" && proximoValor < valores.length) linha = nova();
    else if (inserido.motivo === "ocupado" && deps.expirar && !expirouUmaVez) {
      expirouUmaVez = true;
      await deps.expirar().catch(() => undefined);
    } else break;
    inserido = await deps.inserir(linha);
  }
  if (!inserido.ok) {
    if (inserido.motivo === "ocupado") return { tipo: "ocupado", mensagem: MSG.ocupado };
    if (inserido.motivo === "repetido") {
      const ja = await deps.porPedido(requestId);
      if (ja) return jaGravada(ja);
    }
    return { tipo: "falha", mensagem: MSG.falha };
  }

  if (pago && linha.valor_centavos) {
    let pendente: PagamentoPendente;
    try {
      pendente = await cobranca(inserido.id, linha.valor_centavos, expiraEm);
    } catch {
      await deps.remover(inserido.id).catch(() => undefined);
      return { tipo: "falha", mensagem: MSG.falha };
    }
    return { tipo: "pagar", pagamento: pendente, confirmacao: { servico: servico.title, inicio, fim, meetUrl: null, local } };
  }

  let evento: { id: string; meetUrl: string | null };
  try {
    evento = await deps.criarEvento({
      titulo: `${servico.title} · ${nome}`,
      descricao: [
        "Marcado pela bio.",
        `Nome: ${nome}`,
        `WhatsApp: https://wa.me/${whatsapp}`,
        email ? `E-mail: ${email}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      inicio,
      fim,
      convidado: email || null,
      local,
      requestId,
    });
  } catch {
    await deps.remover(inserido.id).catch(() => undefined);
    return { tipo: "falha", mensagem: MSG.falha };
  }

  // O evento já existe no Google: falha aqui não desfaz a reserva.
  await deps.anexarEvento(inserido.id, { eventoId: evento.id, meetUrl: evento.meetUrl }).catch(() => undefined);
  await deps
    .avisar({
      bloco: ctx.idBloco,
      nome,
      whatsapp,
      email: email || null,
      entrega: `${servico.title}, ${quando(inicio, tz)}${evento.meetUrl ? ` · ${evento.meetUrl}` : local ? ` · ${local}` : ""}`,
      ...deOnde,
      criado_em: new Date(agora).toISOString(),
    })
    .catch(() => ["aviso"]);

  return { tipo: "ok", confirmacao: { servico: servico.title, inicio, fim, meetUrl: evento.meetUrl, local } };
}
