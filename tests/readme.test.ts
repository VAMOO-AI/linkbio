import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { readmeComOpcoes } from "../scripts/readme-opcoes";

/** A tabela de opções do README vem de config/opcoes.ts. Se falhar: npm run readme. */
test("README traz exatamente as opções do catálogo (rode npm run readme)", () => {
  const readme = readFileSync("README.md", "utf8");
  expect(readme).toBe(readmeComOpcoes(readme));
});
