import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * Os instaladores só abrem com checksum conferido. Servidor falso via file://; ABRIR troca o
 * open/start por um echo, para o teste ver se o instalador seria aberto.
 */
const sha = (t: string) => createHash("sha256").update(t).digest("hex");
const ERRADO = "0".repeat(64);

function rodar(script: string, args: string[], env: Record<string, string>) {
  const r = spawnSync("bash", [script, ...args], {
    encoding: "utf8",
    env: { ...process.env, ABRIR: "echo ABRIU", ...env },
  });
  return { codigo: r.status, saida: `${r.stdout}${r.stderr}` };
}

function pastas() {
  const raiz = mkdtempSync(join(tmpdir(), "instalador-"));
  const servidor = join(raiz, "servidor");
  const destino = join(raiz, "destino");
  mkdirSync(servidor);
  mkdirSync(destino);
  return { servidor, destino };
}

describe("scripts/instalar-node.sh", () => {
  const INSTALADOR = "conteudo do instalador falso";

  function node(tipo: "pkg" | "msi", somas: string | null) {
    const { servidor, destino } = pastas();
    const nome = tipo === "pkg" ? "node-v24.99.0.pkg" : "node-v24.99.0-x64.msi";
    writeFileSync(join(servidor, nome), INSTALADOR);
    if (somas !== null) writeFileSync(join(servidor, "SHASUMS256.txt"), somas.replaceAll("NOME", nome));
    const r = rodar("scripts/instalar-node.sh", [tipo], { NODE_DIST_BASE: `file://${servidor}`, DESTINO: destino });
    return { ...r, destino };
  }

  test.each(["pkg", "msi"] as const)("checksum certo: baixa e abre (%s)", (tipo) => {
    const r = node(tipo, `${sha("outro")}  node-v24.99.0.tar.gz\n${sha(INSTALADOR)}  NOME\n`);
    expect(r.codigo).toBe(0);
    expect(r.saida).toContain("ABRIU");
    expect(existsSync(join(r.destino, `node.${tipo}`))).toBe(true);
  });

  test("hash diferente: apaga, avisa DIFERENTE e não abre", () => {
    const r = node("pkg", `${ERRADO}  NOME\n`);
    expect(r.codigo).not.toBe(0);
    expect(r.saida).toContain("DIFERENTE");
    expect(r.saida).not.toContain("ABRIU");
    expect(readdirSync(r.destino)).toEqual([]);
  });

  test("esperado vazio (sem a linha do instalador): não baixa nem abre", () => {
    const r = node("pkg", `${sha("x")}  node-v24.99.0.tar.gz\n`);
    expect(r.codigo).not.toBe(0);
    expect(r.saida).toContain("SEM CHECKSUM");
    expect(r.saida).not.toContain("ABRIU");
    expect(readdirSync(r.destino)).toEqual([]);
  });

  test("lista de checksums fora do ar: não baixa nem abre", () => {
    const r = node("pkg", null);
    expect(r.codigo).not.toBe(0);
    expect(r.saida).toContain("SEM CHECKSUM");
    expect(r.saida).not.toContain("ABRIU");
    expect(readdirSync(r.destino)).toEqual([]);
  });
});

describe("scripts/instalar-gh.sh", () => {
  const INSTALADOR = "gh falso";

  function gh(json: string | null, somas: string | null) {
    const { servidor, destino } = pastas();
    const pasta = join(servidor, "download", "v9.9.9");
    mkdirSync(pasta, { recursive: true });
    writeFileSync(join(pasta, "gh_9.9.9_macOS_universal.pkg"), INSTALADOR);
    if (somas !== null) writeFileSync(join(pasta, "gh_9.9.9_checksums.txt"), somas);
    if (json !== null) writeFileSync(join(servidor, "latest.json"), json);
    const r = rodar("scripts/instalar-gh.sh", [], {
      GH_RELEASE_API: `file://${join(servidor, "latest.json")}`,
      GH_DOWNLOAD_BASE: `file://${join(servidor, "download")}`,
      DESTINO: destino,
    });
    return { ...r, destino };
  }

  const JSON_OK = '{\n  "url": "x",\n  "tag_name": "v9.9.9",\n  "name": "GitHub CLI 9.9.9"\n}\n';

  test("checksum certo: baixa e abre", () => {
    const r = gh(JSON_OK, `${sha("a")}  gh_9.9.9_linux_amd64.tar.gz\n${sha(INSTALADOR)}  gh_9.9.9_macOS_universal.pkg\n`);
    expect(r.codigo).toBe(0);
    expect(r.saida).toContain("ABRIU");
  });

  test("hash diferente: apaga, avisa DIFERENTE e não abre", () => {
    const r = gh(JSON_OK, `${ERRADO}  gh_9.9.9_macOS_universal.pkg\n`);
    expect(r.saida).toContain("DIFERENTE");
    expect(r.saida).not.toContain("ABRIU");
    expect(readdirSync(r.destino)).toEqual([]);
  });

  test("sem versão (API sem tag_name): não baixa nem abre", () => {
    const r = gh('{"message": "API rate limit exceeded"}', `${sha(INSTALADOR)}  gh_9.9.9_macOS_universal.pkg\n`);
    expect(r.codigo).not.toBe(0);
    expect(r.saida).toContain("SEM CHECKSUM");
    expect(r.saida).not.toContain("ABRIU");
    expect(readdirSync(r.destino)).toEqual([]);
  });

  test("esperado vazio (checksums sem o .pkg): não baixa nem abre", () => {
    const r = gh(JSON_OK, `${sha("a")}  gh_9.9.9_linux_amd64.tar.gz\n`);
    expect(r.saida).toContain("SEM CHECKSUM");
    expect(r.saida).not.toContain("ABRIU");
    expect(readdirSync(r.destino)).toEqual([]);
  });
});
