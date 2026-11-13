import { describe, expect, test } from "vitest";
import { hashDoToken, type ReservaPaga } from "@/lib/agendamento/pagamento";
import { consultarStatus, processarPagamentoMP, varrerCaixa, type CtxStatus, type DepsStatus, type PagamentoMP } from "@/lib/agendamento/status";

const TZ = "America/Sao_Paulo";
const AGORA = Date.parse("2026-10-26T11:00:00Z");
const TOKEN = "token-de-teste";

function reserva(extra: Partial<ReservaPaga> = {}): ReservaPaga {
  return {
    id: "r1",
    bloco: "agenda",
    servico: "consulta",
    inicio: "2026-10-27T12:00:00.000Z",
    fim: "2026-10-27T12:30:00.000Z",
    status: "aguardando_pagamento",
    nome: "Maria",
    whatsapp: "5511987654321",
    email: "maria@exemplo.com",
    valor_centavos: 30017,
    pagamento_modo: "email",
    pagamento_ref: null,
    expira_em: new Date(AGORA + 10 * 60_000).toISOString(),
    created_at: new Date(AGORA - 5 * 60_000).toISOString(),
    valor_preso_ate: new Date(AGORA + 48 * 3600_000).toISOString(),
    meet_url: null,
    ...extra,
  };
}

function montar(opts: {
  r?: ReservaPaga;
  avisos?: { id: string; recebidoEm: string; texto: string }[];
  mp?: PagamentoMP;
  travaLivre?: boolean;
  jaVisto?: string[];
}) {
  const r = opts.r ?? reserva();
  const log: string[] = [];
  const vistos = new Set(opts.jaVisto ?? []);
  const deps: DepsStatus = {
    porToken: async (hash) => (hash === hashDoToken(TOKEN) ? r : null),
    porId: async (id) => (id === r.id ? r : null),
    expirar: async () => {
      if (r.status === "aguardando_pagamento" && r.expira_em && Date.parse(r.expira_em) < AGORA) r.status = "expirado";
    },
    registrarRecebido: async (p) => {
      if (vistos.has(p.id)) return false;
      vistos.add(p.id);
      log.push(`recebido:${p.id}`);
      return true;
    },
    pegarTrava: async () => opts.travaLivre ?? true,
    esperandoPixEmail: async () => (r.pagamento_modo === "email" && r.status !== "confirmado" ? [r] : []),
    lerAvisos: opts.avisos ? async () => opts.avisos! : undefined,
    consultarMP: opts.mp ? async () => opts.mp! : undefined,
    cancelarMP: async (id) => {
      log.push(`cancelou:${id}`);
    },
    marcarConfirmado: async () => {
      if (r.status === "confirmado") return "ja";
      r.status = "confirmado";
      return "ok";
    },
    marcarSemHorario: async () => {
      r.status = "pago_sem_horario";
    },
    ocupado: async () => [],
    criarEvento: async () => {
      log.push("evento");
      return { id: "ev", meetUrl: "https://meet.google.com/x" };
    },
    anexarEvento: async () => {
      r.meet_url = "https://meet.google.com/x";
    },
    avisar: async () => [],
  };
  const ctx: CtxStatus = { tz: TZ, agora: AGORA, dados: () => ({ titulo: "Consulta", local: null, intervaloMin: 15 }), deps };
  return { r, log, ctx };
}

const PIX_OK = { id: "email:<a@banco>", recebidoEm: new Date(AGORA - 60_000).toISOString(), texto: "Você recebeu um Pix de R$ 300,17 de MARIA" };

