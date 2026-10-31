import { describe, expect, test } from "vitest";
import nextConfig from "../next.config";

describe("cabeçalhos de segurança", () => {
  test("toda rota sai com proteção contra iframe de outro site, nosniff, referrer e permissões", async () => {
    const regras = (await nextConfig.headers?.()) ?? [];
    const todas = regras.find((r) => r.source === "/:caminho*");
    expect(todas, "regra para todas as rotas").toBeDefined();
    const h = Object.fromEntries(todas!.headers.map((x) => [x.key.toLowerCase(), x.value]));
    expect(h["x-frame-options"]).toBe("SAMEORIGIN");
    expect(h["content-security-policy"]).toBe("frame-ancestors 'self'");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["permissions-policy"]).toContain("camera=()");
    expect(h["permissions-policy"]).toContain("geolocation=()");
  });
});
