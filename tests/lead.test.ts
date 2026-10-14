import { describe, expect, test } from "vitest";
import {
  ESPERA_MINIMA_MS,
  LIMITE_POR_HORA,
  abertoDoCookie,
  avisarDono,
  csvDeContatos,
  hashIp,
  tratarLead,
  type BlocoNaPagina,
  type LeadGravado,
} from "../lib/lead";

const AGORA = 1_800_000_000_000;
const IP = "203.0.113.8";
const SAL = "sal-de-teste";

const blocos: BlocoNaPagina[] = [
  { type: "profile" },
  {
    type: "lead",
    id: "planner",
    pedir: "whatsapp",
    entrega: { url: "https://exemplo.com/planner.pdf" },
  },
  { type: "lead", id: "turma", pedir: "ambos", enabled: false },
];

function corpo(extra: Record<string, string> = {}) {
  return {
    bloco: "planner",
    nome: "Ana Souza",
    whatsapp: "(11) 98765-4321",
    consentimento: "sim",
    aberto: String(AGORA - ESPERA_MINIMA_MS - 50),
    empresa: "",
    ...extra,
  };
}

function ctx(sobre: Partial<Parameters<typeof tratarLead>[1]> = {}) {
  const gravados: LeadGravado[] = [];
  const base = {
    agora: AGORA,
    blocos,
    supabase: true,
    ip: IP,
    sal: SAL,
    contar: async () => 0,
    gravar: async (lead: LeadGravado) => {
      gravados.push(lead);
    },
    avisar: async () => [] as string[],
    ...sobre,
  };
  return { gravados, base };
}

describe("tratarLead", () => {
  test("grava contato válido, sem o IP cru, e avisa mesmo se o aviso falhar", async () => {
    const { gravados, base } = ctx({
      avisar: async () => {
        throw new Error("rede fora");
      },
    });
    const r = await tratarLead(corpo(), base);
    expect(r.tipo).toBe("ok");
    expect(gravados).toHaveLength(1);
    const salvo = JSON.stringify(gravados[0]);
    expect(salvo).not.toContain(IP);
    expect(gravados[0]!.whatsapp).toBe("11987654321");
    expect(gravados[0]!.entrega).toBe("https://exemplo.com/planner.pdf");
    expect(gravados[0]!.ip_hash).toMatch(/^[a-f0-9]{64}$/);
    if (r.tipo === "ok") expect(r.avisosFalhos).toEqual(["aviso"]);
  });

  test("honeypot preenchido não grava e responde como se tivesse dado certo", async () => {
    const { gravados, base } = ctx();
    const r = await tratarLead(corpo({ empresa: "acme ltda" }), base);
    expect(r.tipo).toBe("isca");
    expect(gravados).toEqual([]);
  });

  test("envio rápido demais não grava", async () => {
    const { gravados, base } = ctx();
    const r = await tratarLead(corpo({ aberto: String(AGORA - 200) }), base);
    expect(r.tipo).toBe("cedo");
    expect(gravados).toEqual([]);
  });

  test("sem concordância, sem WhatsApp ou e-mail inválido explica em português", async () => {
    const semCaixa = await tratarLead(corpo({ consentimento: "" }), ctx().base);
    expect(semCaixa.tipo).toBe("invalido");
    if (semCaixa.tipo === "invalido") expect(semCaixa.mensagem).toMatch(/concord/);

    const semNumero = await tratarLead(corpo({ whatsapp: "123" }), ctx().base);
    expect(semNumero.tipo).toBe("invalido");
    if (semNumero.tipo === "invalido") expect(semNumero.mensagem).toMatch(/WhatsApp/);

    const ambos = blocos.map((b) => (b.id === "planner" ? { ...b, pedir: "ambos" as const } : b));
    const emailRuim = await tratarLead(corpo({ email: "ana@" }), { ...ctx().base, blocos: ambos });
    expect(emailRuim.tipo).toBe("invalido");
    if (emailRuim.tipo === "invalido") expect(emailRuim.mensagem).toMatch(/e-mail/);
  });

  test("passa do limite por hora e não grava", async () => {
    const { gravados, base } = ctx({ contar: async () => LIMITE_POR_HORA });
    const r = await tratarLead(corpo(), base);
    expect(r.tipo).toBe("limite");
    expect(gravados).toEqual([]);
  });

  test("sem banco não chama a gravação", async () => {
    const { gravados, base } = ctx({ supabase: false });
    const r = await tratarLead(corpo(), base);
    expect(r.tipo).toBe("sem-banco");
    expect(gravados).toEqual([]);
  });

  test("bloco desligado ou desconhecido não grava", async () => {
    const r = await tratarLead(corpo({ bloco: "turma" }), ctx().base);
    expect(r.tipo).toBe("invalido");
  });
});

describe("abertoDoCookie", () => {
  test("lê a hora e ignora cookie ausente ou malformado", () => {
    expect(abertoDoCookie(null)).toBeUndefined();
    expect(abertoDoCookie("lead_aberto=1800000000000")).toBe("1800000000000");
    expect(abertoDoCookie("outra=1; lead_aberto=1800000000000")).toBe("1800000000000");
    expect(abertoDoCookie("lead_aberto=agora")).toBeUndefined();
  });
});

describe("hashIp", () => {
  test("é estável, muda com o IP e não devolve o IP", () => {
    const a = hashIp(IP, SAL);
    expect(a).toBe(hashIp(IP, SAL));
    expect(a).not.toBe(hashIp("203.0.113.9", SAL));
    expect(a).not.toContain(IP);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("avisarDono", () => {
  test("falha de webhook e de e-mail não estoura: devolve o que falhou", async () => {
    const falhas = await avisarDono(
      {
        bloco: "planner",
        nome: "Ana",
        whatsapp: "11987654321",
        email: null,
        entrega: null,
        criado_em: "2026-10-13T12:00:00.000Z",
      },
      { LEAD_WEBHOOK_URL: "https://hooks.exemplo.com/lead", RESEND_API_KEY: "re_test", LEAD_EMAIL_PARA: "dono@exemplo.com" },
      async (url) => {
        if (String(url).includes("hooks.exemplo.com")) return new Response("nao", { status: 500 });
        throw new Error("resend fora");
      },
    );
    expect(falhas.sort()).toEqual(["email", "webhook"]);
  });

  test("sem webhook e sem chave não chama a rede", async () => {
    let chamadas = 0;
    const falhas = await avisarDono(
      { bloco: "planner", nome: "Ana", whatsapp: null, email: "ana@exemplo.com", entrega: null, criado_em: "2026-10-13T12:00:00.000Z" },
      {},
      async () => {
        chamadas += 1;
        return new Response("ok");
      },
    );
    expect(falhas).toEqual([]);
    expect(chamadas).toBe(0);
  });
});

describe("csvDeContatos", () => {
  test("escapa vírgula e aspas e não inclui IP", () => {
    const csv = csvDeContatos([
      { nome: 'Ana "Souza", nutricionista', whatsapp: "11987654321", email: null, bloco: "planner", created_at: "2026-10-13T12:00:00.000Z" },
    ]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"Ana ""Souza"", nutricionista"');
    expect(csv).not.toMatch(/203\.0\.113/);
    expect(csv.split("\n")[0]).toMatch(/nome,whatsapp,email/);
  });
});
