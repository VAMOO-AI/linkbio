import { describe, expect, it } from "vitest";
import { gravarVariavel, lerVariavel } from "../lib/env-local";

describe("env-local", () => {
  it("lê a última linha da chave (como o Next)", () => {
    expect(lerVariavel("SUPABASE_URL=\nX=1\nSUPABASE_URL=https://a.supabase.co\n", "SUPABASE_URL")).toBe("https://a.supabase.co");
    expect(lerVariavel("X=1\n", "SUPABASE_URL")).toBe("");
    expect(lerVariavel('K="com aspas"\n', "K")).toBe("com aspas");
  });

  it("grava trocando a linha existente e remove duplicadas", () => {
    expect(gravarVariavel("A=1\nS=\nB=2\nS=velho\n", "S", "novo")).toBe("A=1\nS=novo\nB=2\n");
  });

  it("grava no fim quando a chave não existe", () => {
    expect(gravarVariavel("A=1", "S", "x")).toBe("A=1\nS=x\n");
    expect(gravarVariavel("", "S", "x")).toBe("S=x\n");
  });
});

describe("npm run chave", () => {
  it("grava a chave aceita e mostra só o fim", async () => {
    const { gravarChave } = await import("../scripts/chave");
    const token = "a" + "pify_api_" + "Zx9Yw8Vu7Ts6Rq5Po4Nm3";
    const r = gravarChave("APIFY_TOKEN=\nX=1\n", "APIFY_TOKEN", ` "${token}" `);
    expect(r.texto).toBe(`APIFY_TOKEN=${token}\nX=1\n`);
    expect(r.aviso).toMatch(/termina em \.\.\.\w{4}\)/);
    expect(r.aviso).not.toContain(token);
  });

  it("recusa chave desconhecida, token curto e a chave pública do Supabase", async () => {
    const { gravarChave } = await import("../scripts/chave");
    expect(() => gravarChave("", "GITHUB_TOKEN", "x".repeat(30))).toThrow(/desconhecida/);
    expect(() => gravarChave("", "APIFY_TOKEN", "curto")).toThrow(/não parece/);
    expect(() => gravarChave("", "SUPABASE_SERVICE_ROLE_KEY", "sb_" + "publishable_" + "abcdefghijklmnop")).toThrow(/PÚBLICA/);
    expect(() => gravarChave("", "SUPABASE_URL", "https://abc.vercel.app")).toThrow(/supabase\.co/);
    expect(gravarChave("", "SUPABASE_URL", "https://abcd1234.supabase.co").texto).toBe("SUPABASE_URL=https://abcd1234.supabase.co\n");
  });
});
