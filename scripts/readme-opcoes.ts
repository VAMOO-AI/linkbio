/**
 * npm run readme → reescreve a seção de opções visuais do README a partir de config/opcoes.ts.
 * O teste tests/readme.test.ts falha se o README ficar diferente do catálogo.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { OPCOES } from "../config/opcoes";

export const INICIO = "<!-- opcoes:inicio (gerado por npm run readme, não edite à mão) -->";
export const FIM = "<!-- opcoes:fim -->";

/** Grupo do catálogo → onde ele aparece na linkbio.config.ts. */
const CAMPO: Record<keyof typeof OPCOES, string> = {
  preset: "theme.preset",
  mode: "theme.mode",
  font: "theme.font",
  titulo: "theme.titulo",
  rotulos: "theme.rotulos",
  background: "theme.background",
  buttons: "theme.buttons",
  corners: "theme.corners",
  header: 'bloco "profile": header',
  socials: 'bloco "profile": socials',
  cardsLayout: 'bloco "cards": layout',
  linksLayout: 'bloco "links": layout',
  concierge: 'bloco "concierge": variant',
  conciergeDecide: 'bloco "concierge": decide',
  productsLayout: 'bloco "products": layout',
};

export function secaoOpcoes(): string {
  const partes = (Object.keys(CAMPO) as (keyof typeof OPCOES)[]).map((g) => {
    const linhas = Object.entries(OPCOES[g]).map(([valor, o]) => `| \`"${valor}"\` | ${o.rotulo} | ${o.descricao} |`);
    return [`#### \`${CAMPO[g]}\``, "", "| Valor | Nome | O que faz |", "|---|---|---|", ...linhas].join("\n");
  });
  return [INICIO, "", ...partes.flatMap((p) => [p, ""]), FIM].join("\n");
}

export function readmeComOpcoes(readme: string): string {
  const i = readme.indexOf(INICIO);
  const f = readme.indexOf(FIM);
  if (i < 0 || f < 0) throw new Error("README sem os marcadores da seção de opções.");
  return readme.slice(0, i) + secaoOpcoes() + readme.slice(f + FIM.length);
}

if (process.argv[1]?.endsWith("readme-opcoes.ts")) {
  const arq = join(process.cwd(), "README.md");
  writeFileSync(arq, readmeComOpcoes(readFileSync(arq, "utf8")));
  console.log("README: seção de opções atualizada a partir de config/opcoes.ts");
}
