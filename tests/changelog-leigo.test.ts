import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

/**
 * A partir da v0.6.0 (e no que ainda não foi lançado), cada versão abre com
 * `### Para quem usa` e no máximo 3 linhas. Versões anteriores não entram na regra.
 */

const MARCO = [0, 6, 0];

export function exigeParaQuemUsa(titulo: string): boolean {
  const nome = titulo.trim();
  if (nome === "Não lançado") return true;
  const m = nome.match(/^v(\d+)\.(\d+)\.(\d+)/);
  if (!m) return false;
  const versao = [Number(m[1]), Number(m[2]), Number(m[3])];
  for (let i = 0; i < 3; i++) {
    if (versao[i]! > MARCO[i]!) return true;
    if (versao[i]! < MARCO[i]!) return false;
  }
  return true;
}

/** null = bloco válido. Senão, o motivo. */
export function problemaParaQuemUsa(corpo: string): string | null {
  const linhas = corpo.split(/\r?\n/);
  let i = 0;
  while (i < linhas.length && linhas[i]!.trim() === "") i++;
  if (linhas[i]?.trim() !== "### Para quem usa") return "falta ### Para quem usa no topo da versão";
  i++;
  const texto: string[] = [];
  while (i < linhas.length && !linhas[i]!.startsWith("### ")) {
    const t = linhas[i]!.trim();
    if (t) texto.push(t);
    i++;
  }
  if (texto.length < 1) return "bloco Para quem usa vazio";
  if (texto.length > 3) return "bloco Para quem usa tem mais de 3 linhas";
  return null;
}

function secoes(md: string): { titulo: string; corpo: string }[] {
  const partes = md.split(/^## /m).slice(1);
  return partes.map((parte) => {
    const quebra = parte.indexOf("\n");
    const titulo = (quebra === -1 ? parte : parte.slice(0, quebra)).trim();
    const corpo = quebra === -1 ? "" : parte.slice(quebra + 1);
    return { titulo, corpo };
  });
}

describe("changelog para quem usa", () => {
  test("a regra começa na v0.6.0 e não pega as versões antigas", () => {
    expect(exigeParaQuemUsa("v0.5.1 (2026-10-02)")).toBe(false);
    expect(exigeParaQuemUsa("v0.4.0 (2026-09-30)")).toBe(false);
    expect(exigeParaQuemUsa("v0.6.0 (2026-10-13)")).toBe(true);
    expect(exigeParaQuemUsa("v0.6.1")).toBe(true);
    expect(exigeParaQuemUsa("v1.0.0")).toBe(true);
    expect(exigeParaQuemUsa("Não lançado")).toBe(true);
    expect(problemaParaQuemUsa("### Outra coisa\n### Para quem usa\n- Uma linha.")).not.toBeNull();
    expect(problemaParaQuemUsa("### Para quem usa\n- A.\n- B.\n- C.\n- D.")).not.toBeNull();
    expect(problemaParaQuemUsa("### Para quem usa\n- A.\n\n- B.\n")).toBeNull();
  });

  test("o changelog real cumpre a regra, e a skill de atualizar lê o bloco", () => {
    const md = readFileSync("CHANGELOG.md", "utf8");
    const lista = secoes(md);
    const cobertas = lista.filter((s) => exigeParaQuemUsa(s.titulo));
    expect(cobertas.map((s) => s.titulo)).toContain("Não lançado");
    for (const secao of cobertas) {
      expect(problemaParaQuemUsa(secao.corpo), secao.titulo).toBeNull();
    }
    for (const secao of lista.filter((s) => !exigeParaQuemUsa(s.titulo))) {
      expect(secao.titulo.startsWith("v0.")).toBe(true);
    }
    const skill = readFileSync(".claude/skills/atualizar-template/SKILL.md", "utf8");
    expect(skill).toContain("### Para quem usa");
    expect(skill).toContain("URL_DISTRIBUICAO");
    const publicar = readFileSync(".claude/skills/publicar/SKILL.md", "utf8");
    expect(publicar).toContain("URL_DISTRIBUICAO");
    expect(publicar).toContain("git remote add upstream");
  });
});