describe("varrerCaixa", () => {
  test("aviso com o valor exato confirma a reserva e cria o evento", async () => {
    const m = montar({ avisos: [PIX_OK] });
    expect(await varrerCaixa(m.ctx)).toBe(1);
    expect(m.r.status).toBe("confirmado");
    expect(m.log).toContain("evento");
  });

  test("aviso já visto em outra varredura não confirma de novo", async () => {
    const m = montar({ avisos: [PIX_OK], jaVisto: [PIX_OK.id] });
    expect(await varrerCaixa(m.ctx)).toBe(0);
    expect(m.r.status).toBe("aguardando_pagamento");
  });

  test("trava ocupada: não lê a caixa", async () => {
    const m = montar({ avisos: [PIX_OK], travaLivre: false });
    expect(await varrerCaixa(m.ctx)).toBe(0);
  });

  test("valor diferente ou Pix enviado não casa", async () => {
    const m = montar({
      avisos: [
        { ...PIX_OK, id: "e1", texto: "Você recebeu um Pix de R$ 300,18" },
        { ...PIX_OK, id: "e2", texto: "Pix enviado de R$ 300,17" },
      ],
    });
    expect(await varrerCaixa(m.ctx)).toBe(0);
  });
});

describe("Mercado Pago", () => {
  const mp = (status: string): PagamentoMP => ({ id: "123", status, reservaId: "r1", valorCentavos: 30000, aprovadoEm: status === "approved" ? new Date(AGORA).toISOString() : null });

  test("aprovado confirma; repetido não duplica", async () => {
    const m = montar({ r: reserva({ pagamento_modo: "mercadopago", pagamento_ref: "123", valor_centavos: 30000, valor_preso_ate: null }), mp: mp("approved") });
    expect(await processarPagamentoMP("123", m.ctx)).toBe("confirmado");
    expect(await processarPagamentoMP("123", m.ctx)).toBe("ja");
    expect(m.log.filter((l) => l === "evento")).toHaveLength(1);
  });

  test("pendente não confirma", async () => {
    const m = montar({ r: reserva({ pagamento_modo: "mercadopago", pagamento_ref: "123" }), mp: mp("pending") });
    expect(await processarPagamentoMP("123", m.ctx)).toBe("ignorado");
    expect(m.r.status).toBe("aguardando_pagamento");
  });

  test("pagamento de outra reserva (external_reference desconhecido) é ignorado", async () => {
    const m = montar({ r: reserva({ pagamento_modo: "mercadopago" }), mp: { ...mp("approved"), reservaId: "outra" } });
    expect(await processarPagamentoMP("123", m.ctx)).toBe("ignorado");
  });
});

describe("consultarStatus", () => {
  test("token desconhecido: null", async () => {
    const m = montar({});
    expect(await consultarStatus("outro", m.ctx)).toBeNull();
  });

  test("aguardando sem Pix: devolve prazo e valor", async () => {
    const m = montar({ avisos: [] });
    expect(await consultarStatus(TOKEN, m.ctx)).toEqual({ estado: "aguardando", expiraEm: m.r.expira_em, valorCentavos: 30017 });
  });

  test("modo email: a consulta lê a caixa e já volta confirmado", async () => {
    const m = montar({ avisos: [PIX_OK] });
    expect(await consultarStatus(TOKEN, m.ctx)).toMatchObject({ estado: "confirmado", meetUrl: "https://meet.google.com/x" });
  });

  test("Mercado Pago com prazo vencido e Pix pendente: expira e cancela o Pix no PSP", async () => {
    const m = montar({
      r: reserva({ pagamento_modo: "mercadopago", pagamento_ref: "123", expira_em: new Date(AGORA - 60_000).toISOString() }),
      mp: { id: "123", status: "pending", reservaId: "r1", valorCentavos: 30000, aprovadoEm: null },
    });
    expect(await consultarStatus(TOKEN, m.ctx)).toEqual({ estado: "expirado" });
    expect(m.log).toContain("cancelou:123");
  });

  test("expirado mas Pix chegou e o horário segue livre: confirma", async () => {
    const m = montar({ r: reserva({ status: "expirado", expira_em: new Date(AGORA - 60_000).toISOString() }), avisos: [PIX_OK] });
    expect((await consultarStatus(TOKEN, m.ctx))?.estado).toBe("confirmado");
  });
});
