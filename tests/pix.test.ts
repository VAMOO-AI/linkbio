import { describe, expect, test } from "vitest";
import { crc16, gerarBrCode, mensagemDaChave, semAcento } from "../lib/pix";
import { qrSvg } from "../lib/qr";

/** Vetor da seção de QR estático do Manual de Padrões para Iniciação do Pix (CRC 1D3D). */
const EXEMPLO_BC =
  "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D";

/** CRC-16/CCITT-FALSE independente, conferido contra o vetor "123456789" → 29B1. */
function crcReferencia(texto: string): string {
  let crc = 0xffff;
  for (let i = 0; i < texto.length; i++) {
    crc ^= texto.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function campos(payload: string): Map<string, string> {
  const mapa = new Map<string, string>();
  let i = 0;
  while (i + 4 <= payload.length) {
    const id = payload.slice(i, i + 2);
    const tam = Number(payload.slice(i + 2, i + 4));
    const valor = payload.slice(i + 4, i + 4 + tam);
    expect(valor, id).toHaveLength(tam);
    mapa.set(id, valor);
    i += 4 + tam;
    if (id === "63") break;
  }
  expect(i).toBe(payload.length);
  return mapa;
}

describe("BR Code", () => {
  test("CRC-16/CCITT-FALSE do vetor 123456789 é 29B1", () => {
    expect(crcReferencia("123456789")).toBe("29B1");
    expect(crc16("123456789")).toBe("29B1");
  });

  test("bate com o QR estático do manual do BC", () => {
    const codigo = gerarBrCode({
      chave: "123e4567-e12b-12d1-a456-426655440000",
      nome: "Fulano de Tal",
      cidade: "BRASILIA",
    });
    expect(codigo).toBe(EXEMPLO_BC);
    expect(codigo.slice(-4)).toBe(crcReferencia(codigo.slice(0, -4)));
  });

  test("com valor, o campo 54 entra em reais e o CRC fecha", () => {
    const codigo = gerarBrCode({
      chave: "123e4567-e12b-12d1-a456-426655440000",
      nome: "Fulano de Tal",
      cidade: "BRASILIA",
      valor_cents: 4990,
      txid: "consulta",
    });
    const mapa = campos(codigo);
    expect(mapa.get("00")).toBe("01");
    expect(mapa.get("53")).toBe("986");
    expect(mapa.get("54")).toBe("49.90");
    expect(mapa.get("58")).toBe("BR");
    expect(mapa.get("62")).toBe("0508consulta");
    expect(mapa.get("26")).toContain("br.gov.bcb.pix");
    expect(codigo.slice(-4)).toBe(crcReferencia(codigo.slice(0, -4)));
    expect(codigo.includes("54")).toBe(true);
  });

  test("sem txid o campo 62 leva ***", () => {
    const codigo = gerarBrCode({
      chave: "fulano@example.com",
      nome: "Fulano",
      cidade: "BRASILIA",
    });
    expect(campos(codigo).get("62")).toBe("0503***");
  });

  test("acento sai do nome e da cidade; o limite de 25 e 15 cabe no payload", () => {
    expect(semAcento("José da Silva")).toBe("Jose da Silva");
    expect(semAcento("São Paulo")).toBe("Sao Paulo");
    const nome = "Ááàâãéêíóôõúüç";
    expect(semAcento(nome).length).toBeLessThanOrEqual(25);
    const codigo = gerarBrCode({
      chave: "11144477735",
      nome: "José da Silva",
      cidade: "São Paulo",
    });
    const mapa = campos(codigo);
    expect(mapa.get("59")).toBe("Jose da Silva");
    expect(mapa.get("60")).toBe("Sao Paulo");
    expect(mapa.get("59")!.length).toBeLessThanOrEqual(25);
    expect(mapa.get("60")!.length).toBeLessThanOrEqual(15);
  });

  test("chave aleatória e e-mail entram em minúsculas", () => {
    const codigo = gerarBrCode({
      chave: "123E4567-E12B-12D1-A456-426655440000",
      nome: "Fulano de Tal",
      cidade: "BRASILIA",
    });
    expect(codigo).toBe(EXEMPLO_BC);
  });
});

describe("chave Pix", () => {
  test("aceita CPF, CNPJ, e-mail, telefone +55 e chave aleatória", () => {
    for (const chave of [
      "11144477735",
      "11222333000181",
      "fulano@example.com",
      "+5511987654321",
      "+551133334444", // ficticio
      "123e4567-e12b-12d1-a456-426655440000",
    ]) {
      expect(mensagemDaChave(chave), chave).toBeNull();
    }
  });

  test("rejeita cada formato com mensagem em português", () => {
    expect(mensagemDaChave("11144477700")).toMatch(/CPF/);
    expect(mensagemDaChave("11222333000180")).toMatch(/CNPJ/);
    expect(mensagemDaChave("nao-e-email")).toMatch(/CPF|CNPJ|e-mail|telefone|aleat/);
    expect(mensagemDaChave("fulano@")).toMatch(/e-mail/);
    expect(mensagemDaChave("11987654321")).toMatch(/telefone|\+55|CPF/);
    expect(mensagemDaChave("+551198765")).toMatch(/telefone|\+55/);
    expect(mensagemDaChave("123e4567e12b12d1a456426655440000")).toMatch(/aleat|CPF|CNPJ|e-mail|telefone/);
    for (const msg of [
      mensagemDaChave("11144477700"),
      mensagemDaChave("fulano@"),
      mensagemDaChave("+551198765"),
    ]) {
      expect(msg).toMatch(/[áàãéêíóôõúç]/i);
    }
  });
});

describe("QR", () => {
  test("SVG no servidor, quadrado, sem script", () => {
    const svg = qrSvg(EXEMPLO_BC);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).not.toMatch(/<script/i);
    const caixa = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
    expect(caixa?.[1]).toBe(caixa?.[2]);
    expect(Number(caixa?.[1])).toBeGreaterThan(20);
  });
});
