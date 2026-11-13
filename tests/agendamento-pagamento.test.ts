import { describe, expect, test } from "vitest";
import { BlockSchema } from "@/config/schema";
import {
  casarPagamento,
  centavosEmbaralhados,
  confirmarPagamento,
  hashDoToken,
  lerAvisoPix,
  tokenDoPedido,
  type DepsConfirmacao,
  type ReservaPaga,
} from "@/lib/agendamento/pagamento";
import type { BlocoAgendamento } from "@/lib/agendamento/regra";
import { MSG, reservar, type DepsReserva, type ReservaNova } from "@/lib/agendamento/reserva";

const TZ = "America/Sao_Paulo";
const AGORA = Date.parse("2026-10-26T11:00:00Z");
const TERCA_9H = "2026-10-27T12:00:00.000Z";
const SAL = "sal-de-teste";

const BLOCO = {
  type: "agendamento",
  id: "agenda",
  servicos: [
    { id: "consulta", title: "Consulta", duracao: 30, price_cents: 30000 },
    { id: "caso", title: "Análise de caso", duracao: 60, price_cents: 50000 },
    { id: "papo", title: "Papo rápido", duracao: 30 },
  ],
  pagamento: { modo: "email", chave: "pix@exemplo.com", nome: "Fulana", cidade: "SAO PAULO" },
} as BlocoAgendamento;

const BLOCO_MP = { ...BLOCO, pagamento: { modo: "mercadopago" } } as BlocoAgendamento;

type Linha = ReservaNova & { id: string; meet_url: string | null; status: string };

function falsos(opts: { cobrancaCai?: boolean; valoresTomados?: number[] } = {}) {
  const linhas: Linha[] = [];
  const cobrancas: { reservaId: string; valorCentavos: number }[] = [];
  const tomados = new Set(opts.valoresTomados ?? []);
  let expirou = 0;
  const deps: DepsReserva = {
    ocupado: async () => [],
    reservasEntre: async () =>
      linhas.filter((l) => l.status === "confirmado" || l.status === "aguardando_pagamento").map((l) => ({ inicio: l.inicio, fim: l.fim })),
    porPedido: async (id) => {
      const l = linhas.find((x) => x.request_id === id);
      return l
        ? { id: l.id, servico: l.servico, inicio: l.inicio, fim: l.fim, meet_url: l.meet_url, status: l.status, valor_centavos: l.valor_centavos ?? null, expira_em: l.expira_em ?? null }
        : null;
    },
    contarDoIp: async (hash) => linhas.filter((l) => l.ip_hash === hash).length,
    inserir: async (nova) => {
      if (linhas.some((l) => l.request_id === nova.request_id)) return { ok: false, motivo: "repetido" };
      if (nova.valor_centavos && tomados.has(nova.valor_centavos)) return { ok: false, motivo: "valor" };
      const id = `r${linhas.length + 1}`;
      linhas.push({ ...nova, id, meet_url: null, status: nova.status ?? "confirmado" });
      if (nova.valor_centavos) tomados.add(nova.valor_centavos);
      return { ok: true, id };
    },
    criarEvento: async () => ({ id: "ev1", meetUrl: "https://meet.google.com/abc" }),
    anexarEvento: async () => undefined,
    remover: async (id) => {
      const i = linhas.findIndex((x) => x.id === id);
      if (i >= 0) linhas.splice(i, 1);
    },
    avisar: async () => [],
    expirar: async () => {
      expirou++;
    },
    cobrar: async (c) => {
      if (opts.cobrancaCai) throw new Error("PSP fora");
      cobrancas.push({ reservaId: c.reservaId, valorCentavos: c.valorCentavos });
      return { ref: `mp-${c.reservaId}`, copiaECola: `000201...${c.valorCentavos}`, qrBase64: null };
    },
    anexarCobranca: async () => undefined,
  };
  return { deps, linhas, cobrancas, expirou: () => expirou };
}

