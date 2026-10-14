import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { avaliarSetup, distanciaCor } from "../scripts/eval-setup";

/**
 * Régua do setup (lote I): gabarito bom >= 8, ruim < 5, e cada critério
 * aponta o defeito plantado na config ruim.
 */
const RAIZ = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const CASOS = ["prestadora", "loja", "mentor", "poucas-legendas"] as const;
const CRITERIOS = ["ofertas", "links", "voz", "inventado", "visual", "exemplo", "check"] as const;

const CHAVES_INSTAGRAM = [
  "usuario",
  "nome",
  "bio",
  "links",
  "categoria",
  "foto",
  "privado",
  "seguidores",
  "totalPosts",
  "posts",
  "coletadoEm",
  "coresDaFoto",
] as const;

describe("eval do setup", () => {
  test("cor próxima passa e cor distante não", () => {
    expect(distanciaCor("#b4532a", "#b4532a")).toBe(0);
    expect(distanciaCor("#b4532a", "#c46238")).toBeLessThanOrEqual(40);
    expect(distanciaCor("#b4532a", "#007dff")).toBeGreaterThan(40);
  });

  for (const caso of CASOS) {
    test(`${caso}: a coleta simulada tem o formato do analisar`, () => {
      const ig = JSON.parse(readFileSync(join(RAIZ, "tests/fixtures/eval", caso, "fontes/instagram.json"), "utf8"));
      for (const chave of CHAVES_INSTAGRAM) expect(ig, chave).toHaveProperty(chave);
      expect(Array.isArray(ig.posts)).toBe(true);
      expect(Array.isArray(ig.coresDaFoto)).toBe(true);
    });

    test(`${caso}: gabarito bom tira nota >= 8 em cada critério`, async () => {
      const r = await avaliarSetup(caso, join(RAIZ, "tests/fixtures/eval", caso, "boa.json"), RAIZ);
      expect(r.schema.ok, r.schema.problemas.join("\n")).toBe(true);
      expect(r.check.ok, r.check.erros.join("\n")).toBe(true);
      expect(r.nota).toBeGreaterThanOrEqual(8);
      for (const id of CRITERIOS) {
        const c = r.criterios.find((x) => x.id === id);
        expect(c, id).toBeTruthy();
        expect(c!.nota, `${id}: ${c!.detalhes.join(" | ")}`).toBeGreaterThanOrEqual(8);
      }
    });

    test(`${caso}: gabarito ruim fica abaixo de 5 e cada critério pega o defeito`, async () => {
      const r = await avaliarSetup(caso, join(RAIZ, "tests/fixtures/eval", caso, "ruim.json"), RAIZ);
      expect(r.nota).toBeLessThan(5);
      for (const id of CRITERIOS) {
        const c = r.criterios.find((x) => x.id === id);
        expect(c, id).toBeTruthy();
        expect(c!.nota, `${caso}/${id}`).toBeLessThan(5);
        expect(c!.detalhes.length, `${caso}/${id} sem explicação`).toBeGreaterThan(0);
      }
    });
  }

  test("cli --json imprime a nota e sai 0 no gabarito bom", () => {
    const r = spawnSync(
      join(RAIZ, "node_modules/.bin/tsx"),
      ["scripts/eval-setup.ts", "prestadora", "tests/fixtures/eval/prestadora/boa.json", "--json"],
      { encoding: "utf8", cwd: RAIZ },
    );
    expect(r.status, r.stderr).toBe(0);
    const j = JSON.parse(r.stdout) as { nota: number; criterios: { id: string }[] };
    expect(j.nota).toBeGreaterThanOrEqual(8);
    expect(j.criterios.map((c) => c.id)).toEqual([...CRITERIOS]);
  });
});
