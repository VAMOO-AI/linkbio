import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  assinaturaMPValida,
  cancelarPagamentoMP,
  consultarPagamentoMP,
  criarCobrancaMP,
  ErroMP,
} from "@/lib/agendamento/mercadopago";

type Gravada = { url: string; init: RequestInit };

/** fetch falso: grava cada requisição e responde com o status e o corpo dados. */
function buscaFalsa(status: number, corpo: unknown) {
  const chamadas: Gravada[] = [];
  const busca = async (url: string, init: RequestInit = {}) => {
    chamadas.push({ url, init });
    const texto = typeof corpo === "string" ? corpo : JSON.stringify(corpo);
    return new Response(texto, { status });
  };
  return { busca, chamadas };
}

const cred = { accessToken: "APP_USR-teste" };
const AGORA = Date.parse("2026-11-12T15:00:00.000Z");
const RESPOSTA_PIX = {
  id: 123456789,
  status: "pending",
  point_of_interaction: { transaction_data: { qr_code: "00020126PIXCOPIAECOLA", qr_code_base64: "iVBORw0KGgo=" } },
};

function cobranca(expiraEm: string, extra: Record<string, unknown> = {}) {
  return {
    reservaId: "res-42",
    valorCentavos: 30017,
    descricao: "Consulta 1h",
    expiraEm,
    email: "cliente@exemplo.com",
    nome: "Maria",
    ...extra,
  };
}

function headers(init: RequestInit): Record<string, string> {
  return Object.fromEntries(new Headers(init.headers).entries());
}

const agoraIso = new Date(AGORA).toISOString();

describe("criarCobrancaMP", () => {
  it("monta o POST com idempotência, valor em reais e expiração mínima de 31 min em -03:00", async () => {
    const { busca, chamadas } = buscaFalsa(201, RESPOSTA_PIX);
    const em15 = new Date(AGORA + 15 * 60_000).toISOString();
    const r = await criarCobrancaMP(cred, cobranca(em15, { notificacaoUrl: "https://bio.exemplo.com/api/mp" }), busca, AGORA);

    expect(r).toEqual({ ref: "123456789", copiaECola: "00020126PIXCOPIAECOLA", qrBase64: "iVBORw0KGgo=" });
    expect(chamadas).toHaveLength(1);
    const { url, init } = chamadas[0]!;
    expect(url).toBe("https://api.mercadopago.com/v1/payments");
    expect(init.method).toBe("POST");
    const h = headers(init);
    expect(h.authorization).toBe("Bearer APP_USR-teste");
    expect(h["content-type"]).toBe("application/json");
    expect(h["x-idempotency-key"]).toBe("linkbio-agenda-res-42");

    expect(JSON.parse(String(init.body))).toEqual({
      transaction_amount: 300.17,
      description: "Consulta 1h",
      payment_method_id: "pix",
      external_reference: "res-42",
      payer: { email: "cliente@exemplo.com", first_name: "Maria" },
      notification_url: "https://bio.exemplo.com/api/mp",
      // 15:00Z + 31 min = 15:31Z = 12:31 em Brasília
      date_of_expiration: "2026-11-12T12:31:00.000-03:00",
    });
  });

  it("mantém o expiraEm quando ele já passa de 31 min e omite notification_url sem URL", async () => {
    const { busca, chamadas } = buscaFalsa(201, RESPOSTA_PIX);
    const em2h = new Date(AGORA + 2 * 3600_000 + 123).toISOString();
    await criarCobrancaMP(cred, cobranca(em2h), busca, AGORA);
    const corpo = JSON.parse(String(chamadas[0]!.init.body));
    expect(corpo.date_of_expiration).toBe("2026-11-12T14:00:00.123-03:00");
    expect(corpo).not.toHaveProperty("notification_url");
  });

  it("vira o dia certo no fuso de Brasília", async () => {
    const { busca, chamadas } = buscaFalsa(201, RESPOSTA_PIX);
    const agora = Date.parse("2026-11-13T01:00:00.000Z");
    await criarCobrancaMP(cred, cobranca(new Date(agora).toISOString()), busca, agora);
    expect(JSON.parse(String(chamadas[0]!.init.body)).date_of_expiration).toBe("2026-11-12T22:31:00.000-03:00");
  });

  it("qr_code_base64 ausente vira null", async () => {
    const { busca } = buscaFalsa(201, { id: 1, point_of_interaction: { transaction_data: { qr_code: "PIX" } } });
    const r = await criarCobrancaMP(cred, cobranca(agoraIso), busca, AGORA);
    expect(r).toEqual({ ref: "1", copiaECola: "PIX", qrBase64: null });
  });

  it("resposta sem qr_code é erro de api", async () => {
    const { busca } = buscaFalsa(201, { id: 1, status: "pending" });
    const p = criarCobrancaMP(cred, cobranca(agoraIso), busca, AGORA);
    await expect(p).rejects.toBeInstanceOf(ErroMP);
    await expect(p).rejects.toMatchObject({ tipo: "api" });
  });

  it("401 é erro de token", async () => {
    const { busca } = buscaFalsa(401, { message: "invalid access token" });
    await expect(criarCobrancaMP(cred, cobranca(agoraIso), busca, AGORA)).rejects.toMatchObject({
      name: "ErroMP",
      tipo: "token",
    });
  });

  it("403 é erro de token e 500 é erro de api", async () => {
    await expect(criarCobrancaMP(cred, cobranca(agoraIso), buscaFalsa(403, {}).busca, AGORA)).rejects.toMatchObject({
      tipo: "token",
    });
    await expect(criarCobrancaMP(cred, cobranca(agoraIso), buscaFalsa(500, "boom").busca, AGORA)).rejects.toMatchObject({
      tipo: "api",
    });
  });
});

