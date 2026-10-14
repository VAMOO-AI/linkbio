import { spawn } from "node:child_process";

const TIMEOUT_MS = 2_000;

export type OpcoesVersao = {
  versaoAtual: string;
  versaoUrl: string;
  root: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
};

function partes(versao: string): [number, number, number] | null {
  const m = versao.trim().replace(/^v/i, "").match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** true quando `candidata` é uma versão semver estritamente maior. */
export function versaoMaior(candidata: string, atual: string): boolean {
  const a = partes(candidata);
  const b = partes(atual);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i]! > b[i]!) return true;
    if (a[i]! < b[i]!) return false;
  }
  return false;
}

function texto(nova: string, atual: string, notas?: string): string {
  const limpa = (v: string) => v.trim().replace(/^v/i, "");
  const extra = notas?.trim() ? ` ${notas.trim().replace(/\s+/g, " ").slice(0, 180)}` : "";
  return `há uma versão mais nova do template (${limpa(nova)}; você está na ${limpa(atual)}).${extra}`;
}

function executar(cmd: string, args: string[], ms: number): Promise<{ code: number; stdout: string } | null> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let terminou = false;
    const fim = (valor: { code: number; stdout: string } | null) => {
      if (terminou) return;
      terminou = true;
      clearTimeout(timer);
      resolve(valor);
    };
    const timer = setTimeout(() => {
      child.kill();
      fim(null);
    }, ms);
    child.stdout.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    child.on("error", () => fim(null));
    child.on("close", (code) => fim({ code: code ?? 1, stdout }));
  });
}

/** JSON publicado no repositório de distribuição (`main/versao.json`). Endereço vazio ou fora do GitHub: null. */
export function urlDaVersaoPublicada(distribuicao: string): string | null {
  const m = distribuicao.trim().match(/^https:\/\/github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i);
  if (!m?.[1] || !m?.[2]) return null;
  return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/main/versao.json`;
}

function maiorTag(saida: string): string | null {
  let melhor: string | null = null;
  for (const linha of saida.split("\n")) {
    const m = linha.match(/refs\/tags\/(v?\d+\.\d+\.\d+)(?:\^\{\})?$/);
    if (!m?.[1]) continue;
    if (!melhor || versaoMaior(m[1], melhor)) melhor = m[1];
  }
  return melhor;
}

async function tagDoUpstream(root: string, ms: number): Promise<string | null> {
  const remoto = await executar("git", ["-C", root, "remote", "get-url", "upstream"], ms);
  if (!remoto || remoto.code !== 0) return null;
  const url = remoto.stdout.trim();
  if (!url) return null;
  const tags = await executar("git", ["-C", root, "ls-remote", "--tags", url], ms);
  if (!tags || tags.code !== 0) return null;
  return maiorTag(tags.stdout);
}

/**
 * Aviso (nunca erro) se existir versão mais nova. URL preenchida lê o JSON;
 * se ela falhar, ou se estiver vazia, vale a tag mais alta do remote `upstream`.
 * Sem rede: null.
 */
export async function mensagemVersaoNova(o: OpcoesVersao): Promise<string | null> {
  const ms = o.timeoutMs ?? TIMEOUT_MS;
  const url = o.versaoUrl.trim();
  try {
    let candidata: string | null = null;
    let notas: string | undefined;
    let urlFalhou = !url;
    if (url) {
      try {
        const buscar = o.fetch ?? fetch;
        const resp = await buscar(url, { signal: AbortSignal.timeout(ms) });
        if (!resp.ok) urlFalhou = true;
        else {
          const dados = (await resp.json()) as { versao?: unknown; notas?: unknown };
          if (typeof dados.versao !== "string") urlFalhou = true;
          else {
            candidata = dados.versao;
            if (typeof dados.notas === "string") notas = dados.notas;
          }
        }
      } catch {
        urlFalhou = true;
      }
    }
    if (!candidata && urlFalhou) candidata = await tagDoUpstream(o.root, ms);
    if (!candidata || !versaoMaior(candidata, o.versaoAtual)) return null;
    return texto(candidata, o.versaoAtual, notas);
  } catch {
    return null;
  }
}
