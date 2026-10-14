import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, test, vi } from "vitest";
import exemplo from "./fixtures/config-exemplo";
import { enviarPingVersao, pingAposKeepalive } from "@/lib/ping-versao";

const CORPO = { site: "https://link.exemplo.com", versao: "0.5.1", fonte: "arquivo" as const, motivo: "sem-supabase" as const };

describe("ping de versão", () => {
  test("URL vazia: não chama a rede", async () => {
    const buscar = vi.fn();
    await enviarPingVersao({ pingUrl: "  ", corpo: CORPO, fetch: buscar as unknown as typeof fetch });
    expect(buscar).not.toHaveBeenCalled();
  });

  test("POST só com site, versão, fonte e motivo", async () => {
    const buscar = vi.fn(async () => new Response(null, { status: 204 }));
    await enviarPingVersao({
      pingUrl: "https://ping.exemplo.com/versao",
      corpo: { ...CORPO, extra: "nao-vai" } as typeof CORPO,
      fetch: buscar as unknown as typeof fetch,
    });
    expect(buscar).toHaveBeenCalledTimes(1);
    const [endereco, init] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    expect(endereco).toBe("https://ping.exemplo.com/versao");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual(CORPO);
    expect(String(init.body)).not.toContain("nao-vai");
    expect(String(init.body)).not.toContain(exemplo.profile.bio);
  });

  test("falha e timeout não estouram", async () => {
    const buscar = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    await expect(enviarPingVersao({ pingUrl: "https://ping.exemplo.com", corpo: CORPO, fetch: buscar as unknown as typeof fetch })).resolves.toBeUndefined();

    const servidor = createServer(() => {
      // não responde: o timeout curto precisa desistir
    });
    await new Promise<void>((resolve) => servidor.listen(0, "127.0.0.1", resolve));
    const porta = (servidor.address() as AddressInfo).port;
    const inicio = Date.now();
    await enviarPingVersao({ pingUrl: `http://127.0.0.1:${porta}/`, corpo: CORPO, timeoutMs: 400 });
    expect(Date.now() - inicio).toBeLessThan(2000);
    servidor.close();
  });

  test("keepalive não autorizado não dispara o ping", async () => {
    const buscar = vi.fn();
    await pingAposKeepalive({
      statusKeepalive: 401,
      pingUrl: "https://ping.exemplo.com",
      arquivo: exemplo,
      versao: "0.5.1",
      fetch: buscar as unknown as typeof fetch,
    });
    expect(buscar).not.toHaveBeenCalled();
  });

  test("ping ligado depois do keepalive: o POST sai e uma falha não muda o resultado da cron", async () => {
    let pedidos = 0;
    const buscar = vi.fn(async (endereco: string) => {
      pedidos += 1;
      if (String(endereco).includes("site_config")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      throw new Error("ping fora");
    });
    const resultadoCron = { status: 200, corpo: { ok: true, pinged_at: "2026-10-13T00:00:00.000Z" } };
    await expect(
      pingAposKeepalive({
        statusKeepalive: resultadoCron.status,
        pingUrl: "https://ping.exemplo.com/v",
        supabaseUrl: "https://projeto.supabase.co",
        chave: "chave-de-teste",
        arquivo: exemplo,
        versao: "0.5.1",
        fetch: buscar as unknown as typeof fetch,
      }),
    ).resolves.toBeUndefined();
    expect(resultadoCron).toEqual({ status: 200, corpo: { ok: true, pinged_at: "2026-10-13T00:00:00.000Z" } });
    expect(pedidos).toBe(2);
    const corpo = JSON.parse(String((buscar.mock.calls[1] as unknown as [string, RequestInit])[1].body));
    expect(corpo).toEqual({ site: exemplo.site.url, versao: "0.5.1", fonte: "arquivo", motivo: "sem-versao" });
  });
});
