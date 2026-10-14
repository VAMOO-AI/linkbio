import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";

const temps: string[] = [];
afterAll(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

describe("sql:instalar", () => {
  test("junta todas as migrations, em ordem de nome, e as atuais não avisam idempotência", () => {
    const dir = join(process.cwd(), "supabase/migrations");
    const arquivos = readdirSync(dir)
      .filter((nome) => nome.endsWith(".sql"))
      .sort();
    expect(arquivos.length).toBeGreaterThan(0);
    const r = spawnSync("bash", ["scripts/sql-instalar.sh"], { encoding: "utf8" });
    expect(r.status).toBe(0);
    expect(r.stderr).not.toMatch(/AVISO:/);
    const saida = r.stdout;
    let cursor = 0;
    for (const nome of arquivos) {
      const marca = saida.indexOf(`-- ===== ${nome} =====`, cursor);
      expect(marca, nome).toBeGreaterThanOrEqual(0);
      const corpo = readFileSync(join(dir, nome), "utf8").trim();
      const onde = saida.indexOf(corpo, marca);
      expect(onde, nome).toBeGreaterThan(marca);
      cursor = onde + corpo.length;
    }
  });

  test("grava o arquivo pedido e avisa migration sem if not exists nem on conflict", () => {
    const dir = mkdtempSync(join(tmpdir(), "linkbio-sql-"));
    temps.push(dir);
    mkdirSync(join(dir, "supabase/migrations"), { recursive: true });
    mkdirSync(join(dir, "scripts"), { recursive: true });
    writeFileSync(join(dir, "scripts/sql-instalar.sh"), readFileSync("scripts/sql-instalar.sh"));
    writeFileSync(join(dir, "supabase/migrations/0002_b.sql"), "create table if not exists b (id int);\n");
    writeFileSync(join(dir, "supabase/migrations/0001_a.sql"), "create table a (id int);\n");
    const saida = join(dir, "supabase/instalar.sql");
    const r = spawnSync("bash", ["scripts/sql-instalar.sh", saida], { cwd: dir, encoding: "utf8" });
    expect(r.status).toBe(0);
    expect(r.stderr).toMatch(/AVISO: 0001_a.sql/);
    expect(r.stderr).not.toMatch(/0002_b.sql/);
    const texto = readFileSync(saida, "utf8");
    expect(texto.indexOf("0001_a.sql")).toBeLessThan(texto.indexOf("0002_b.sql"));
    expect(texto.indexOf("create table a")).toBeLessThan(texto.indexOf("create table if not exists b"));
    expect(r.stdout).toContain("create table a");
  });
});

describe("pacote e distribuição", () => {
  test("publicar-dist empurra o archive da tag, com instalar.sql, sem o histórico interno", () => {
    const raiz = mkdtempSync(join(tmpdir(), "linkbio-dist-"));
    temps.push(raiz);
    const origem = join(raiz, "origem");
    const remoto = join(raiz, "remoto.git");
    mkdirSync(join(origem, "scripts"), { recursive: true });
    mkdirSync(join(origem, "supabase/migrations"), { recursive: true });
    for (const nome of ["publicar-dist.sh", "preparar-arvore.sh", "sql-instalar.sh", "zip-gate.sh"]) {
      writeFileSync(join(origem, "scripts", nome), readFileSync(join("scripts", nome)));
    }
    writeFileSync(join(origem, "supabase/migrations/0002_b.sql"), "create table if not exists b (id int);\n");
    writeFileSync(join(origem, "supabase/migrations/0001_a.sql"), "create table if not exists a (id int);\n");
    writeFileSync(join(origem, "leiame.txt"), "um\n");
    writeFileSync(join(origem, ".gitignore"), "node_modules\n");
    git(origem, ["init", "-b", "main"]);
    git(origem, ["add", "-A"]);
    git(origem, ["-c", "user.email=teste@exemplo.com", "-c", "user.name=Teste", "commit", "-m", "interno 1"]);
    writeFileSync(join(origem, "leiame.txt"), "conteudo da tag\n");
    git(origem, ["add", "-A"]);
    git(origem, ["-c", "user.email=teste@exemplo.com", "-c", "user.name=Teste", "commit", "-m", "interno 2"]);
    git(origem, ["tag", "v0.0.1"]);
    git(raiz, ["init", "--bare", "-b", "main", remoto]);

    const ok = spawnSync("bash", ["scripts/publicar-dist.sh", "v0.0.1", remoto], { cwd: origem, encoding: "utf8" });
    expect(ok.status, ok.stderr).toBe(0);

    const clone = join(raiz, "clone");
    git(raiz, ["clone", remoto, clone]);
    expect(readFileSync(join(clone, "leiame.txt"), "utf8")).toBe("conteudo da tag\n");
    expect(readFileSync(join(clone, ".gitignore"), "utf8")).toContain("node_modules");
    const sql = readFileSync(join(clone, "supabase/instalar.sql"), "utf8");
    expect(sql.indexOf("0001_a.sql")).toBeLessThan(sql.indexOf("0002_b.sql"));
    const log = execFileSync("git", ["log", "--format=%s"], { cwd: clone, encoding: "utf8" });
    expect(log.trim().split("\n")).toEqual(["distribuição v0.0.1"]);
    expect(log).not.toContain("interno");
    expect(execFileSync("git", ["tag", "--points-at", "HEAD"], { cwd: clone, encoding: "utf8" }).trim()).toBe("v0.0.1");
    expect(readFileSync("scripts/package-template.sh", "utf8")).toContain("preparar-arvore.sh");

    const numero = ["55", "11", "988877766"].join("");
    writeFileSync(join(origem, "telefone.txt"), `${numero}\n`);
    git(origem, ["add", "-A"]);
    git(origem, ["-c", "user.email=teste@exemplo.com", "-c", "user.name=Teste", "commit", "-m", "numero"]);
    git(origem, ["tag", "v0.0.2"]);
    const ruim = spawnSync("bash", ["scripts/publicar-dist.sh", "v0.0.2", remoto], { cwd: origem, encoding: "utf8" });
    expect(ruim.status).not.toBe(0);
    const tags = execFileSync("git", ["ls-remote", "--tags", remoto], { encoding: "utf8" });
    expect(tags).toContain("v0.0.1");
    expect(tags).not.toContain("v0.0.2");
  }, 30_000);
});

function git(cwd: string, args: string[]): void {
  execFileSync("git", args, { cwd, encoding: "utf8" });
}
