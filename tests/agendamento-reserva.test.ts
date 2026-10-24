import { describe, expect, test, vi } from "vitest";
import { ConfigSchema } from "@/config/schema";
import { diasInteirosOcupados, ErroGoogle, ocupadoDoFreeBusy, tokenDeAcesso } from "@/lib/agendamento/google";
import { regraDoBloco, type BlocoAgendamento } from "@/lib/agendamento/regra";
import {
  horariosLivres,
  LIMITE_POR_IP_24H,
  MSG,
  reservar,
  type DepsReserva,
  type ReservaNova,
} from "@/lib/agendamento/reserva";

const TZ = "America/Sao_Paulo";
// Segunda, 26/10/2026, 08:00 em Brasília.
const AGORA = Date.parse("2026-10-26T11:00:00Z");
// Terça, 27/10, 09:00 em Brasília.
const TERCA_9H = "2026-10-27T12:00:00.000Z";

const BLOCO = {
  type: "agendamento",
  id: "agenda",
  servicos: [
    { id: "consulta", title: "Consulta", duracao: 30 },
    { id: "caso", title: "Análise de caso", duracao: 60 },
  ],
  pausas: [{ inicio: "12:00", fim: "13:00" }],
} as BlocoAgendamento;

/** Banco e Google de mentira, com a mesma regra de sobreposição da constraint. */
function falsos(opts: { ocupado?: { inicio: string; fim: string }[]; googleCai?: boolean; eventoCai?: boolean } = {}) {
  const linhas: (ReservaNova & { id: string; meet_url: string | null; status: string })[] = [];
  const eventos: string[] = [];
  const avisos: unknown[] = [];
  const deps: DepsReserva = {
    ocupado: async () => {
      if (opts.googleCai) throw new ErroGoogle("token", "caiu");
      return (opts.ocupado ?? []).map((o) => ({ inicioMs: Date.parse(o.inicio), fimMs: Date.parse(o.fim) }));
    },
    reservasEntre: async () => linhas.filter((l) => l.status === "confirmado").map((l) => ({ inicio: l.inicio, fim: l.fim })),
    porPedido: async (id) => {
      const l = linhas.find((x) => x.request_id === id);
      return l ? { id: l.id, servico: l.servico, inicio: l.inicio, fim: l.fim, meet_url: l.meet_url } : null;
    },
    contarDoIp: async (hash) => linhas.filter((l) => l.ip_hash === hash).length,
    inserir: async (nova) => {
      if (linhas.some((l) => l.request_id === nova.request_id)) return { ok: false, motivo: "repetido" };
      const cruza = linhas.some(
        (l) => l.status === "confirmado" && Date.parse(nova.inicio) < Date.parse(l.fim) && Date.parse(l.inicio) < Date.parse(nova.fim),
      );
      if (cruza) return { ok: false, motivo: "ocupado" };
      const id = `r${linhas.length + 1}`;
      linhas.push({ ...nova, id, meet_url: null, status: "confirmado" });
      return { ok: true, id };
    },
    criarEvento: async (ev) => {
      if (opts.eventoCai) throw new Error("Google fora");
      eventos.push(ev.titulo);
      return { id: `ev${eventos.length}`, meetUrl: ev.local ? null : "https://meet.google.com/abc-defg-hij" };
    },
    anexarEvento: async (id, ev) => {
      const l = linhas.find((x) => x.id === id);
      if (l) l.meet_url = ev.meetUrl;
    },
    remover: async (id) => {
      const i = linhas.findIndex((x) => x.id === id);
      if (i >= 0) linhas.splice(i, 1);
    },
    avisar: async (a) => {
      avisos.push(a);
      return [];
    },
  };
  return { deps, linhas, eventos, avisos };
}

let seq = 0;
const pedido = (extra: Record<string, unknown> = {}) => ({
  servico: "consulta",
  inicio: TERCA_9H,
  nome: "Maria Souza",
  whatsapp: "(11) 98765-4321",
  request_id: `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`,
  aberto: String(AGORA - 60_000),
  ...extra,
});
const ctx = (deps: DepsReserva, ip = "1.2.3.4", bloco: BlocoAgendamento = BLOCO) => ({
  bloco,
  idBloco: "agenda",
  tz: TZ,
  agora: AGORA,
  ip,
  sal: "sal",
  deps,
});

