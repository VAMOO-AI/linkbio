/**
 * Remarcar uma reserva paga pelo link com o token (o mesmo da tela do Pix, que vai no convite).
 * Vale para reserva confirmada (até `antecedencia` horas antes) e para "pago sem horário" (o Pix
 * chegou depois do prazo e a pessoa escolhe outro horário). Cancelar fica no WhatsApp do dono.
 * Não fala com a rede: tudo vem em `deps`.
 */
import { dentroDaRegra, type Ocupado } from "./horarios";
import { hashDoToken, quando, type ReservaPaga } from "./pagamento";
import { regraDoBloco, type BlocoAgendamento } from "./regra";
import { MSG, type AvisoReserva, type Confirmacao } from "./reserva";

export const MSG_REMARCAR = {
  link: "Este link não vale mais. Chame no WhatsApp para trocar o horário.",
  prazo: (h: number) => `Faltam menos de ${h} horas para o horário. Para trocar agora, chame no WhatsApp.`,
};

export type DepsRemarcar = {
  porToken: (hash: string) => Promise<ReservaPaga | null>;
  ocupado: (deIso: string, ateIso: string) => Promise<Ocupado[]>;
  reservasEntre: (deIso: string, ateIso: string) => Promise<{ inicio: string; fim: string }[]>;
  /** Troca inicio/fim e deixa confirmada. "ocupado": outra reserva no horário (23P01). */
  mover: (id: string, inicio: string, fim: string) => Promise<"ok" | "ocupado">;
  moverEvento: (eventoId: string, inicio: string, fim: string) => Promise<void>;
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
  marcarSemHorario: (id: string, pago: { em: string; ref: string | null }) => Promise<void>;
  avisar: (aviso: AvisoReserva) => Promise<string[]>;
};

export type ResultadoRemarcar =
  | { tipo: "ok"; confirmacao: Confirmacao }
  | { tipo: "invalido" | "prazo" | "ocupado" | "falha"; mensagem: string };

export async function remarcar(
  token: string,
  inicioIso: string,
  ctx: { bloco: BlocoAgendamento; tz: string; agora: number; deps: DepsRemarcar },
): Promise<ResultadoRemarcar> {
  const { bloco, tz, agora, deps } = ctx;
  const r = await deps.porToken(hashDoToken(token));
  if (!r || (r.status !== "confirmado" && r.status !== "pago_sem_horario")) return { tipo: "invalido", mensagem: MSG_REMARCAR.link };
  const servico = bloco.servicos.find((s) => s.id === r.servico);
  if (!servico) return { tipo: "invalido", mensagem: MSG_REMARCAR.link };

  const regra = regraDoBloco(bloco, tz);
  const antigoIni = Date.parse(r.inicio);
  const antigoFim = Date.parse(r.fim);
  if (r.status === "confirmado" && antigoIni - agora < regra.antecedenciaMin * 60_000) {
    return { tipo: "prazo", mensagem: MSG_REMARCAR.prazo(Math.round(regra.antecedenciaMin / 60)) };
  }
  const inicioMs = Date.parse(inicioIso);
  if (Number.isNaN(inicioMs) || !dentroDaRegra({ regra, inicioMs, duracaoMin: servico.duracao, agora })) {
    return { tipo: "ocupado", mensagem: MSG.horario };
  }
  const fimMs = inicioMs + servico.duracao * 60_000;
  const inicio = new Date(inicioMs).toISOString();
  const fim = new Date(fimMs).toISOString();

  // O próprio compromisso (na agenda e no banco) não conta como ocupado: dá para mover meia hora.
  const proprio = (a: number, b: number) => r.status === "confirmado" && a === antigoIni && b === antigoFim;
  const de = new Date(inicioMs - 86_400_000).toISOString();
  const ate = new Date(fimMs + 86_400_000).toISOString();
  let ocupado: Ocupado[];
  try {
    const [agenda, banco] = await Promise.all([deps.ocupado(de, ate), deps.reservasEntre(de, ate)]);
    ocupado = [...agenda, ...banco.map((b) => ({ inicioMs: Date.parse(b.inicio), fimMs: Date.parse(b.fim) }))].filter(
      (o) => !proprio(o.inicioMs, o.fimMs),
    );
  } catch {
    return { tipo: "falha", mensagem: MSG.falha };
  }
  const folga = regra.intervaloMin * 60_000;
  if (ocupado.some((o) => inicioMs < o.fimMs + folga && o.inicioMs - folga < fimMs)) return { tipo: "ocupado", mensagem: MSG.ocupado };

  if ((await deps.mover(r.id, inicio, fim)) === "ocupado") return { tipo: "ocupado", mensagem: MSG.ocupado };

  const local = bloco.local?.trim() || null;
  let meetUrl = r.meet_url ?? null;
  const eventoId = r.evento_id ?? null;
  try {
    if (r.status === "confirmado" && eventoId) {
      await deps.moverEvento(eventoId, inicio, fim);
    } else {
      const ev = await deps.criarEvento({
        titulo: `${servico.title} · ${r.nome}`,
        descricao: ["Marcado e pago pela bio.", `Nome: ${r.nome}`, `WhatsApp: https://wa.me/${r.whatsapp}`, r.email ? `E-mail: ${r.email}` : ""]
          .filter(Boolean)
          .join("\n"),
        inicio,
        fim,
        convidado: r.email,
        local,
        requestId: `${r.id}-${inicioMs}`,
      });
      meetUrl = ev.meetUrl;
      await deps.anexarEvento(r.id, { eventoId: ev.id, meetUrl: ev.meetUrl }).catch(() => undefined);
    }
  } catch {
    // A agenda não aceitou: o banco volta ao que era.
    if (r.status === "confirmado") await deps.mover(r.id, r.inicio, r.fim).catch(() => undefined);
    else await deps.marcarSemHorario(r.id, { em: new Date(agora).toISOString(), ref: null }).catch(() => undefined);
    return { tipo: "falha", mensagem: MSG.falha };
  }

  await deps
    .avisar({
      bloco: r.bloco,
      nome: r.nome,
      whatsapp: r.whatsapp,
      email: r.email,
      entrega: `Remarcado: ${servico.title}, ${quando(inicio, tz)}${r.status === "confirmado" ? ` (era ${quando(r.inicio, tz)})` : ""}`,
      origem: null,
      utm: null,
      criado_em: new Date(agora).toISOString(),
    })
    .catch(() => ["aviso"]);
  return { tipo: "ok", confirmacao: { servico: servico.title, inicio, fim, meetUrl, local } };
}
