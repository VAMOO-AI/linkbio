import { describe, expect, test } from "vitest";
import nextConfig from "../next.config";
import { cabecalhosDeSeguranca, origemDoSupabase, pixelsNaPolitica, politicaDeConteudo, type PixelsNaPolitica } from "../lib/seguranca";

const NENHUM: PixelsNaPolitica = { meta: false, ga4: false, clarity: false };
const TODOS: PixelsNaPolitica = { meta: true, ga4: true, clarity: true };

/** Diretiva → lista de origens, para testar sem depender da ordem do texto. */
function diretivas(politica: string): Record<string, string[]> {
  return Object.fromEntries(
    politica.split(";").map((d) => {
      const [nome, ...valores] = d.trim().split(/\s+/);
      return [nome, valores];
    }),
  );
}

describe("cabeçalhos de segurança", () => {
  test("toda rota sai com CSP, proteção contra iframe de outro site, nosniff, referrer e permissões", async () => {
    const regras = (await nextConfig.headers?.()) ?? [];
    const todas = regras.find((r) => r.source === "/:caminho*");
    expect(todas, "regra para todas as rotas").toBeDefined();
    const h = Object.fromEntries(todas!.headers.map((x) => [x.key.toLowerCase(), x.value]));
    expect(h["x-frame-options"]).toBe("SAMEORIGIN");
    expect(diretivas(h["content-security-policy"])["frame-ancestors"]).toEqual(["'self'"]);
    expect(diretivas(h["content-security-policy"])["default-src"]).toEqual(["'self'"]);
    expect(h["content-security-policy-report-only"]).toBeUndefined();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["permissions-policy"]).toContain("camera=()");
    expect(h["permissions-policy"]).toContain("geolocation=()");
  });

  test("cabecalhosDeSeguranca aplica a política (não é Report-Only)", () => {
    const h = cabecalhosDeSeguranca({ pixels: NENHUM, dev: false });
    expect(h.map((x) => x.key)).toContain("Content-Security-Policy");
    expect(h.find((x) => x.key === "Content-Security-Policy")!.value).toBe(politicaDeConteudo({ pixels: NENHUM, dev: false }));
  });
});

