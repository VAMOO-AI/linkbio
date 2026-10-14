import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { afterAll, describe, expect, test, vi } from "vitest";
import { CHAVE_FALSA } from "../e2e/painel-ambiente";
import exemplo from "./fixtures/config-exemplo";
import { corpoDaSaude, consultarSaude } from "@/lib/saude";
import { resolverOrigem } from "@/lib/origem-config";

/**
 * Origem da config e GET /api/saude, contra o Supabase falso dos e2e (e2e/painel-servidor.ts)
 * numa porta só deste teste. O falso da suíte de navegador fica intocado.
 */

const processos: ChildProcess[] = [];
afterAll(() => {
  for (const proc of processos) proc.kill("SIGTERM");
});

async function portaLivre(): Promise<number> {
  return new Promise((resolve, reject) => {
    const servidor = createServer();
    servidor.listen(0, "127.0.0.1", () => {
      const endereco = servidor.address();
      if (!endereco || typeof endereco === "string") return reject(new Error("sem porta"));
      const porta = endereco.port;
      servidor.close(() => resolve(porta));
    });
  });
}

async function subirFalso(): Promise<string> {
  const porta = await portaLivre();
  const url = `http://127.0.0.1:${porta}`;
  const proc = spawn("npx", ["tsx", "e2e/painel-servidor.ts"], {
    env: { ...process.env, LINKBIO_PORTA_FALSA: String(porta) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  processos.push(proc);
  const prazo = Date.now() + 20_000;
  while (Date.now() < prazo) {
    try {
      const resp = await fetch(`${url}/__saude`);
      if (resp.ok) return url;
    } catch {
      // ainda subindo
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("o Supabase falso não subiu");
}

async function publicar(url: string, config: unknown): Promise<void> {
  const resp = await fetch(`${url}/rest/v1/site_config`, {
    method: "POST",
    headers: { apikey: CHAVE_FALSA, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ config }),
  });
  if (!resp.ok) throw new Error(await resp.text());
}

describe("origem da config", () => {
  test("sem Supabase: arquivo, motivo sem-supabase, sem chamar a rede", async () => {
    const buscar = vi.fn();
    const origem = await resolverOrigem({ arquivo: exemplo, fetch: buscar as unknown as typeof fetch });
    expect(origem).toEqual({ fonte: "arquivo", motivo: "sem-supabase", config: exemplo });
    expect(buscar).not.toHaveBeenCalled();
  });

  test("falso sem publicação: arquivo e motivo sem-versao", async () => {
    const url = await subirFalso();
    const origem = await resolverOrigem({ supabaseUrl: url, chave: CHAVE_FALSA, arquivo: exemplo, cache: "no-store" });
    expect(origem.fonte).toBe("arquivo");
    if (origem.fonte === "arquivo") expect(origem.motivo).toBe("sem-versao");
    expect(origem.config).toBe(exemplo);
  }, 30_000);

  test("falso com versão válida: banco e a data da publicação, sem o conteúdo na resposta de saúde", async () => {
    const url = await subirFalso();
    await publicar(url, exemplo);
    const origem = await resolverOrigem({ supabaseUrl: url, chave: CHAVE_FALSA, arquivo: exemplo, cache: "no-store" });
    expect(origem.fonte).toBe("banco");
    if (origem.fonte !== "banco") return;
    expect(origem.ultimaPublicacao && Date.parse(origem.ultimaPublicacao)).not.toBeNaN();
    expect(origem.config.profile.name).toBe(exemplo.profile.name);
    const corpo = corpoDaSaude(origem, "0.5.1");
    expect(corpo).toEqual({ versao: "0.5.1", fonte: "banco", ok: true, ultimaPublicacao: origem.ultimaPublicacao });
    expect(JSON.stringify(corpo)).not.toContain(exemplo.profile.name);
    expect(JSON.stringify(corpo)).not.toContain(CHAVE_FALSA);
  }, 30_000);

  test("versão inválida no falso: arquivo, motivo versao-invalida, e o mesmo aviso de antes", async () => {
    const url = await subirFalso();
    const segredo = "NAO-PODE-VAZAR-CONFIG";
    await publicar(url, { site: { url: "nao-e-url" }, segredo });
    const avisos: unknown[][] = [];
    const origem = await resolverOrigem({
      supabaseUrl: url,
      chave: CHAVE_FALSA,
      arquivo: exemplo,
      cache: "no-store",
      log: (...args) => avisos.push(args),
    });
    expect(origem).toMatchObject({ fonte: "arquivo", motivo: "versao-invalida", config: exemplo });
    expect(avisos[0]?.[0]).toBe("[linkbio] versão salva no banco é inválida; usando linkbio.config.ts");
    const corpo = await consultarSaude({ supabaseUrl: url, chave: CHAVE_FALSA, arquivo: exemplo, versao: "0.5.1", log: () => {} });
    expect(corpo).toEqual({ versao: "0.5.1", fonte: "arquivo", motivo: "versao-invalida", ok: false });
    expect(JSON.stringify(corpo)).not.toContain(segredo);
  }, 30_000);

  test("banco fora do ar: arquivo, motivo erro-banco, e o mesmo aviso de antes", async () => {
    const avisos: unknown[][] = [];
    const origem = await resolverOrigem({
      supabaseUrl: "http://127.0.0.1:1",
      chave: CHAVE_FALSA,
      arquivo: exemplo,
      cache: "no-store",
      log: (...args) => avisos.push(args),
    });
    expect(origem).toMatchObject({ fonte: "arquivo", motivo: "erro-banco" });
    expect(avisos[0]?.[0]).toBe("[linkbio] não foi possível ler a config do banco; usando linkbio.config.ts");
    const corpo = corpoDaSaude(origem, "0.5.1");
    expect(corpo.ok).toBe(false);
    expect(corpo.motivo).toBe("erro-banco");
  });
});
