import { createServer, type Server } from "node:http";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { mensagemVersaoNova, urlDaVersaoPublicada } from "../scripts/versao-remota";

const temps: string[] = [];
const servidores: Server[] = [];
afterAll(() => {
  for (const servidor of servidores) servidor.close();
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

function temp(): string {
  const dir = mkdtempSync(join(tmpdir(), "linkbio-versao-"));
  temps.push(dir);
  return dir;
}

function git(cwd: string, args: string[]): void {
  execFileSync("git", args, { cwd, encoding: "utf8" });
}

function ouvir(responder: (url: string) => { status: number; corpo: string } | "pendurar"): Promise<string> {
  const servidor = createServer((req, resp) => {
    const decidido = responder(req.url ?? "/");
    if (decidido === "pendurar") return;
    resp.writeHead(decidido.status, { "Content-Type": "application/json" });
    resp.end(decidido.corpo);
  });
  servidores.push(servidor);
  return new Promise((resolve) => {
    servidor.listen(0, "127.0.0.1", () => {
      const porta = (servidor.address() as AddressInfo).port;
      resolve(`http://127.0.0.1:${porta}/versao`);
    });
  });
}

describe("aviso de versão nova", () => {
  test("o endereço de distribuição vira o JSON da branch main", () => {
    const dono = "vam" + "oo-ai";
    expect(urlDaVersaoPublicada(`https://github.com/${dono}/linkbio.git`)).toBe(
      `https://raw.githubusercontent.com/${dono}/linkbio/main/versao.json`,
    );
    expect(urlDaVersaoPublicada("")).toBeNull();
    expect(urlDaVersaoPublicada("git@github.com:alguem/repo.git")).toBeNull();
  });

  test("URL com versão maior avisa e inclui as notas; igual ou menor fica quieto", async () => {
    const url = await ouvir(() => ({ status: 200, corpo: JSON.stringify({ versao: "v9.1.0", notas: "Cabeçalho novo." }) }));
    const msg = await mensagemVersaoNova({ versaoAtual: "0.5.1", versaoUrl: url, root: temp() });
    expect(msg).toMatch(/9\.1\.0/);
    expect(msg).toMatch(/0\.5\.1/);
    expect(msg).toMatch(/Cabeçalho novo/);

    const igual = await ouvir(() => ({ status: 200, corpo: JSON.stringify({ versao: "0.5.1" }) }));
    expect(await mensagemVersaoNova({ versaoAtual: "0.5.1", versaoUrl: igual, root: temp() })).toBeNull();
  });

  test("sem rede, JSON ruim ou URL vazia sem upstream: silêncio", async () => {
    expect(await mensagemVersaoNova({ versaoAtual: "0.5.1", versaoUrl: "http://127.0.0.1:1/versao", root: temp(), timeoutMs: 400 })).toBeNull();
    const ruim = await ouvir(() => ({ status: 200, corpo: "nao-e-json" }));
    expect(await mensagemVersaoNova({ versaoAtual: "0.5.1", versaoUrl: ruim, root: temp() })).toBeNull();
    expect(await mensagemVersaoNova({ versaoAtual: "0.5.1", versaoUrl: "", root: temp() })).toBeNull();
  });

  test("servidor que não responde desiste no timeout", async () => {
    const url = await ouvir(() => "pendurar");
    const inicio = Date.now();
    const msg = await mensagemVersaoNova({ versaoAtual: "0.5.1", versaoUrl: url, root: temp(), timeoutMs: 400 });
    expect(msg).toBeNull();
    expect(Date.now() - inicio).toBeLessThan(2000);
  });

  test("sem URL, a tag mais nova do upstream local vira aviso; tag antiga não", async () => {
    const remoto = temp();
    const origem = temp();
    git(remoto, ["init", "--bare", "-b", "main"]);
    mkdirSync(origem, { recursive: true });
    writeFileSync(join(origem, "a.txt"), "a\n");
    git(origem, ["init", "-b", "main"]);
    git(origem, ["add", "a.txt"]);
    git(origem, ["-c", "user.email=teste@exemplo.com", "-c", "user.name=Teste", "commit", "-m", "a"]);
    git(origem, ["tag", "v0.0.1"]);
    git(origem, ["remote", "add", "upstream", remoto]);
    git(origem, ["push", "upstream", "HEAD:main", "refs/tags/v0.0.1"]);
    expect(await mensagemVersaoNova({ versaoAtual: "0.5.1", versaoUrl: "", root: origem })).toBeNull();

    git(origem, ["tag", "v9.0.0"]);
    git(origem, ["push", "upstream", "refs/tags/v9.0.0"]);
    const msg = await mensagemVersaoNova({ versaoAtual: "0.5.1", versaoUrl: "  ", root: origem });
    expect(msg).toMatch(/9\.0\.0/);
  }, 20_000);
});

describe("npm run check × versão nova", () => {
  test("aviso, nunca erro, e servidor mudo não trava", async () => {
    const url = await ouvir(() => ({ status: 200, corpo: JSON.stringify({ versao: "9.9.9", notas: "Notas da versão." }) }));
    const avisou = await rodaCheck({ LINKBIO_VERSAO_URL: url });
    expect(avisou.status).toBe(0);
    expect(avisou.saida).toMatch(/\[aviso\].*versão mais nova/);
    expect(avisou.saida).toMatch(/9\.9\.9/);
    expect(avisou.saida).not.toMatch(/\[erro\][^\n]*versão/);

    const mudo = await ouvir(() => "pendurar");
    const inicio = Date.now();
    const quieto = await rodaCheck({ LINKBIO_VERSAO_URL: mudo });
    expect(quieto.status).toBe(0);
    expect(quieto.saida).not.toMatch(/versão mais nova/);
    expect(Date.now() - inicio).toBeLessThan(15_000);
  }, 40_000);
});

function rodaCheck(envExtra: Record<string, string>): Promise<{ status: number | null; saida: string }> {
  const dir = temp();
  const arq = join(dir, "config.mjs");
  const config = {
    site: { url: "https://link.exemplo.com", locale: "pt-BR", tz: "America/Sao_Paulo" },
    theme: { preset: "neutro" },
    profile: { name: "Nome", handle: "@perfil", avatar: "/avatar-placeholder.svg", bio: "Bio.", tags: [] },
    contact: { whatsapp: "5511987654321" },
    offers: [{ id: "mentoria", title: "Mentoria", why: "Por quê.", url: "https://exemplo.com/m" }],
    catalog: [{ id: "curso", title: "Curso", url: "https://exemplo.com/c", category: "Cursos" }],
    blocks: [{ type: "profile" }],
  };
  writeFileSync(arq, `export default ${JSON.stringify(config)};`);
  // spawn (não spawnSync): o servidor falso mora neste processo, e o sync travaria o evento
  // até o timeout do próprio check.
  return new Promise((resolve) => {
    const child = spawn("npx", ["tsx", "scripts/check.ts", arq], {
      env: { ...process.env, SUPABASE_URL: "", LINKBIO_ROOT: process.cwd(), ...envExtra },
    });
    let saida = "";
    child.stdout.on("data", (d: Buffer) => {
      saida += d.toString();
    });
    child.stderr.on("data", (d: Buffer) => {
      saida += d.toString();
    });
    child.on("close", (code) => resolve({ status: code, saida }));
  });
}