describe("consultarPagamentoMP", () => {
  it("mapeia os campos do pagamento", async () => {
    const { busca, chamadas } = buscaFalsa(200, {
      id: 987,
      status: "approved",
      external_reference: "res-42",
      transaction_amount: 300.17,
      date_approved: "2026-11-12T12:10:00.000-03:00",
    });
    expect(await consultarPagamentoMP(cred, "987", busca)).toEqual({
      id: "987",
      status: "approved",
      reservaId: "res-42",
      valorCentavos: 30017,
      aprovadoEm: "2026-11-12T12:10:00.000-03:00",
    });
    expect(chamadas[0]!.url).toBe("https://api.mercadopago.com/v1/payments/987");
    expect(chamadas[0]!.init.method ?? "GET").toBe("GET");
    expect(headers(chamadas[0]!.init).authorization).toBe("Bearer APP_USR-teste");
  });

  it("sem external_reference e sem aprovação vira null", async () => {
    const { busca } = buscaFalsa(200, { id: 5, status: "pending", transaction_amount: 10, external_reference: null });
    expect(await consultarPagamentoMP(cred, "5", busca)).toMatchObject({ reservaId: null, aprovadoEm: null, valorCentavos: 1000 });
  });

  it("401 é erro de token", async () => {
    await expect(consultarPagamentoMP(cred, "5", buscaFalsa(401, {}).busca)).rejects.toMatchObject({ tipo: "token" });
  });
});