describe("schema do bloco agendamento", () => {
  const base = (bloco: Record<string, unknown>) =>
    ConfigSchema.safeParse({
      site: { url: "https://bio.exemplo.com", locale: "pt-BR", tz: TZ },
      theme: { preset: "neutro" },
      profile: { name: "P", handle: "@p", avatar: "/a.jpg", bio: "b", tags: [] },
      contact: { whatsapp: "5511987654321" },
      blocks: [bloco],
    });

  test("aceita o mínimo e aplica os padrões na regra", () => {
    const r = base({ type: "agendamento", servicos: [{ id: "consulta", title: "Consulta", duracao: 30 }] });
    expect(r.success).toBe(true);
    const regra = regraDoBloco(BLOCO, TZ);
    expect(regra).toMatchObject({ dias: [1, 2, 3, 4, 5], inicio: 540, fim: 1080, antecedenciaMin: 720, janelaDias: 14, intervaloMin: 15, passoMin: 30 });
  });

  test("recusa duração fora de 5 em 5, fim antes do início e id de serviço repetido", () => {
    const erros = (b: Record<string, unknown>) => {
      const r = base(b);
      return r.success ? [] : r.error.issues.map((i) => i.message);
    };
    expect(erros({ type: "agendamento", servicos: [{ id: "a", title: "A", duracao: 32 }] }).join()).toContain("de 5 em 5");
    expect(erros({ type: "agendamento", inicio: "18:00", fim: "09:00", servicos: [{ id: "a", title: "A", duracao: 30 }] }).join()).toContain(
      "fim precisa ser depois do início",
    );
    expect(
      erros({ type: "agendamento", servicos: [{ id: "a", title: "A", duracao: 30 }, { id: "a", title: "B", duracao: 30 }] }).join(),
    ).toContain("id diferente");
    expect(erros({ type: "agendamento", dias: ["segunda"], servicos: [{ id: "a", title: "A", duracao: 30 }] }).join()).toContain('"seg"');
  });
});

describe("horariosLivres", () => {
  test("tira o ocupado do Google e as reservas do banco", async () => {
    const f = falsos({ ocupado: [{ inicio: "2026-10-27T13:00:00Z", fim: "2026-10-27T14:00:00Z" }] });
    await reservar(pedido(), ctx(f.deps));
    const livres = (await horariosLivres(BLOCO, TZ, "consulta", f.deps, AGORA))!.filter((h) => h.dia === "2026-10-27").map((h) => h.hora);
    expect(livres).not.toContain("09:00"); // reservado
    expect(livres).not.toContain("10:00"); // Google
    expect(livres).not.toContain("11:00"); // intervalo de 15 min depois do Google
    expect(livres).toContain("11:30");
  });

  test("serviço desconhecido devolve null; Google fora derruba a consulta (falha fechada)", async () => {
    expect(await horariosLivres(BLOCO, TZ, "nada", falsos().deps, AGORA)).toBeNull();
    await expect(horariosLivres(BLOCO, TZ, "consulta", falsos({ googleCai: true }).deps, AGORA)).rejects.toThrow();
  });
});

