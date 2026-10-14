import { describe, expect, test, vi } from "vitest";
import { estourouPing, gravarPing, lerPing } from "../lib/frota";

const PING = { site: "https://link.exemplo.com", versao: "0.6.2", fonte: "arquivo" as const, motivo: "sem-supabase" as const };

describe("ping da frota", () => {
  test("aceita o corpo enxuto e recusa campo extra, versão torta ou motivo inventado", () => {
    expect(lerPing(PING)).toEqual(PING);
    expect(lerPing({ site: PING.site, versao: PING.versao, fonte: "banco" })).toEqual({
      site: PING.site,
      versao: PING.versao,
      fonte: "banco",
    });
    expect(lerPing({ ...PING, bio: "segredo" })).toBeNull();
    expect(lerPing({ ...PING, versao: "v0.6.2" })).toBeNull();
    expect(lerPing({ ...PING, motivo: "outro" })).toBeNull();
    expect(lerPing({ ...PING, fonte: "banco", motivo: "sem-supabase" })).toBeNull();
  });

  test("30 pings na hora travam o 31º; a hora seguinte libera", () => {
    const balde = new Map<string, number[]>();
    const agora = Date.parse("2026-10-13T12:00:00Z");
    for (let i = 0; i < 30; i++) expect(estourouPing(balde, "1.1.1.1", agora + i)).toBe(false);
    expect(estourouPing(balde, "1.1.1.1", agora + 31)).toBe(true);
    expect(estourouPing(balde, "1.1.1.1", agora + 3_600_001)).toBe(false);
  });

  test("desligado responde 404 e não chama a rede; ligado grava só os campos do ping", async () => {
    const buscar = vi.fn(async () => new Response(null, { status: 201 }));
    expect(await gravarPing({ ligado: false, supabaseUrl: "https://p.supabase.co", chave: "sb_secret_x", ping: PING, fetch: buscar })).toBe(404);
    expect(buscar).not.toHaveBeenCalled();

    expect(await gravarPing({ ligado: true, ping: PING, fetch: buscar })).toBe(503);

    const status = await gravarPing({
      ligado: true,
      supabaseUrl: "https://p.supabase.co/",
      chave: "sb_secret_x",
      ping: PING,
      agora: new Date("2026-10-13T12:00:00Z"),
      fetch: buscar as unknown as typeof fetch,
    });
    expect(status).toBe(204);
    const [endereco, init] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    expect(endereco).toBe("https://p.supabase.co/rest/v1/frota_ping?on_conflict=site");
    expect(JSON.parse(String(init.body))).toEqual({ ...PING, visto_em: "2026-10-13T12:00:00.000Z" });
    expect(String(init.body)).not.toContain("profile");
  });
});