let seq = 0;
const pedido = (extra: Record<string, unknown> = {}) => ({
  servico: "consulta",
  inicio: TERCA_9H,
  nome: "Maria Souza",
  whatsapp: "(11) 98765-4321",
  email: "maria@exemplo.com",
  request_id: `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`,
  aberto: String(AGORA - 60_000),
  ...extra,
});
const ctx = (deps: DepsReserva, bloco: BlocoAgendamento = BLOCO) => ({
  bloco,
  idBloco: "agenda",
  tz: TZ,
  agora: AGORA,
  ip: "1.2.3.4",
  sal: SAL,
  deps,
});

describe("schema do pagamento", () => {
  test("preço sem pagamento é recusado; modo email exige chave, nome e cidade", () => {
    expect(BlockSchema.safeParse({ ...BLOCO, pagamento: undefined }).success).toBe(false);
    expect(BlockSchema.safeParse({ ...BLOCO, pagamento: { modo: "email" } }).success).toBe(false);
    expect(BlockSchema.safeParse({ ...BLOCO, pagamento: { ...BLOCO.pagamento, chave: "nao-e-chave" } }).success).toBe(false);
    expect(BlockSchema.safeParse(BLOCO).success).toBe(true);
    expect(BlockSchema.safeParse(BLOCO_MP).success).toBe(true);
    expect(BlockSchema.safeParse({ ...BLOCO_MP, provedor: "microsoft" }).success).toBe(true);
    expect(BlockSchema.safeParse({ ...BLOCO_MP, provedor: "yahoo" }).success).toBe(false);
  });
});

describe("reserva paga", () => {
  test("modo email: segura o horário 15 min e devolve Pix com centavos próprios", async () => {
    const f = falsos();
    const r = await reservar(pedido(), ctx(f.deps));
    expect(r.tipo).toBe("pagar");
    if (r.tipo !== "pagar") return;
    const valor = r.pagamento.valorCentavos;
    expect(valor).toBeGreaterThan(30000);
    expect(valor).toBeLessThan(30100);
    expect(r.pagamento.copiaECola).toContain(`54${String((valor / 100).toFixed(2)).length.toString().padStart(2, "0")}${(valor / 100).toFixed(2)}`);
    expect(r.pagamento.expiraEm).toBe(new Date(AGORA + 15 * 60_000).toISOString());
    const linha = f.linhas[0]!;
    expect(linha.status).toBe("aguardando_pagamento");
    expect(linha.pagamento_modo).toBe("email");
    expect(linha.valor_preso_ate).toBe(new Date(AGORA + 15 * 60_000 + 48 * 3600_000).toISOString());
    expect(linha.token_hash).toBe(hashDoToken(r.pagamento.token));
    expect(f.expirou()).toBeGreaterThan(0);
  });

  test("modo email: centavos já tomados sorteia outro", async () => {
    const tomados = Array.from({ length: 98 }, (_, i) => 30001 + i); // sobra só 30099
    const f = falsos({ valoresTomados: tomados });
    const r = await reservar(pedido(), ctx(f.deps));
    expect(r.tipo).toBe("pagar");
    if (r.tipo === "pagar") expect(r.pagamento.valorCentavos).toBe(30099);
  });

  test("modo email: os 99 centavos tomados dá falha, sem laço sem fim", async () => {
    const tomados = Array.from({ length: 99 }, (_, i) => 30001 + i);
    const f = falsos({ valoresTomados: tomados });
    const r = await reservar(pedido(), ctx(f.deps));
    expect(r.tipo).toBe("falha");
    expect(f.linhas).toHaveLength(0);
  });

  test("modo mercadopago: valor cheio, cobrança no PSP com o id da reserva", async () => {
    const f = falsos();
    const r = await reservar(pedido(), ctx(f.deps, BLOCO_MP));
    expect(r.tipo).toBe("pagar");
    expect(f.cobrancas).toEqual([{ reservaId: "r1", valorCentavos: 30000 }]);
    expect(f.linhas[0]!.valor_preso_ate ?? null).toBeNull();
  });

  test("PSP fora: desfaz a reserva e o horário volta", async () => {
    const f = falsos({ cobrancaCai: true });
    const r = await reservar(pedido(), ctx(f.deps, BLOCO_MP));
    expect(r).toEqual({ tipo: "falha", mensagem: MSG.falha });
    expect(f.linhas).toHaveLength(0);
  });

  test("mesmo request_id devolve o mesmo token e o mesmo valor", async () => {
    const f = falsos();
    const p = pedido();
    const a = await reservar(p, ctx(f.deps));
    const b = await reservar(p, ctx(f.deps));
    expect(a.tipo).toBe("pagar");
    expect(b.tipo).toBe("pagar");
    if (a.tipo === "pagar" && b.tipo === "pagar") {
      expect(b.pagamento.token).toBe(a.pagamento.token);
      expect(b.pagamento.valorCentavos).toBe(a.pagamento.valorCentavos);
    }
    expect(f.linhas).toHaveLength(1);
  });

  test("serviço sem preço no bloco pago marca direto, como antes", async () => {
    const f = falsos();
    const r = await reservar(pedido({ servico: "papo" }), ctx(f.deps));
    expect(r.tipo).toBe("ok");
    expect(f.linhas[0]!.status).toBe("confirmado");
  });

  test("modo mercadopago sem e-mail: pede e-mail (o Mercado Pago exige)", async () => {
    const f = falsos();
    const r = await reservar(pedido({ email: "" }), ctx(f.deps, BLOCO_MP));
    expect(r).toEqual({ tipo: "invalido", mensagem: MSG.email });
  });
});

