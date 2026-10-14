import { describe, expect, test } from "vitest";
import { campoVisivel } from "../config/schema";
import { blocosAtivos } from "../lib/blocos";
import {
  dentroDaJanela,
  resumoDaJanela,
  segundosAteProximaFronteira,
  seloDaJanela,
} from "../lib/janela";

const SP = "America/Sao_Paulo";

describe("campoVisivel", () => {
  test("aceita data, hora e objeto vazio; rejeita o que não existe", () => {
    const campo = campoVisivel("bloco lead");
    expect(campo.safeParse(undefined).success).toBe(true);
    expect(campo.safeParse({}).success).toBe(true);
    expect(campo.safeParse({ de: "2026-10-13", ate: "2026-10-13T18:00" }).success).toBe(true);
    expect(campo.safeParse({ de: "2026-02-30" }).success).toBe(false);
    expect(campo.safeParse({ ate: "2026-10-13T15:60" }).success).toBe(false);
    const invertido = campo.safeParse({ de: "2026-10-14T00:00", ate: "2026-10-13" });
    expect(invertido.success).toBe(false);
    if (!invertido.success) expect(invertido.error.issues[0]?.message).toMatch(/bloco lead/);
  });
});

describe("janela no fuso da bio", () => {
  test("ate sem hora inclui o dia inteiro e vira na meia-noite de São Paulo", () => {
    const ate = { ate: "2026-10-13" };
    // 13/10 23:59 em São Paulo (UTC-3).
    expect(dentroDaJanela(ate, new Date("2026-10-14T02:59:00.000Z"), SP)).toBe(true);
    // 14/10 00:00 em São Paulo.
    expect(dentroDaJanela(ate, new Date("2026-10-14T03:00:00.000Z"), SP)).toBe(false);
  });

  test("de sem hora começa à meia-noite local, não em UTC", () => {
    const de = { de: "2026-10-14" };
    // 13/10 23:59 em Tóquio (UTC+9) ainda é o dia anterior.
    expect(dentroDaJanela(de, new Date("2026-10-13T14:59:00.000Z"), "Asia/Tokyo")).toBe(false);
    // 14/10 00:00 em Tóquio.
    expect(dentroDaJanela(de, new Date("2026-10-13T15:00:00.000Z"), "Asia/Tokyo")).toBe(true);
  });

  test("ate com hora inclui aquele minuto e exclui o seguinte", () => {
    const ate = { ate: "2026-10-13T15:00" };
    expect(dentroDaJanela(ate, new Date("2026-10-13T18:00:30.000Z"), SP)).toBe(true);
    expect(dentroDaJanela(ate, new Date("2026-10-13T18:01:00.000Z"), SP)).toBe(false);
  });

  test("selo e resumo dizem quando o bloco está fora", () => {
    const agora = new Date("2026-10-13T15:00:00.000Z"); // 13/10 12:00 em São Paulo
    expect(seloDaJanela({ de: "2026-10-20" }, agora, SP)).toBe("Fora do ar até 20/10");
    expect(resumoDaJanela({ de: "2026-10-20" }, agora, SP)).toBe("Programado");
    expect(seloDaJanela({ ate: "2026-10-01" }, agora, SP)).toBe("Saiu do ar em 01/10");
    expect(resumoDaJanela({ ate: "2026-10-01" }, agora, SP)).toBe("Expirado");
    expect(seloDaJanela({ de: "2026-10-01", ate: "2026-10-31" }, agora, SP)).toBeNull();
  });
});

describe("blocosAtivos com janela", () => {
  const agora = new Date("2026-10-13T15:00:00.000Z");

  test("tira enabled false e quem está fora da janela, na ordem", () => {
    const blocos = [
      { id: "a" },
      { id: "b", enabled: false },
      { id: "c", visivel: { de: "2099-01-01" } },
      { id: "d", visivel: { ate: "2020-01-01" } },
      { id: "e", visivel: { de: "2026-10-01", ate: "2026-10-13T12:00" } },
      { id: "f", enabled: true },
    ];
    expect(blocosAtivos(blocos, agora, SP).map((b) => b.id)).toEqual(["a", "e", "f"]);
  });

  test("sem janela futura, não há o que revalidar", () => {
    expect(segundosAteProximaFronteira([{ visivel: { ate: "2020-01-01" } }], agora, SP)).toBeNull();
    const segundos = segundosAteProximaFronteira([{ visivel: { de: "2026-10-14" } }], agora, SP);
    // 14/10 00:00 em São Paulo = 14/10 03:00 UTC. Agora é 13/10 15:00 UTC → 12 horas.
    expect(segundos).toBe(12 * 60 * 60);
  });
});
