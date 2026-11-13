import { describe, expect, test } from "vitest";
import { hashDoToken, type ReservaPaga } from "@/lib/agendamento/pagamento";
import type { BlocoAgendamento } from "@/lib/agendamento/regra";
import { MSG_REMARCAR, remarcar, type DepsRemarcar } from "@/lib/agendamento/remarcar";
import { MSG } from "@/lib/agendamento/reserva";

const TZ = "America/Sao_Paulo";
// Segunda, 26/10/2026, 08:00 em Brasília.
const AGORA = Date.parse("2026-10-26T11:00:00Z");
const TOKEN = "token-remarcar";
// Quarta 28/10, 09:00 em Brasília (a reserva atual) e 10:00 (o novo horário).
const QUARTA_9H = "2026-10-28T12:00:00.000Z";
const QUARTA_10H = "2026-10-28T13:00:00.000Z";

const BLOCO = {
  type: "agendamento",
  id: "agenda",
  servicos: [{ id: "consulta", title: "Consulta", duracao: 30, price_cents: 30000 }],
  pagamento: { modo: "mercadopago" },
} as BlocoAgendamento;

function reserva(extra: Partial<ReservaPaga> = {}): ReservaPaga {
  return {
    id: "r1",
    bloco: "agenda",
    servico: "consulta",
    inicio: QUARTA_9H,
    fim: "2026-10-28T12:30:00.000Z",
    status: "confirmado",
    nome: "Maria",
    whatsapp: "5511987654321",
    email: "maria@exemplo.com",
    valor_centavos: 30000,
    pagamento_modo: "mercadopago",
    expira_em: null,
    created_at: new Date(AGORA - 86_400_000).toISOString(),
    valor_preso_ate: null,
    meet_url: "https://meet.google.com/abc",
    evento_id: "ev1",
    ...extra,
  };
}

function montar(r: ReservaPaga, opts: { ocupado?: { inicio: string; fim: string }[]; moverCai?: boolean; banco?: "ok" | "ocupado" } = {}) {
  const log: string[] = [];
  const deps: DepsRemarcar = {
    porToken: async (hash) => (hash === hashDoToken(TOKEN) ? r : null),
    ocupado: async () =>
      [{ inicio: r.inicio, fim: r.fim }, ...(opts.ocupado ?? [])].map((o) => ({ inicioMs: Date.parse(o.inicio), fimMs: Date.parse(o.fim) })),
    reservasEntre: async () => [{ inicio: r.inicio, fim: r.fim }],
    mover: async (_id, inicio) => {
      log.push(`mover:${inicio}`);
      return opts.banco ?? "ok";
    },
    moverEvento: async (id, inicio) => {
      if (opts.moverCai) throw new Error("agenda fora");
      log.push(`moverEvento:${id}:${inicio}`);
    },
    criarEvento: async () => {
      log.push("criarEvento");
      return { id: "ev2", meetUrl: "https://meet.google.com/nova" };
    },
    anexarEvento: async () => {
      log.push("anexar");
    },
    marcarSemHorario: async () => {
      log.push("semHorario");
    },
    avisar: async (a) => {
      log.push(`aviso:${a.entrega}`);
      return [];
    },
  };
  return { deps, log };
}

const ctx = (deps: DepsRemarcar, agora = AGORA) => ({ bloco: BLOCO, tz: TZ, agora, deps });

describe("remarcar", () => {
  test("confirmada: move no banco e na agenda, mantém o link e avisa o dono", async () => {
    const m = montar(reserva());
    const r = await remarcar(TOKEN, QUARTA_10H, ctx(m.deps));
    expect(r).toEqual({
      tipo: "ok",
      confirmacao: { servico: "Consulta", inicio: QUARTA_10H, fim: "2026-10-28T13:30:00.000Z", meetUrl: "https://meet.google.com/abc", local: null },
    });
    expect(m.log.slice(0, 2)).toEqual([`mover:${QUARTA_10H}`, `moverEvento:ev1:${QUARTA_10H}`]);
    expect(m.log.at(-1)).toMatch(/^aviso:Remarcado: Consulta.*\(era /);
  });

  test("o próprio horário não bloqueia mover meia hora", async () => {
    const m = montar(reserva());
    const r = await remarcar(TOKEN, "2026-10-28T12:30:00.000Z", ctx(m.deps));
    expect(r.tipo).toBe("ok");
  });

  test("token desconhecido ou reserva aguardando: link inválido", async () => {
    expect(await remarcar("outro", QUARTA_10H, ctx(montar(reserva()).deps))).toEqual({ tipo: "invalido", mensagem: MSG_REMARCAR.link });
    expect((await remarcar(TOKEN, QUARTA_10H, ctx(montar(reserva({ status: "aguardando_pagamento" })).deps))).tipo).toBe("invalido");
  });

  test("dentro da antecedência (12 h padrão): não troca", async () => {
    const m = montar(reserva());
    const r = await remarcar(TOKEN, QUARTA_10H, ctx(m.deps, Date.parse(QUARTA_9H) - 6 * 3600_000));
    expect(r).toEqual({ tipo: "prazo", mensagem: MSG_REMARCAR.prazo(12) });
    expect(m.log).toEqual([]);
  });

  test("novo horário ocupado na agenda: recusa sem mexer", async () => {
    const m = montar(reserva(), { ocupado: [{ inicio: QUARTA_10H, fim: "2026-10-28T14:00:00.000Z" }] });
    expect(await remarcar(TOKEN, QUARTA_10H, ctx(m.deps))).toEqual({ tipo: "ocupado", mensagem: MSG.ocupado });
    expect(m.log).toEqual([]);
  });

  test("fora da regra (domingo): recusa", async () => {
    const m = montar(reserva());
    expect((await remarcar(TOKEN, "2026-11-01T13:00:00.000Z", ctx(m.deps))).tipo).toBe("ocupado");
  });

  test("agenda recusa mover: o banco volta ao horário antigo", async () => {
    const m = montar(reserva(), { moverCai: true });
    expect(await remarcar(TOKEN, QUARTA_10H, ctx(m.deps))).toEqual({ tipo: "falha", mensagem: MSG.falha });
    expect(m.log).toEqual([`mover:${QUARTA_10H}`, `mover:${QUARTA_9H}`]);
  });

  test("pago sem horário: escolhe outro, cria o evento e vale mesmo perto do horário antigo", async () => {
    const m = montar(reserva({ status: "pago_sem_horario", evento_id: null, meet_url: null }));
    const r = await remarcar(TOKEN, QUARTA_10H, ctx(m.deps, Date.parse(QUARTA_9H) - 3600_000 - 86_400_000));
    expect(r).toMatchObject({ tipo: "ok", confirmacao: { meetUrl: "https://meet.google.com/nova" } });
    expect(m.log).toContain("criarEvento");
  });
});
