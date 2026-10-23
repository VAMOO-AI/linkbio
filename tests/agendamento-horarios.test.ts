import { describe, expect, test } from "vitest";
import {
  calcularHorarios,
  chaveDoDia,
  contarPorDia,
  dentroDaRegra,
  paredeParaUtc,
  type Regra,
} from "@/lib/agendamento/horarios";

const TZ = "America/Sao_Paulo";
// Segunda, 26/10/2026, 08:00 em Brasília (11:00 UTC).
const AGORA = Date.parse("2026-10-26T11:00:00Z");

const REGRA: Regra = {
  tz: TZ,
  dias: [1, 2, 3, 4, 5],
  inicio: 9 * 60,
  fim: 18 * 60,
  pausas: [{ inicio: 12 * 60, fim: 13 * 60 }],
  antecedenciaMin: 0,
  janelaDias: 14,
  intervaloMin: 0,
  passoMin: 30,
  maxPorDia: null,
};

const doDia = (dia: string, opts: Partial<Parameters<typeof calcularHorarios>[0]> = {}) =>
  calcularHorarios({ regra: REGRA, duracaoMin: 30, ocupado: [], agora: AGORA, ...opts })
    .filter((h) => h.dia === dia)
    .map((h) => h.hora);

describe("paredeParaUtc", () => {
  test("Brasília é UTC-3", () => {
    expect(new Date(paredeParaUtc(2026, 10, 26, 9 * 60, TZ)).toISOString()).toBe("2026-10-26T12:00:00.000Z");
  });

  test("fuso com horário de verão (Lisboa, inverno e verão)", () => {
    expect(new Date(paredeParaUtc(2026, 1, 15, 9 * 60, "Europe/Lisbon")).toISOString()).toBe("2026-01-15T09:00:00.000Z");
    expect(new Date(paredeParaUtc(2026, 7, 15, 9 * 60, "Europe/Lisbon")).toISOString()).toBe("2026-07-15T08:00:00.000Z");
  });

  test("chave do dia segue o fuso, não o UTC", () => {
    // 02:00 UTC do dia 27 ainda é dia 26 em Brasília.
    expect(chaveDoDia(Date.parse("2026-10-27T02:00:00Z"), TZ)).toBe("2026-10-26");
  });
});

describe("calcularHorarios", () => {
  test("expediente de 9h às 18h em passos de 30 min, sem a pausa do almoço", () => {
    expect(doDia("2026-10-27")).toEqual([
      "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
      "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
    ]);
  });

  test("serviço de 60 min não termina depois do expediente nem atravessa a pausa", () => {
    const horas = doDia("2026-10-27", { duracaoMin: 60 });
    expect(horas).not.toContain("11:30");
    expect(horas).not.toContain("17:30");
    expect(horas).toContain("17:00");
  });

  test("fim de semana fica fechado", () => {
    expect(doDia("2026-10-31")).toEqual([]);
    expect(doDia("2026-11-01")).toEqual([]);
  });

  test("ocupado do Google some da lista", () => {
    const ocupado = [{ inicioMs: Date.parse("2026-10-27T13:00:00Z"), fimMs: Date.parse("2026-10-27T14:00:00Z") }];
    const horas = doDia("2026-10-27", { ocupado });
    expect(horas).not.toContain("10:00");
    expect(horas).not.toContain("10:30");
    expect(horas).toContain("09:30");
    expect(horas).toContain("11:00");
  });

  test("intervalo afasta o horário do compromisso", () => {
    const ocupado = [{ inicioMs: Date.parse("2026-10-27T13:00:00Z"), fimMs: Date.parse("2026-10-27T14:00:00Z") }];
    const horas = calcularHorarios({ regra: { ...REGRA, intervaloMin: 15 }, duracaoMin: 30, ocupado, agora: AGORA })
      .filter((h) => h.dia === "2026-10-27")
      .map((h) => h.hora);
    expect(horas).not.toContain("09:30");
    expect(horas).not.toContain("11:00");
    expect(horas).toContain("09:00");
    expect(horas).toContain("11:30");
  });

  test("antecedência mínima esconde o que está perto demais", () => {
    const horas = calcularHorarios({ regra: { ...REGRA, antecedenciaMin: 12 * 60 }, duracaoMin: 30, ocupado: [], agora: AGORA });
    // agora + 12 h = 20:00 de segunda: nada na segunda, terça começa às 9h.
    expect(horas.some((h) => h.dia === "2026-10-26")).toBe(false);
    expect(horas[0]?.dia).toBe("2026-10-27");
    expect(horas[0]?.hora).toBe("09:00");
  });

  test("janela limita os dias à frente", () => {
    const horas = calcularHorarios({ regra: { ...REGRA, janelaDias: 2 }, duracaoMin: 30, ocupado: [], agora: AGORA });
    expect([...new Set(horas.map((h) => h.dia))]).toEqual(["2026-10-26", "2026-10-27", "2026-10-28"]);
  });

  test("teto por dia fecha o dia inteiro", () => {
    const horas = calcularHorarios({
      regra: { ...REGRA, maxPorDia: 2 },
      duracaoMin: 30,
      ocupado: [],
      agora: AGORA,
      porDia: { "2026-10-27": 2 },
    });
    expect(horas.some((h) => h.dia === "2026-10-27")).toBe(false);
    expect(horas.some((h) => h.dia === "2026-10-28")).toBe(true);
  });

  test("passo de 15 min dobra os horários", () => {
    const de30 = doDia("2026-10-27").length;
    const de15 = calcularHorarios({ regra: { ...REGRA, passoMin: 15 }, duracaoMin: 30, ocupado: [], agora: AGORA }).filter(
      (h) => h.dia === "2026-10-27",
    ).length;
    expect(de15).toBeGreaterThan(de30 * 1.8);
  });

  test("duração inválida não gera horário", () => {
    expect(calcularHorarios({ regra: REGRA, duracaoMin: 0, ocupado: [], agora: AGORA })).toEqual([]);
  });
});

