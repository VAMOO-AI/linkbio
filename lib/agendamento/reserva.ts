/**
 * Horários livres e reserva do bloco agendamento. Não fala com a rede: a rota passa o Google e o
 * banco em `deps`. É o que deixa o teste exercitar corrida, desfazer e repetição.
 *
 * Ordem da reserva: a linha entra no banco ANTES do evento no Google. Quem perde a corrida bate na
 * constraint de sobreposição. Se o Google falhar, a linha sai: reserva sem evento não bloqueia nada.
 */
import { ESPERA_MINIMA_MS, hashIp } from "@/lib/lead";
import { calcularHorarios, chaveDoDia, contarPorDia, dentroDaRegra, type Horario, type Ocupado } from "./horarios";
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
};

export type ReservaGravada = { id: string; servico: string; inicio: string; fim: string; meet_url: string | null };
export type ResultadoInsercao = { ok: true; id: string } | { ok: false; motivo: "ocupado" | "repetido" | "falha" };

export type AvisoReserva = {
  bloco: string;
  nome: string;
  whatsapp: string;
  email: string | null;
  entrega: string;
  criado_em: string;
};

export type DepsAgenda = {
  /** Ocupado do Google Agenda. Erro sobe: sem Google, nenhum horário (falha fechada). */
  ocupado: (deIso: string, ateIso: string) => Promise<Ocupado[]>;
  reservasEntre: (deIso: string, ateIso: string) => Promise<{ inicio: string; fim: string }[]>;
};

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

function quando(inicioIso: string, tz: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz,
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(inicioIso));
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
  if (bloco.pedirEmail && !EMAIL.test(email)) return { tipo: "invalido", mensagem: MSG.email };
  if (email && !EMAIL.test(email)) return { tipo: "invalido", mensagem: MSG.email };
  const requestId = texto(bruto.request_id);
  if (!UUID.test(requestId)) return { tipo: "invalido", mensagem: MSG.recarregar };

  const aberto = Number(texto(bruto.aberto));
  if (!Number.isFinite(aberto)) return { tipo: "invalido", mensagem: MSG.recarregar };
  const delta = agora - aberto;
  if (delta < -60_000 || delta > FORMULARIO_VELHO_MS) return { tipo: "invalido", mensagem: MSG.recarregar };
  if (delta < ESPERA_MINIMA_MS) return { tipo: "cedo" };

  const local = bloco.local?.trim() || null;
  const repetida = await deps.porPedido(requestId);
  if (repetida) {
    return {
      tipo: "ok",
      repetido: true,
      confirmacao: { servico: servico.title, inicio: repetida.inicio, fim: repetida.fim, meetUrl: repetida.meet_url, local },
    };
  }

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
  if (regra.maxPorDia !== null) {
    const dia = chaveDoDia(inicioMs, tz);
    if ((contarPorDia(reservasDoDia, tz)[dia] ?? 0) >= regra.maxPorDia) return { tipo: "ocupado", mensagem: MSG.diaCheio };
  }

  const inserido = await deps.inserir({
    request_id: requestId,
    bloco: ctx.idBloco,
    servico: servico.id,
    inicio,
    fim,
    nome,
    whatsapp,
    email: email || null,
    ip_hash: ipHash,
  });
  if (!inserido.ok) {
    if (inserido.motivo === "ocupado") return { tipo: "ocupado", mensagem: MSG.ocupado };
    if (inserido.motivo === "repetido") {
      const ja = await deps.porPedido(requestId);
      if (ja) {
        return {
          tipo: "ok",
          repetido: true,
          confirmacao: { servico: servico.title, inicio: ja.inicio, fim: ja.fim, meetUrl: ja.meet_url, local },
        };
      }
    }
    return { tipo: "falha", mensagem: MSG.falha };
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
      criado_em: new Date(agora).toISOString(),
    })
    .catch(() => ["aviso"]);

  return { tipo: "ok", confirmacao: { servico: servico.title, inicio, fim, meetUrl: evento.meetUrl, local } };
}
