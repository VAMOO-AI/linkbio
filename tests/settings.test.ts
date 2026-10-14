import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// O mentorado opera pelo app do Claude: o que é rotina das skills roda sem
// pedir "Permitir"; o que apaga, grava chave ou lê segredo continua perguntando.
const settings = JSON.parse(readFileSync(join(__dirname, "..", ".claude", "settings.json"), "utf8"));
const { allow, ask, deny, defaultMode } = settings.permissions as {
  allow: string[];
  ask: string[];
  deny: string[];
  defaultMode: string;
};

// Curinga em allow é o que abre brecha (`git diff *` lia e zerava o .env.local).
// Só estes podem ter `*`; qualquer outro reprova.
const CURINGAS_PERMITIDOS = new Set([
  "Bash(npm run analisar *)",
  "Bash(bash scripts/instalar-node.sh *)",
  "Bash(ls *)",
  "Bash(which *)",
  "Bash(where *)",
  "Bash(uname *)",
  "PowerShell(npm run analisar *)",
  "PowerShell(Get-ChildItem *)",
]);

describe(".claude/settings.json", () => {
  it("abre em aceitar edições", () => {
    expect(defaultMode).toBe("acceptEdits");
  });

  it("libera os comandos de rotina das skills", () => {
    for (const regra of [
      "Bash(npm run check)",
      "Bash(npm run dev)",
      "Bash(npm run foto)",
      "Bash(npm run analisar *)",
      "Bash(npm run admin:segredo)",
      "Bash(bash scripts/instalar-node.sh *)",
      "Bash(bash scripts/instalar-gh.sh)",
      "Bash(grep -c '^APIFY_TOKEN=[A-Za-z0-9_-]\\{20,\\}' .env.local)",
      "Bash(open -e .env.local)",
      'Bash(start "" notepad .env.local)',
    ]) {
      expect(allow).toContain(regra);
    }
  });

  it("só tem curinga em allow onde não dá para ler nem apagar segredo", () => {
    expect(allow.filter((r) => r.includes("*") && !CURINGAS_PERMITIDOS.has(r))).toEqual([]);
  });

  it("toda regra de allow que cita arquivo de chave só conta, abre no editor ou apaga a senha", () => {
    const citaSegredo = allow.filter((r) => /\.env|senha-do-painel/.test(r));
    const formaSegura = /^Bash\((grep -c|grep -cE|grep -q|open -e |start "" notepad |test -f |rm -f analise\/)/;
    expect(citaSegredo.filter((r) => !formaSegura.test(r))).toEqual([]);
  });

  it("o que grava chave, cria senha, lê segredo ou apaga continua perguntando", () => {
    for (const regra of [
      "Bash(npm run chave *)",
      "Bash(npm run admin:usuario *)",
      "Bash(node -e *)",
      "Bash(cat *.env*)",
      "Bash(rm -rf *)",
      "Bash(git reset --hard *)",
    ]) {
      expect(ask).toContain(regra);
    }
    expect(allow).not.toContain("Bash(cp .env.example .env.local)");
    // npm run foto -- file:///.env.local fotografava a chave: só a forma sem argumento.
    expect(allow.filter((r) => /npm run foto /.test(r))).toEqual([]);
  });

  it("bloqueia ler o segredo pelo Read e pelos atalhos do git", () => {
    for (const regra of [
      "Read(./.env.local)",
      "Read(./analise/senha-do-painel.txt)",
      "Bash(git diff --no-index*)",
      "Bash(git * --output*)",
      "Bash(git *--output=*)",
    ]) {
      expect(deny).toContain(regra);
    }
    expect(deny).not.toContain("Read(./.env.example)");
  });

  it("mantém o hook que puxa o setup na primeira mensagem", () => {
    expect(JSON.stringify(settings.hooks)).toContain("setup-linkbio");
  });
});