describe("reservar", () => {
  test("grava, cria o evento com Meet, avisa o dono e confirma", async () => {
    const f = falsos();
    const r = await reservar(pedido(), ctx(f.deps));
    expect(r).toMatchObject({ tipo: "ok", confirmacao: { servico: "Consulta", inicio: TERCA_9H, meetUrl: "https://meet.google.com/abc-defg-hij" } });
    expect(f.linhas).toHaveLength(1);
    expect(f.linhas[0]).toMatchObject({ whatsapp: "11987654321", fim: "2026-10-27T12:30:00.000Z", meet_url: "https://meet.google.com/abc-defg-hij" });
    expect(f.eventos).toEqual(["Consulta · Maria Souza"]);
    expect(f.avisos).toHaveLength(1);
  });

  test("grava a origem e a campanha da reserva e manda no aviso; sem elas, vale o Referer", async () => {
    const f = falsos();
    await reservar(pedido({ origem: "bio", utm: { utm_source: "ig", utm_medium: "bio" } }), ctx(f.deps));
    expect(f.linhas[0]).toMatchObject({ origem: "bio", utm: { utm_source: "ig", utm_medium: "bio" } });
    expect(f.avisos[0]).toMatchObject({ origem: "bio" });
    const g = falsos();
    await reservar(pedido(), { ...ctx(g.deps), referer: "https://bio.exemplo.com/?src=stories" });
    expect(g.linhas[0]).toMatchObject({ origem: "stories", utm: null });
  });

  test("com local, o evento leva o endereço e não cria Meet", async () => {
    const f = falsos();
    const r = await reservar(pedido(), ctx(f.deps, "1.2.3.4", { ...BLOCO, local: "Av. Paulista, 1000" }));
    expect(r).toMatchObject({ tipo: "ok", confirmacao: { meetUrl: null, local: "Av. Paulista, 1000" } });
  });

  test("dois pedidos no mesmo horário: o segundo recebe 'ocupado'", async () => {
    const f = falsos();
    const [a, b] = await Promise.all([reservar(pedido(), ctx(f.deps, "1.1.1.1")), reservar(pedido(), ctx(f.deps, "2.2.2.2"))]);
    expect([a.tipo, b.tipo].sort()).toEqual(["ocupado", "ok"]);
    expect(f.linhas).toHaveLength(1);
    expect(f.eventos).toHaveLength(1);
  });

  test("mesmo request_id devolve a mesma reserva, sem evento novo", async () => {
    const f = falsos();
    const p = pedido();
    await reservar(p, ctx(f.deps));
    const de_novo = await reservar(p, ctx(f.deps));
    expect(de_novo).toMatchObject({ tipo: "ok", repetido: true, confirmacao: { inicio: TERCA_9H } });
    expect(f.eventos).toHaveLength(1);
  });

  test("Google falha ao criar o evento: a reserva sai do banco", async () => {
    const f = falsos({ eventoCai: true });
    const r = await reservar(pedido(), ctx(f.deps));
    expect(r).toEqual({ tipo: "falha", mensagem: MSG.falha });
    expect(f.linhas).toHaveLength(0);
  });

  test("Google fora na conferência: falha sem gravar", async () => {
    const f = falsos({ googleCai: true });
    expect((await reservar(pedido(), ctx(f.deps))).tipo).toBe("falha");
    expect(f.linhas).toHaveLength(0);
  });

  test("horário ocupado no Google na hora de confirmar", async () => {
    const f = falsos({ ocupado: [{ inicio: "2026-10-27T12:15:00Z", fim: "2026-10-27T12:45:00Z" }] });
    expect(await reservar(pedido(), ctx(f.deps))).toEqual({ tipo: "ocupado", mensagem: MSG.ocupado });
  });

  test("horário fora da regra, no almoço ou fora da grade", async () => {
    const f = falsos();
    for (const inicio of ["2026-10-31T12:00:00Z", "2026-10-27T15:00:00Z", "2026-10-27T12:17:00Z", "2026-10-26T12:00:00Z"]) {
      expect(await reservar(pedido({ inicio }), ctx(f.deps))).toEqual({ tipo: "ocupado", mensagem: MSG.horario });
    }
  });

  test("teto por dia", async () => {
    const f = falsos();
    const bloco = { ...BLOCO, maxPorDia: 1 };
    expect((await reservar(pedido(), ctx(f.deps, "1.1.1.1", bloco))).tipo).toBe("ok");
    expect(await reservar(pedido({ inicio: "2026-10-27T17:00:00Z" }), ctx(f.deps, "2.2.2.2", bloco))).toEqual({
      tipo: "ocupado",
      mensagem: MSG.diaCheio,
    });
  });

  test("limite por IP em 24 h", async () => {
    const f = falsos();
    const horas = ["12:00", "13:00", "14:00", "17:00"].map((h) => `2026-10-28T${h}:00Z`);
    const tipos = [];
    for (const inicio of horas) tipos.push((await reservar(pedido({ inicio }), ctx(f.deps))).tipo);
    expect(tipos.slice(0, LIMITE_POR_IP_24H)).toEqual(["ok", "ok", "ok"]);
    expect(tipos[LIMITE_POR_IP_24H]).toBe("limite");
  });

  test("isca, envio rápido demais e campos inválidos", async () => {
    const f = falsos();
    expect(await reservar(pedido({ empresa: "robô" }), ctx(f.deps))).toEqual({ tipo: "isca" });
    expect(await reservar(pedido({ aberto: String(AGORA - 500) }), ctx(f.deps))).toEqual({ tipo: "cedo" });
    expect(await reservar(pedido({ servico: "x" }), ctx(f.deps))).toEqual({ tipo: "invalido", mensagem: MSG.servico });
    expect(await reservar(pedido({ nome: "A" }), ctx(f.deps))).toEqual({ tipo: "invalido", mensagem: MSG.nome });
    expect(await reservar(pedido({ whatsapp: "123" }), ctx(f.deps))).toEqual({ tipo: "invalido", mensagem: MSG.whatsapp });
    expect(await reservar(pedido({ request_id: "x" }), ctx(f.deps))).toEqual({ tipo: "invalido", mensagem: MSG.recarregar });
    expect(await reservar(pedido(), ctx(f.deps, "1.2.3.4", { ...BLOCO, pedirEmail: true }))).toEqual({ tipo: "invalido", mensagem: MSG.email });
    expect(f.linhas).toHaveLength(0);
  });

  test("com e-mail, a pessoa vira convidada do evento", async () => {
    const f = falsos();
    const criar = vi.spyOn(f.deps, "criarEvento");
    await reservar(pedido({ email: "maria@exemplo.com" }), ctx(f.deps));
    expect(criar.mock.calls[0]?.[0]).toMatchObject({ convidado: "maria@exemplo.com" });
  });
});