describe("token", () => {
  test("token depende do request_id e do sal, e o hash não é o token", () => {
    const a = tokenDoPedido("00000000-0000-4000-8000-000000000001", SAL);
    expect(a).toBe(tokenDoPedido("00000000-0000-4000-8000-000000000001", SAL));
    expect(a).not.toBe(tokenDoPedido("00000000-0000-4000-8000-000000000001", "outro"));
    expect(a.length).toBeGreaterThanOrEqual(32);
    expect(hashDoToken(a)).not.toBe(a);
  });

  test("centavos: os 99 valores de 1 a 99, cada um uma vez", () => {
    for (const s of [() => 0, () => 0.9999, Math.random]) {
      const lista = centavosEmbaralhados(30000, s);
      expect([...lista].sort((a, b) => a - b)).toEqual(Array.from({ length: 99 }, (_, i) => 30001 + i));
    }
  });
});

function reservaPaga(extra: Partial<ReservaPaga> = {}): ReservaPaga {
  return {
    id: "r1",
    bloco: "agenda",
    servico: "consulta",
    inicio: TERCA_9H,
    fim: "2026-10-27T12:30:00.000Z",
    status: "aguardando_pagamento",
    nome: "Maria",
    whatsapp: "5511987654321",
    email: "maria@exemplo.com",
    valor_centavos: 30017,
    pagamento_modo: "email",
    expira_em: new Date(AGORA + 15 * 60_000).toISOString(),
    created_at: new Date(AGORA).toISOString(),
    valor_preso_ate: new Date(AGORA + 15 * 60_000 + 48 * 3600_000).toISOString(),
    ...extra,
  };
}

function depsConfirmacao(opts: { slot?: "ok" | "ocupado" | "ja"; agendaOcupada?: boolean; eventoCai?: boolean } = {}) {
  const log: string[] = [];
  const deps: DepsConfirmacao = {
    marcarConfirmado: async () => {
      log.push("confirmado");
      return opts.slot ?? "ok";
    },
    marcarSemHorario: async () => {
      log.push("sem_horario");
    },
    ocupado: async () => (opts.agendaOcupada ? [{ inicioMs: Date.parse(TERCA_9H), fimMs: Date.parse(TERCA_9H) + 30 * 60_000 }] : []),
    criarEvento: async () => {
      if (opts.eventoCai) throw new Error("fora");
      log.push("evento");
      return { id: "ev1", meetUrl: "https://meet.google.com/x" };
    },
    anexarEvento: async () => {
      log.push("anexou");
    },
    avisar: async (a) => {
      log.push(`aviso:${a.entrega}`);
      return [];
    },
  };
  return { deps, log };
}

const confirmarCtx = (deps: DepsConfirmacao) => ({ titulo: "Consulta", tz: TZ, local: null, intervaloMin: 15, deps });

