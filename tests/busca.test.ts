import { describe, expect, test } from "vitest";
import { ConfigSchema } from "../config/schema";
import { metadadosDeBusca } from "../lib/seo";
import { codigoDeVerificacao } from "../lib/verificacao";
import configExemplo from "./fixtures/config-exemplo";

/** Canonical e verificação do Google Search Console e do Bing (v0.8.0). */

const GOOGLE = "abcDEF123_-ghiJKL456mnoPQR789stuVWX0yz12";
const BING = "0123456789ABCDEF0123456789ABCDEF";

function com(verificacao: unknown) {
  const cfg = structuredClone(configExemplo) as Record<string, any>;
  cfg.site = { ...cfg.site, verificacao };
  return cfg;
}

describe("código de verificação", () => {
  test("aceita o código puro ou a meta tag inteira colada do Google e do Bing", () => {
    expect(codigoDeVerificacao(GOOGLE)).toBe(GOOGLE);
    expect(codigoDeVerificacao(`  ${GOOGLE}  `)).toBe(GOOGLE);
    expect(codigoDeVerificacao(`<meta name="google-site-verification" content="${GOOGLE}" />`)).toBe(GOOGLE);
    expect(codigoDeVerificacao(`<meta name='msvalidate.01' content='${BING}'>`)).toBe(BING);
    expect(codigoDeVerificacao("")).toBeNull();
    expect(codigoDeVerificacao(null)).toBeNull();
  });

  test("o schema guarda só o código e trata vazio como desligado", () => {
    const ok = ConfigSchema.parse(com({ google: `<meta name="google-site-verification" content="${GOOGLE}" />`, bing: BING }));
    expect(ok.site.verificacao).toEqual({ google: GOOGLE, bing: BING });
    const vazio = ConfigSchema.parse(com({ google: " ", bing: "" }));
    expect(vazio.site.verificacao).toEqual({ google: null, bing: null });
    expect(ConfigSchema.parse(configExemplo).site.verificacao).toBeUndefined();
  });

  test("código fora do formato quebra com a mensagem do campo", () => {
    const r1 = ConfigSchema.safeParse(com({ google: "curto" }));
    expect(r1.success).toBe(false);
    expect(JSON.stringify(r1.error?.issues)).toMatch(/Search Console/);
    const r2 = ConfigSchema.safeParse(com({ bing: "nao-e-hex-nao-e-hex-nao-e-hex-00" }));
    expect(r2.success).toBe(false);
    expect(JSON.stringify(r2.error?.issues)).toMatch(/Bing/);
  });
});

describe("metadados de busca", () => {
  const base = new URL("https://bio.exemplo.com");

  test("canonical aponta a home do endereço base, sem barra a mais", () => {
    expect(metadadosDeBusca({}, base).alternates).toEqual({ canonical: "https://bio.exemplo.com/" });
  });

  test("sem código, nenhuma meta de verificação", () => {
    expect(metadadosDeBusca({}, base).verification).toBeUndefined();
    expect(metadadosDeBusca({ verificacao: { google: null, bing: null } }, base).verification).toBeUndefined();
  });

  test("com códigos, gera google-site-verification e msvalidate.01", () => {
    expect(metadadosDeBusca({ verificacao: { google: GOOGLE, bing: BING } }, base).verification).toEqual({
      google: GOOGLE,
      other: { "msvalidate.01": BING },
    });
    expect(metadadosDeBusca({ verificacao: { google: null, bing: BING } }, base).verification).toEqual({
      other: { "msvalidate.01": BING },
    });
  });
});
