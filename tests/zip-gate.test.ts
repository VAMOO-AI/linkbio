import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";

// Números montados por concatenação: este arquivo viaja no zip e passa pelo gate.
const REAL = "55" + "47" + "912345678";
const FICTICIO = "55" + "11" + "987654321";

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

function gate(arquivos: Record<string, string>): { ok: boolean; saida: string } {
  const dir = mkdtempSync(join(tmpdir(), "gate-"));
  dirs.push(dir);
  for (const [nome, conteudo] of Object.entries(arquivos)) writeFileSync(join(dir, nome), conteudo);
  try {
    const saida = execFileSync("bash", ["scripts/zip-gate.sh", dir], { encoding: "utf8" });
    return { ok: true, saida };
  } catch (e) {
    return { ok: false, saida: String((e as { stdout?: string }).stdout) };
  }
}

describe("zip-gate.sh", () => {
  test("aprova config com o número fictício", () => {
    expect(gate({ "linkbio.config.ts": `contact: { whatsapp: "${FICTICIO}" }` }).ok).toBe(true);
  });

  test("reprova número real em link wa.me", () => {
    expect(gate({ "a.ts": `href="https://wa.me/${REAL}"` }).ok).toBe(false);
  });

  test("reprova número real no campo contact.whatsapp da config", () => {
    const r = gate({ "linkbio.config.ts": `contact: { whatsapp: "${REAL}" }` });
    expect(r.ok).toBe(false);
    expect(r.saida).toContain("linkbio.config.ts");
  });

  test("CSS com mask-image e palavras com as mesmas letras passam (sem falso positivo)", () => {
    const css = ".x { -webkit-" + "mask-image: none; mask-image: linear-gradient(#000, transparent); } /* desk-top risk-free */";
    expect(gate({ "globals.css": css }).ok).toBe(true);
  });

  test("reprova chave com formato de verdade e token JWT", () => {
    const chave = "s" + "k-" + "ant-api03-" + "a1B2c3D4e5F6g7H8i9J0";
    const jwt = "e" + "yJhbGciOiJIUzI1NiJ9" + ".e" + "yJyb2xlIjoic2VydmljZSJ9.abc";
    const r1 = gate({ "a.ts": `const k = "${chave}";` });
    expect(r1.ok).toBe(false);
    expect(r1.saida).toContain("cara de chave");
    expect(gate({ "b.ts": `const t = "${jwt}";` }).ok).toBe(false);
  });

  test("reprova token da Apify e a pasta analise/ do onboarding", () => {
    const token = "a" + "pify_api_" + "Ab12Cd34Ef56Gh78Ij90Kl";
    const r = gate({ ".env.example": `APIFY_TOKEN=${token}` });
    expect(r.ok).toBe(false);
    expect(r.saida).toContain("cara de chave");
    expect(gate({ ".env.example": "APIFY_TOKEN=" }).ok).toBe(true);
    expect(gate({ ".env.example": "APIFY_TOKEN=" + "tokenAntigoSemPrefixo123" }).ok).toBe(false);
    const dir = mkdtempSync(join(tmpdir(), "gate-"));
    dirs.push(dir);
    mkdirSync(join(dir, "analise"));
    writeFileSync(join(dir, "analise", "instagram.json"), "{}");
    let saida = "";
    try {
      execFileSync("bash", ["scripts/zip-gate.sh", dir], { encoding: "utf8" });
    } catch (e) {
      saida = String((e as { stdout?: string }).stdout);
    }
    expect(saida).toContain("analise");
  });

  test("reprova celular real escrito à mão, com ou sem 55; aprova o fictício formatado", () => {
    const ddd = "4" + "7";
    for (const tel of [`+55 (${ddd}) 99923-0173`, `(${ddd}) 99923 0173`, `${ddd}999230173`]) {
      expect(gate({ "a.md": `Fale comigo: ${tel}` }).ok, tel).toBe(false);
    }
    expect(gate({ "a.md": "Exemplo: +55 (11) 98765-4321" }).ok).toBe(true);
  });

  test("marca só é permitida no README.md da raiz, não em docs/README.md", () => {
    const marca = "Va" + "moo";
    const dir = mkdtempSync(join(tmpdir(), "gate-"));
    dirs.push(dir);
    mkdirSync(join(dir, "docs"));
    writeFileSync(join(dir, "README.md"), `Créditos: ${marca}`);
    writeFileSync(join(dir, "docs", "README.md"), `Feito pela ${marca}`);
    let saida = "";
    try {
      execFileSync("bash", ["scripts/zip-gate.sh", dir], { encoding: "utf8" });
    } catch (e) {
      saida = String((e as { stdout?: string }).stdout);
    }
    expect(saida).toContain("docs/README.md");
    expect(saida).not.toMatch(new RegExp(`${dir}/README\\.md `));
  });
});

