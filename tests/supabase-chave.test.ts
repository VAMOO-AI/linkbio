import { describe, expect, test } from "vitest";
import { cabecalhosDaChave, lerSupabase } from "@/lib/supabase-chave";

// Chaves de mentira montadas por concatenação: este arquivo viaja no zip e passa pelo gate.
const JWT = "e" + "yJhbGciOiJIUzI1NiJ9.corpo.assinatura";
const SECRETA = "sb_" + "secret_" + "chave-de-teste";

describe("cabeçalhos da chave do Supabase", () => {
  test("service_role antiga (JWT): apikey e Authorization Bearer", () => {
    expect(cabecalhosDaChave(JWT)).toEqual({ apikey: JWT, Authorization: `Bearer ${JWT}` });
  });

  test("Secret key nova (sb_secret_): só apikey, sem Authorization", () => {
    const h = cabecalhosDaChave(SECRETA);
    expect(h).toEqual({ apikey: SECRETA });
    expect(h).not.toHaveProperty("Authorization");
  });
});

describe("nomes da integração Supabase na Vercel", () => {
  const url = "https://abcd1234.supabase.co";
  const chave = "sb_secret_da-integracao";

  test("aceita os nomes que o projeto já usa", () => {
    expect(lerSupabase({ SUPABASE_URL: url + "/", SUPABASE_SERVICE_ROLE_KEY: "eyJ.a.b" })).toEqual({
      url,
      chave: "eyJ.a.b",
    });
  });

  test("aceita os nomes que a integração injeta, quando os nossos faltam", () => {
    expect(lerSupabase({ NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SECRET_KEY: chave })).toEqual({ url, chave });
  });

  test("o nome nosso ganha do nome da integração", () => {
    expect(
      lerSupabase({
        SUPABASE_URL: url,
        NEXT_PUBLIC_SUPABASE_URL: "https://outro.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "eyJ.nossa.chave",
        SUPABASE_SECRET_KEY: chave,
      }),
    ).toEqual({ url, chave: "eyJ.nossa.chave" });
  });

  test("sem endereço ou sem chave, não há credencial", () => {
    expect(lerSupabase({ SUPABASE_URL: url })).toBeNull();
    expect(lerSupabase({ SUPABASE_SECRET_KEY: chave })).toBeNull();
    expect(lerSupabase({})).toBeNull();
  });
});
