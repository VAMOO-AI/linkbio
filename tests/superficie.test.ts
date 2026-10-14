import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * A pessoa opera a bio pelo app do Claude (aba Code), sem terminal, e chave nunca passa pelo chat.
 * Este teste reprova doc ou skill que volte a mandar ela abrir terminal, colar chave na conversa ou
 * que mande o agente ler um arquivo com segredo.
 */
const PROIBIDO =
  /rode .?claude|abra o terminal|reabr|outro terminal|outra janela do terminal|powershell|digite no terminal|cole a chave aqui|colad[oa]s? aqui (mesmo )?no chat|colar aqui no chat|cole .*token.* (aqui|no chat)/i;

/** Arquivos com segredo: o agente só conta (`grep -c`) ou testa (`grep -q`), nunca lê. */
const SEGREDO = String.raw`\S*(?:\.env\.local|senha-do-painel\.txt)`;
const LEITURA = new RegExp(
  String.raw`\b(?:cat|less|more|head|tail|type|source)\s+${SEGREDO}|(?:^|[\s\`;&|(])\.\s+${SEGREDO}|\b(?:sed|awk)\b[^\`\n]*?\s${SEGREDO}`,
  "i",
);
/** grep com as opções (inclusive com número: -A3, -C 3) antes do padrão e do arquivo. */
const GREP = new RegExp(
  String.raw`\bgrep((?:\s+-[A-Za-z]+(?:\s*\d+)?)*)\s+(?:'[^']*'|"[^"]*"|[^\s'"]+)\s+${SEGREDO}`,
  "g",
);

/** Mensagem de entrada: a mesma no README e no COMECE-AQUI.html. */
const ENTRADA = "Monta a minha bio. Eu não uso terminal: faça tudo por mim e me diga só onde clicar.";

const OBRIGATORIOS = ["README.md", "AGENTS.md", "COMECE-AQUI.html"];

function mds(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return nome === "worktrees" ? [] : mds(caminho);
    return nome.endsWith(".md") ? [caminho] : [];
  });
}

/** Parágrafos com as linhas juntas: frase quebrada no meio ("OUTRA janela do\nterminal") também conta. */
function paragrafos(arquivo: string): string[] {
  return readFileSync(arquivo, "utf8")
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.replace(/\s*\r?\n\s*/g, " ").trim())
    .filter(Boolean);
}

function leSegredo(p: string): boolean {
  if (LEITURA.test(p)) return true;
  return [...p.matchAll(GREP)].some((m) => !/-[A-Za-z]*[cq]/.test(m[1] ?? ""));
}

const arquivos = [...OBRIGATORIOS, ...mds(".claude")].filter((a) => existsSync(a));

describe("superfície do app (sem terminal, sem chave no chat)", () => {
  test.each(OBRIGATORIOS)("%s existe", (arquivo) => {
    expect(existsSync(arquivo)).toBe(true);
  });

  test.each(arquivos)("%s não manda abrir terminal nem colar chave no chat", (arquivo) => {
    expect(paragrafos(arquivo).filter((p) => PROIBIDO.test(p))).toEqual([]);
  });

  test.each(arquivos)("%s não manda ler .env.local nem a senha do painel", (arquivo) => {
    expect(paragrafos(arquivo).filter(leSegredo)).toEqual([]);
  });

  test("os padrões pegam o que devem e deixam passar a contagem", () => {
    expect(PROIBIDO.test("abrir OUTRA janela do terminal".replace("do ", "do\n").replace(/\s*\n\s*/g, " "))).toBe(true);
    expect(leSegredo("rode `cat .env.local`")).toBe(true);
    expect(leSegredo("rode `grep SUPABASE .env.local`")).toBe(true);
    expect(leSegredo("rode `grep -n '^OK' analise/senha-do-painel.txt`")).toBe(true);
    expect(leSegredo("rode `type analise\\senha-do-painel.txt`")).toBe(true);
    expect(leSegredo("rode `grep -A3 SUPABASE .env.local`")).toBe(true);
    expect(leSegredo("rode `grep -C 3 '^OK' analise/senha-do-painel.txt`")).toBe(true);
    expect(leSegredo("rode `sed -n 1,5p .env.local`")).toBe(true);
    expect(leSegredo("rode `awk -F= '{print $2}' .env.local`")).toBe(true);
    expect(leSegredo("rode `source .env.local`")).toBe(true);
    expect(leSegredo("rode `. .env.local`")).toBe(true);
    expect(leSegredo("rode `grep -cE '^X=(a|b)' .env.local`")).toBe(false);
    expect(leSegredo("rode `grep -q '^X=' .env.local || printf 'X=' >> .env.local`")).toBe(false);
  });

  test("README e COMECE-AQUI.html trazem a mesma mensagem de entrada", () => {
    expect(readFileSync("README.md", "utf8")).toContain(ENTRADA);
    expect(readFileSync("COMECE-AQUI.html", "utf8")).toContain(ENTRADA);
  });
});