describe("confirmarPagamento", () => {
  test("hold vivo: confirma, cria evento e avisa", async () => {
    const d = depsConfirmacao();
    const r = await confirmarPagamento(reservaPaga(), { em: new Date(AGORA).toISOString(), ref: "m1" }, confirmarCtx(d.deps));
    expect(r).toBe("confirmado");
    expect(d.log.slice(0, 3)).toEqual(["confirmado", "evento", "anexou"]);
  });

  test("já confirmado: não faz nada", async () => {
    const d = depsConfirmacao();
    expect(await confirmarPagamento(reservaPaga({ status: "confirmado" }), { em: "x", ref: null }, confirmarCtx(d.deps))).toBe("ja");
    expect(d.log).toEqual([]);
  });

  test("expirado e horário livre: confirma mesmo assim", async () => {
    const d = depsConfirmacao();
    expect(await confirmarPagamento(reservaPaga({ status: "expirado" }), { em: "x", ref: null }, confirmarCtx(d.deps))).toBe("confirmado");
  });

  test("expirado e a agenda do dono ocupou: pago sem horário + aviso", async () => {
    const d = depsConfirmacao({ agendaOcupada: true });
    expect(await confirmarPagamento(reservaPaga({ status: "expirado" }), { em: "x", ref: null }, confirmarCtx(d.deps))).toBe("pago_sem_horario");
    expect(d.log[0]).toBe("sem_horario");
    expect(d.log.some((l) => l.startsWith("aviso:") && l.includes("sem horário"))).toBe(true);
  });

  test("expirado e outra pessoa pegou o horário (23P01): pago sem horário", async () => {
    const d = depsConfirmacao({ slot: "ocupado" });
    expect(await confirmarPagamento(reservaPaga({ status: "expirado" }), { em: "x", ref: null }, confirmarCtx(d.deps))).toBe("pago_sem_horario");
  });

  test("corrida: outro caminho confirmou antes", async () => {
    const d = depsConfirmacao({ slot: "ja" });
    expect(await confirmarPagamento(reservaPaga(), { em: "x", ref: null }, confirmarCtx(d.deps))).toBe("ja");
    expect(d.log).toEqual(["confirmado"]);
  });

  test("agenda fora na hora do evento: pago sem horário + aviso", async () => {
    const d = depsConfirmacao({ eventoCai: true });
    expect(await confirmarPagamento(reservaPaga(), { em: "x", ref: null }, confirmarCtx(d.deps))).toBe("pago_sem_horario");
    expect(d.log).toContain("sem_horario");
  });
});

describe("aviso do banco", () => {
  test.each([
    ["Você recebeu um Pix de MARIA SOUZA no valor de R$ 300,17.", 30017],
    ["Pix recebido\nValor: R$ 1.250,05\nDe: Fulano", 125005],
    ["Transferência Pix recebida de R$300,17 em 27/10", 30017],
    ["Você recebeu uma transferência via Pix. Valor R$ 50,00", 5000],
  ])("%s", (texto, centavos) => {
    expect(lerAvisoPix(texto)).toEqual({ valorCentavos: centavos });
  });

  test.each([
    ["Pix enviado: você pagou R$ 300,17 para Loja"],
    ["Sua fatura de R$ 300,17 vence amanhã"],
    ["Pix recebido sem valor"],
  ])("ignora: %s", (texto) => {
    expect(lerAvisoPix(texto)).toBeNull();
  });

  test("casa pelo valor exato dentro da janela de 48 h", () => {
    const candidatas = [
      reservaPaga({ id: "a", valor_centavos: 30017 }),
      reservaPaga({ id: "b", valor_centavos: 30018 }),
      reservaPaga({ id: "c", valor_centavos: 30017, created_at: new Date(AGORA - 72 * 3600_000).toISOString(), valor_preso_ate: new Date(AGORA - 20 * 3600_000).toISOString() }),
    ];
    expect(casarPagamento({ valorCentavos: 30017, recebidoEm: new Date(AGORA + 60_000).toISOString() }, candidatas)?.id).toBe("a");
    expect(casarPagamento({ valorCentavos: 30019, recebidoEm: new Date(AGORA + 60_000).toISOString() }, candidatas)).toBeNull();
    // Recebido antes de a reserva existir não casa.
    expect(casarPagamento({ valorCentavos: 30018, recebidoEm: new Date(AGORA - 60_000).toISOString() }, candidatas)).toBeNull();
  });
});
