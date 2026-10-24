import { beforeEach, describe, expect, test, vi } from "vitest";

/** Banco que ainda não rodou a 0010: o lead e a reserva entram sem a origem, em vez de se perder. */

const chamadas: { caminho: string; corpo: Record<string, unknown> }[] = [];
let semColuna = true;

vi.mock("server-only", () => ({}));
vi.mock("../lib/supabase", () => ({
  supabaseConfigurado: () => true,
  rest: async (caminho: string, init: { body?: string }) => {
    const corpo = JSON.parse(init.body ?? "{}") as Record<string, unknown>;
    chamadas.push({ caminho, corpo });
    if (semColuna && "origem" in corpo) {
      throw new Error(`Supabase 400 em ${caminho.split("?")[0]}: {"code":"PGRST204","message":"Could not find the 'origem' column of '${caminho.split("?")[0]}' in the schema cache"}`);
    }
    return [{ id: "r1" }];
  },
}));

const { gravarLead } = await import("../lib/lead-banco");
const { inserirReserva } = await import("../lib/agendamento/banco");

const lead = { bloco: "b", nome: "Ana", whatsapp: "11987654321", email: null, entrega: null, ip_hash: "h", origem: "stories", utm: { utm_campaign: "x" } };
const reserva = {
  request_id: "p1",
  bloco: "agenda",
  servico: "consulta",
  inicio: "2026-10-27T12:00:00.000Z",
  fim: "2026-10-27T12:30:00.000Z",
  nome: "Ana",
  whatsapp: "11987654321",
  email: null,
  ip_hash: "h",
  origem: "bio",
  utm: null,
};

beforeEach(() => {
  chamadas.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("gravação com e sem as colunas de origem", () => {
  test("sem a coluna: tenta com a origem e grava de novo sem ela", async () => {
    semColuna = true;
    await gravarLead(lead);
    expect(chamadas).toHaveLength(2);
    expect(chamadas[1]!.corpo).not.toHaveProperty("origem");
    expect(chamadas[1]!.corpo).toMatchObject({ nome: "Ana" });
    expect(await inserirReserva(reserva)).toEqual({ ok: true, id: "r1" });
    expect(chamadas[3]!.corpo).not.toHaveProperty("utm");
  });

  test("com a coluna: uma gravação só, com a origem", async () => {
    semColuna = false;
    await gravarLead(lead);
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]!.corpo).toMatchObject({ origem: "stories", utm: { utm_campaign: "x" } });
  });
});