describe("cancelarPagamentoMP", () => {
  it("manda PUT com status cancelled", async () => {
    const { busca, chamadas } = buscaFalsa(200, { id: 9, status: "cancelled" });
    await cancelarPagamentoMP(cred, "9", busca);
    expect(chamadas[0]!.url).toBe("https://api.mercadopago.com/v1/payments/9");
    expect(chamadas[0]!.init.method).toBe("PUT");
    expect(headers(chamadas[0]!.init).authorization).toBe("Bearer APP_USR-teste");
    expect(JSON.parse(String(chamadas[0]!.init.body))).toEqual({ status: "cancelled" });
  });

  it("engole 400 e 404", async () => {
    await expect(cancelarPagamentoMP(cred, "9", buscaFalsa(400, { message: "not pending" }).busca)).resolves.toBeUndefined();
    await expect(cancelarPagamentoMP(cred, "9", buscaFalsa(404, { message: "not found" }).busca)).resolves.toBeUndefined();
  });

  it("sobe 500 como ErroMP api e 401 como token", async () => {
    await expect(cancelarPagamentoMP(cred, "9", buscaFalsa(500, "erro").busca)).rejects.toMatchObject({ name: "ErroMP", tipo: "api" });
    await expect(cancelarPagamentoMP(cred, "9", buscaFalsa(401, {}).busca)).rejects.toMatchObject({ tipo: "token" });
  });
});

describe("assinaturaMPValida", () => {
  const secret = "segredo-do-webhook";
  const ts = "1704908010";
  const assinar = (manifest: string) => createHmac("sha256", secret).update(manifest).digest("hex");
  const v1Completo = () => assinar(`id:123456;request-id:req-abc;ts:${ts};`);

  it("aceita a assinatura correta", () => {
    expect(
      assinaturaMPValida({ xSignature: `ts=${ts},v1=${v1Completo()}`, xRequestId: "req-abc", dataId: "123456", secret }),
    ).toBe(true);
  });

  it("tolera espaços entre os pares do header", () => {
    expect(
      assinaturaMPValida({ xSignature: ` ts=${ts}, v1=${v1Completo()} `, xRequestId: "req-abc", dataId: "123456", secret }),
    ).toBe(true);
  });

  it("recusa assinatura errada, secret errada, ts trocado ou v1 de tamanho diferente", () => {
    const v1 = v1Completo();
    const base = { xRequestId: "req-abc", dataId: "123456" };
    expect(assinaturaMPValida({ ...base, xSignature: `ts=${ts},v1=${"0".repeat(64)}`, secret })).toBe(false);
    expect(assinaturaMPValida({ ...base, xSignature: `ts=${ts},v1=${v1}`, secret: "outra" })).toBe(false);
    expect(assinaturaMPValida({ ...base, xSignature: `ts=9999999999,v1=${v1}`, secret })).toBe(false);
    expect(assinaturaMPValida({ ...base, xSignature: `ts=${ts},v1=abc`, secret })).toBe(false);
  });

  it("recusa header malformado, ausente ou sem secret", () => {
    const v1 = v1Completo();
    const base = { xRequestId: "req-abc", dataId: "123456", secret };
    expect(assinaturaMPValida({ ...base, xSignature: null })).toBe(false);
    expect(assinaturaMPValida({ ...base, xSignature: "lixo" })).toBe(false);
    expect(assinaturaMPValida({ ...base, xSignature: `v1=${v1}` })).toBe(false);
    expect(assinaturaMPValida({ ...base, xSignature: `ts=${ts}` })).toBe(false);
    expect(assinaturaMPValida({ ...base, xSignature: `ts=${ts},v1=${v1}`, secret: "" })).toBe(false);
  });

  it("sem request-id omite o par do manifest", () => {
    const v1 = assinar(`id:123456;ts:${ts};`);
    expect(assinaturaMPValida({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: null, dataId: "123456", secret })).toBe(true);
  });

  it("sem data.id omite o par do manifest", () => {
    const v1 = assinar(`request-id:req-abc;ts:${ts};`);
    expect(assinaturaMPValida({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: "req-abc", dataId: null, secret })).toBe(true);
  });

  it("data.id com maiúsculas entra em minúsculas no manifest", () => {
    const v1 = assinar(`id:abc123def;request-id:req-abc;ts:${ts};`);
    expect(
      assinaturaMPValida({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: "req-abc", dataId: "ABC123Def", secret }),
    ).toBe(true);
  });
});
