import { describe, expect, test } from "vitest";
import { conferirSenha, criarToken, hashSenha, lerToken, senhaAleatoria } from "../lib/admin/cripto";

const SEGREDO = "s".repeat(48);

describe("/admin: senha", () => {
  test("hash confere a senha certa e recusa a errada", async () => {
    const h = await hashSenha("senha-muito-boa");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await conferirSenha("senha-muito-boa", h)).toBe(true);
    expect(await conferirSenha("senha-muito-boX", h)).toBe(false);
  });

  test("duas vezes a mesma senha geram hashes diferentes (sal)", async () => {
    expect(await hashSenha("mesma-senha-123")).not.toBe(await hashSenha("mesma-senha-123"));
  });

  test("senha curta é recusada; hash malformado não confere", async () => {
    await expect(hashSenha("curta")).rejects.toThrow(/ao menos 10/);
    expect(await conferirSenha("qualquer", "md5$abc")).toBe(false);
  });

  test("senha aleatória tem 16 caracteres sem ambíguos", () => {
    const s = senhaAleatoria();
    expect(s).toHaveLength(16);
    expect(s).not.toMatch(/[0O1lI]/);
  });
});

describe("/admin: sessão", () => {
  test("token válido devolve o e-mail", () => {
    expect(lerToken(criarToken("dono@exemplo.com", SEGREDO, 3600), SEGREDO)).toBe("dono@exemplo.com");
  });

  test("token vencido, adulterado ou com outro segredo é recusado", () => {
    const t = criarToken("dono@exemplo.com", SEGREDO, 60, 0);
    expect(lerToken(t, SEGREDO, 61_000)).toBeNull();
    const valido = criarToken("dono@exemplo.com", SEGREDO, 3600);
    const [dados, sig] = valido.split(".");
    const outro = Buffer.from(JSON.stringify({ e: "intruso@x.com", x: 9_999_999_999 })).toString("base64url");
    expect(lerToken(`${outro}.${sig}`, SEGREDO)).toBeNull();
    expect(lerToken(`${dados}.${sig}`, "o".repeat(48))).toBeNull();
    expect(lerToken(undefined, SEGREDO)).toBeNull();
    expect(lerToken("lixo", SEGREDO)).toBeNull();
  });
});
