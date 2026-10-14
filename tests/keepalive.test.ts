import { describe, expect, test, vi } from "vitest";
import { executarKeepalive } from "@/lib/keepalive";

const URL_SB = "https://projeto-de-teste.supabase.co";
const CHAVE = "chave-de-teste";
const AGORA = new Date("2026-09-30T12:00:00.000Z");
const agora = () => AGORA;

describe("keep-alive do Supabase", () => {
  test("sem Supabase configurado: 200 e skipped, sem chamar a rede", async () => {
    const buscar = vi.fn();
    const r = await executarKeepalive({ fetch: buscar as unknown as typeof fetch });
    expect(r).toEqual({ status: 200, corpo: { ok: true, skipped: "supabase-off" } });
    expect(buscar).not.toHaveBeenCalled();
  });

  test("CRON_SECRET definido e Authorization errado ou ausente: 401, sem chamar a rede", async () => {
    const buscar = vi.fn();
    for (const authorization of ["Bearer outro", null, "segredo"]) {
      const r = await executarKeepalive({ supabaseUrl: URL_SB, chave: CHAVE, cronSecret: "segredo", authorization, fetch: buscar as unknown as typeof fetch });
      expect(r.status, String(authorization)).toBe(401);
    }
    expect(buscar).not.toHaveBeenCalled();
  });

  test("ok: faz upsert na linha 1 e devolve o horário", async () => {
    const buscar = vi.fn(async () => new Response(null, { status: 201 }));
    const r = await executarKeepalive({
      supabaseUrl: `${URL_SB}/`,
      chave: CHAVE,
      cronSecret: "segredo",
      authorization: "Bearer segredo",
      fetch: buscar as unknown as typeof fetch,
      agora,
    });
    expect(r).toEqual({ status: 200, corpo: { ok: true, pinged_at: AGORA.toISOString() } });
    expect(buscar).toHaveBeenCalledTimes(1);
    const [endereco, init] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    expect(endereco).toBe(`${URL_SB}/rest/v1/keepalive?on_conflict=id`);
    expect(init.method).toBe("POST");
    const h = init.headers as Record<string, string>;
    expect(h.apikey).toBe(CHAVE);
    expect(h.Prefer).toContain("resolution=merge-duplicates");
    expect(JSON.parse(String(init.body))).toEqual({ id: 1, pinged_at: AGORA.toISOString() });
  });

  test("sem CRON_SECRET: aceita sem Authorization (a operação só grava um horário)", async () => {
    const buscar = vi.fn(async () => new Response(null, { status: 201 }));
    const r = await executarKeepalive({ supabaseUrl: URL_SB, chave: CHAVE, fetch: buscar as unknown as typeof fetch, agora });
    expect(r.status).toBe(200);
    expect(buscar).toHaveBeenCalledTimes(1);
  });

  test("tabela ausente (migration não aplicada): 500 pedindo a migration 0003", async () => {
    const buscar = vi.fn(async () =>
      new Response(JSON.stringify({ code: "PGRST205", message: "Could not find the table 'public.keepalive' in the schema cache" }), { status: 404 }),
    );
    const r = await executarKeepalive({ supabaseUrl: URL_SB, chave: CHAVE, fetch: buscar as unknown as typeof fetch, agora });
    expect(r.status).toBe(500);
    expect(String(r.corpo.erro)).toContain("0003_keepalive.sql");
  });

  test("banco fora do ar: 502 com mensagem, sem estourar exceção", async () => {
    const buscar = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    const r = await executarKeepalive({ supabaseUrl: URL_SB, chave: CHAVE, fetch: buscar as unknown as typeof fetch });
    expect(r.status).toBe(502);
    expect(r.corpo.ok).toBe(false);
  });
});
