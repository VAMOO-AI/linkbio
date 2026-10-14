import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

/**
 * GET /api/saude contra o Supabase falso (e2e/painel-servidor.ts).
 * Outros testes do chromium publicam em paralelo, então a origem pode ser banco ou arquivo:
 * o contrato é o formato, a versão do package.json e a ausência de cache e de dado sensível.
 */
const versao = (JSON.parse(readFileSync("package.json", "utf8")) as { version: string }).version;
const CHAVES = ["fonte", "motivo", "ok", "ultimaPublicacao", "versao"];

test("saude devolve versão e origem, sem cache e sem dado da bio", async ({ request }) => {
  const resp = await request.get("/api/saude");
  expect(resp.status()).toBe(200);
  expect(resp.headers()["cache-control"] ?? "").toContain("no-store");
  const corpo = (await resp.json()) as Record<string, unknown>;
  expect(corpo.versao).toBe(versao);
  expect(["banco", "arquivo"]).toContain(corpo.fonte);
  if (corpo.fonte === "arquivo") {
    expect(["sem-supabase", "sem-versao", "versao-invalida", "erro-banco"]).toContain(corpo.motivo);
  } else {
    expect(corpo.motivo).toBeUndefined();
    expect(typeof corpo.ultimaPublicacao).toBe("string");
  }
  expect(typeof corpo.ok).toBe("boolean");
  expect(Object.keys(corpo).every((chave) => CHAVES.includes(chave))).toBe(true);
  const texto = JSON.stringify(corpo);
  expect(texto).not.toMatch(/Marina|chave-do-supabase|password|service_role/i);
});