describe("dentroDaRegra", () => {
  const terca9h = Date.parse("2026-10-27T12:00:00Z");

  test("aceita horário da grade", () => {
    expect(dentroDaRegra({ regra: REGRA, inicioMs: terca9h, duracaoMin: 30, agora: AGORA })).toBe(true);
  });

  test("recusa horário fora da grade (09:17)", () => {
    expect(dentroDaRegra({ regra: REGRA, inicioMs: terca9h + 17 * 60_000, duracaoMin: 30, agora: AGORA })).toBe(false);
  });

  test("recusa horário na pausa, no fim de semana e fora do expediente", () => {
    expect(dentroDaRegra({ regra: REGRA, inicioMs: Date.parse("2026-10-27T15:00:00Z"), duracaoMin: 30, agora: AGORA })).toBe(false);
    expect(dentroDaRegra({ regra: REGRA, inicioMs: Date.parse("2026-10-31T12:00:00Z"), duracaoMin: 30, agora: AGORA })).toBe(false);
    expect(dentroDaRegra({ regra: REGRA, inicioMs: Date.parse("2026-10-27T21:00:00Z"), duracaoMin: 30, agora: AGORA })).toBe(false);
  });

  test("recusa horário além da janela e dentro da antecedência", () => {
    expect(dentroDaRegra({ regra: REGRA, inicioMs: Date.parse("2026-12-01T12:00:00Z"), duracaoMin: 30, agora: AGORA })).toBe(false);
    // Terça 9h fica 25 h depois de agora.
    const regra = { ...REGRA, antecedenciaMin: 26 * 60 };
    expect(dentroDaRegra({ regra, inicioMs: terca9h, duracaoMin: 30, agora: AGORA })).toBe(false);
  });

  test("ignora o teto diário (quem confere o teto é a reserva)", () => {
    expect(dentroDaRegra({ regra: { ...REGRA, maxPorDia: 1 }, inicioMs: terca9h, duracaoMin: 30, agora: AGORA })).toBe(true);
  });
});

test("contarPorDia agrupa no fuso", () => {
  expect(
    contarPorDia(["2026-10-27T12:00:00Z", "2026-10-27T20:00:00Z", "2026-10-28T02:00:00Z", "lixo"], TZ),
  ).toEqual({ "2026-10-27": 3 });
});
