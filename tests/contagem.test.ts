import { describe, expect, test } from "vitest";
import { partesRestantes, quandoTermina } from "../lib/contagem";
import { instanteUtc } from "../lib/janela";

describe("contagem regressiva", () => {
  test("o alvo é lido no fuso do site", () => {
    expect(instanteUtc("2026-11-11T00:00", "America/Sao_Paulo")).toBe(Date.parse("2026-11-11T03:00:00Z"));
    expect(instanteUtc("2026-11-11", "America/Sao_Paulo")).toBe(Date.parse("2026-11-11T03:00:00Z"));
    expect(instanteUtc("2026-11-11T18:30", "Europe/Lisbon")).toBe(Date.parse("2026-11-11T18:30:00Z"));
    expect(instanteUtc("lixo", "America/Sao_Paulo")).toBeNull();
  });

  test("quebra o que falta em dias, horas, minutos e segundos; acabou vira null", () => {
    const ms = ((2 * 24 + 3) * 3600 + 4 * 60 + 5) * 1000 + 999;
    expect(partesRestantes(ms)).toEqual({ dias: 2, horas: 3, min: 4, seg: 5 });
    expect(partesRestantes(0)).toBeNull();
    expect(partesRestantes(-1)).toBeNull();
  });

  test("mostra quando termina em texto curto", () => {
    expect(quandoTermina("2026-11-11T18:30")).toBe("11/11/2026 às 18:30");
    expect(quandoTermina("2026-11-11")).toBe("11/11/2026");
  });
});