describe("Google", () => {
  test("freeBusy com erro na agenda derruba a consulta", () => {
    expect(() => ocupadoDoFreeBusy({ calendars: { primary: { errors: [{ reason: "notFound" }] } } })).toThrow("notFound");
    expect(() => ocupadoDoFreeBusy({ calendars: {} })).toThrow();
    expect(ocupadoDoFreeBusy({ calendars: { primary: { busy: [{ start: "2026-10-27T12:00:00Z", end: "2026-10-27T13:00:00Z" }] } } })).toEqual([
      { inicioMs: Date.parse("2026-10-27T12:00:00Z"), fimMs: Date.parse("2026-10-27T13:00:00Z") },
    ]);
  });

  test("dia inteiro fecha o dia; ignora o que o Google cria, cancelado e recusado", () => {
    const r = diasInteirosOcupados(
      [
        { start: { date: "2026-10-28" }, end: { date: "2026-10-29" } },
        { start: { date: "2026-10-29" }, end: { date: "2026-10-30" }, eventType: "workingLocation" },
        { start: { date: "2026-10-29" }, end: { date: "2026-10-30" }, status: "cancelled" },
        { start: { date: "2026-10-29" }, end: { date: "2026-10-30" }, attendees: [{ self: true, responseStatus: "declined" }] },
        { start: { dateTime: "2026-10-29T12:00:00Z" }, end: { dateTime: "2026-10-29T13:00:00Z" } },
      ],
      TZ,
    );
    expect(r).toEqual([{ inicioMs: Date.parse("2026-10-28T03:00:00Z"), fimMs: Date.parse("2026-10-29T03:00:00Z") }]);
  });

  test("refresh token revogado vira erro do tipo token", async () => {
    const busca = async () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });
    await expect(tokenDeAcesso({ clientId: "c", clientSecret: "s", refreshToken: "revogado" }, busca)).rejects.toMatchObject({ tipo: "token" });
  });

  test("access token fica guardado até perto de expirar", async () => {
    let chamadas = 0;
    const busca = async () => {
      chamadas++;
      return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }));
    };
    const cred = { clientId: "c", clientSecret: "s", refreshToken: "ok-cache" };
    expect(await tokenDeAcesso(cred, busca, 0)).toBe("tok");
    expect(await tokenDeAcesso(cred, busca, 60_000)).toBe("tok");
    expect(chamadas).toBe(1);
  });
});
