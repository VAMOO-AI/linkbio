import { expect, test } from "@playwright/test";

/** Cabeçalhos de segurança na bio e no painel (next.config.ts). */
for (const caminho of ["/", "/admin"]) {
  test(`${caminho} não abre em iframe de outro site e manda nosniff`, async ({ request }) => {
    const r = await request.get(caminho, { maxRedirects: 0 });
    const h = r.headers();
    expect(h["x-frame-options"]).toBe("SAMEORIGIN");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'self'");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });
}