describe("política de conteúdo (CSP)", () => {
  test("sem pixel: lista fechada no próprio site, sem terceiros de medição", () => {
    const p = politicaDeConteudo({ pixels: NENHUM, dev: false });
    const d = diretivas(p);
    expect(d["default-src"]).toEqual(["'self'"]);
    expect(d["script-src"]).toEqual(["'self'", "'unsafe-inline'"]);
    expect(d["connect-src"]).toEqual(["'self'"]);
    expect(d["frame-src"]).toEqual(["'self'", "https://www.youtube-nocookie.com"]);
    expect(d["object-src"]).toEqual(["'none'"]);
    expect(d["base-uri"]).toEqual(["'self'"]);
    expect(d["form-action"]).toEqual(["'self'"]);
    expect(d["frame-ancestors"]).toEqual(["'self'"]);
    expect(p).not.toMatch(/facebook|google|clarity|bing/);
  });

  test("imagem aceita qualquer https (o schema aceita URL https em foto, galeria e fundo), data: e blob:", () => {
    expect(diretivas(politicaDeConteudo({ pixels: NENHUM, dev: false }))["img-src"]).toEqual(["'self'", "data:", "blob:", "https:"]);
  });

  test("Supabase em http (só no teste local) entra no img-src; em https o https: já cobre", () => {
    expect(diretivas(politicaDeConteudo({ pixels: NENHUM, dev: false, supabase: "http://127.0.0.1:3155" }))["img-src"]).toContain("http://127.0.0.1:3155");
    expect(diretivas(politicaDeConteudo({ pixels: NENHUM, dev: false, supabase: "https://abc.supabase.co" }))["img-src"]).toEqual(["'self'", "data:", "blob:", "https:"]);
    expect(origemDoSupabase({ SUPABASE_URL: "https://abc.supabase.co/", SUPABASE_SERVICE_ROLE_KEY: "x" })).toBe("https://abc.supabase.co");
    expect(origemDoSupabase({})).toBeNull();
  });

  test("nenhuma diretiva libera tudo (* ou http:)", () => {
    const d = diretivas(politicaDeConteudo({ pixels: TODOS, dev: false }));
    for (const [nome, valores] of Object.entries(d)) {
      expect(valores, nome).not.toContain("*");
      expect(valores, nome).not.toContain("http:");
      if (nome !== "img-src") expect(valores, nome).not.toContain("https:");
    }
  });

  test("Meta: script do connect.facebook.net e coleta em www.facebook.com", () => {
    const d = diretivas(politicaDeConteudo({ pixels: { ...NENHUM, meta: true }, dev: false }));
    expect(d["script-src"]).toContain("https://connect.facebook.net");
    expect(d["connect-src"]).toContain("https://www.facebook.com");
    expect(d["script-src"]).not.toContain("https://www.googletagmanager.com");
  });

  test("GA4: gtag.js do googletagmanager e coleta no google-analytics", () => {
    const d = diretivas(politicaDeConteudo({ pixels: { ...NENHUM, ga4: true }, dev: false }));
    expect(d["script-src"]).toContain("https://www.googletagmanager.com");
    expect(d["connect-src"]).toContain("https://*.google-analytics.com");
    expect(d["connect-src"]).toContain("https://*.analytics.google.com");
    expect(d["script-src"]).not.toContain("https://connect.facebook.net");
  });

  test("Clarity: tag e coleta em *.clarity.ms e c.bing.com", () => {
    const d = diretivas(politicaDeConteudo({ pixels: { ...NENHUM, clarity: true }, dev: false }));
    for (const dir of ["script-src", "connect-src"]) {
      expect(d[dir], dir).toContain("https://*.clarity.ms");
      expect(d[dir], dir).toContain("https://c.bing.com");
    }
  });

  test("origem repetida entre pixels aparece uma vez só", () => {
    const d = diretivas(politicaDeConteudo({ pixels: TODOS, dev: false }));
    for (const [nome, valores] of Object.entries(d)) expect(new Set(valores).size, nome).toBe(valores.length);
  });

  test("eval e WebSocket só no npm run dev", () => {
    const prod = diretivas(politicaDeConteudo({ pixels: NENHUM, dev: false }));
    const dev = diretivas(politicaDeConteudo({ pixels: NENHUM, dev: true }));
    expect(prod["script-src"]).not.toContain("'unsafe-eval'");
    expect(prod["connect-src"]).not.toContain("ws:");
    expect(dev["script-src"]).toContain("'unsafe-eval'");
    expect(dev["connect-src"]).toContain("ws:");
  });
});

describe("pixels que a política libera", () => {
  test("sem painel: só o pixel com ID válido no arquivo ou no ambiente", () => {
    expect(pixelsNaPolitica({ meta: null, ga4: null, clarity: null }, {})).toEqual(NENHUM);
    expect(pixelsNaPolitica({ meta: "123456789012345", ga4: null, clarity: null }, {})).toEqual({ ...NENHUM, meta: true });
    expect(pixelsNaPolitica({ meta: null, ga4: null, clarity: null }, { GA4_MEASUREMENT_ID: "G-AB12CD34" })).toEqual({ ...NENHUM, ga4: true });
    expect(pixelsNaPolitica({ meta: null, ga4: null, clarity: null }, { GA4_MEASUREMENT_ID: "invalido" })).toEqual(NENHUM);
  });

  test("painel ligado: os três, porque o /admin liga um pixel sem novo build", () => {
    const env = { SUPABASE_URL: "https://abcdefghijklmnop.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "sb_secret_teste" };
    expect(pixelsNaPolitica({ meta: null, ga4: null, clarity: null }, env)).toEqual(TODOS);
  });
});

describe("zod sem eval", () => {
  test("ninguém importa \"zod\" direto: o z vem de lib/zod.ts, que desliga o new Function", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const achados = ["app", "lib", "blocks", "config"]
      .flatMap((pasta) => readdirSync(pasta, { recursive: true, encoding: "utf8" }).map((f) => `${pasta}/${f}`))
      .filter((f) => /\.tsx?$/.test(f) && /from ["']zod["']/.test(readFileSync(f, "utf8")));
    expect(achados).toEqual(["lib/zod.ts"]);
  });
});
