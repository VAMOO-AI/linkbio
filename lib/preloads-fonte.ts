import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export type ParDeFontes = { display: string; body: string };

/** Famílias que o tema realmente usa, sem repetir quando título e texto são a mesma. */
export function chavesUsadas(font: ParDeFontes): string[] {
  return [...new Set([font.display, font.body])];
}

function limparFamilia(valor: string): string {
  return valor.trim().replace(/^["']|["']$/g, "").trim();
}

function urlPublica(bruta: string): string | null {
  const u = bruta.trim().replace(/^["']|["']$/g, "");
  const nome = u.split("/").pop()?.split("?")[0] ?? "";
  if (!/\.woff2?$/.test(nome)) return null;
  if (u.startsWith("/_next/")) return u.split("?")[0]!;
  return `/_next/static/media/${nome}`;
}

/** O arquivo latino é o que o next/font marcaria para pré-carregar (U+0000-00FF / U+20AC). */
function ehLatim(unicodeRange: string | null): boolean {
  if (!unicodeRange) return true;
  return /U\+0000-00FF|U\+\?\?|U\+20AC/i.test(unicodeRange);
}

/**
 * CSS do next/font → URLs públicas do arquivo latino de cada --lb-f-*.
 * O nome da família pode vir legível (dev) ou com hash (build); o valor da variável é a chave.
 */
export function urlsDasFontes(css: string): Record<string, string[]> {
  const porFamilia = new Map<string, { href: string; latim: boolean }[]>();
  for (const bloco of css.match(/@font-face\s*\{[^}]*\}/g) ?? []) {
    const familia = bloco.match(/font-family:\s*([^;]+)/);
    if (!familia) continue;
    const nome = limparFamilia(familia[1] ?? "");
    if (!nome || /fallback/i.test(nome)) continue;
    const faixa = bloco.match(/unicode-range:\s*([^;]+)/)?.[1] ?? null;
    const hrefs = [...bloco.matchAll(/url\(\s*([^)]+?)\s*\)/g)]
      .map((m) => urlPublica(m[1] ?? ""))
      .filter((h): h is string => Boolean(h));
    const lista = porFamilia.get(nome) ?? [];
    for (const href of hrefs) lista.push({ href, latim: ehLatim(faixa) });
    porFamilia.set(nome, lista);
  }

  const out: Record<string, string[]> = {};
  for (const achado of css.matchAll(/--lb-f-([a-z]+)\s*:\s*([^;}{]+)/g)) {
    const chave = achado[1]!;
    const nomes = [...(achado[2] ?? "").matchAll(/["']([^"']+)["']/g)]
      .map((m) => m[1] ?? "")
      .filter((n) => n && !/fallback/i.test(n));
    const arquivos = nomes.flatMap((n) => porFamilia.get(n) ?? []);
    const latinos = arquivos.filter((a) => a.latim);
    const escolhidos = (latinos.length ? latinos : arquivos).map((a) => a.href);
    const unicos = [...new Set(escolhidos)];
    if (unicos.length) out[chave] = unicos;
  }
  return out;
}

/** Links de pré-carga das famílias do tema resolvido (título e texto). */
export function hrefsParaPreload(font: ParDeFontes, css: string): string[] {
  const mapa = urlsDasFontes(css);
  return [...new Set(chavesUsadas(font).flatMap((chave) => mapa[chave] ?? []))];
}

let cssEmCache: string | null = null;

function listarCss(dir: string, acc: string[], profundidade: number) {
  if (profundidade > 4) return;
  let nomes: string[];
  try {
    nomes = readdirSync(dir);
  } catch {
    return;
  }
  for (const nome of nomes) {
    const caminho = join(dir, nome);
    let info;
    try {
      info = statSync(caminho);
    } catch {
      continue;
    }
    if (info.isDirectory()) listarCss(caminho, acc, profundidade + 1);
    else if (nome.endsWith(".css")) acc.push(caminho);
  }
}

function cssDe(dir: string): string {
  const arquivos: string[] = [];
  // O diretório só existe depois do build. Sem o ignore, o Next inclui o projeto inteiro na função.
  listarCss(join(/*turbopackIgnore: true*/ process.cwd(), dir), arquivos, 0);
  return arquivos.map((a) => readFileSync(a, "utf8")).join("\n");
}

/**
 * CSS já emitido pelo next/font. O build de produção ganha do dev, para um
 * servidor antigo não misturar os dois. Vazio se ainda não houver CSS.
 */
export function cssDasFontes(): string {
  if (cssEmCache) return cssEmCache;
  const texto = cssDe(".next/static") || cssDe(".next/dev/static");
  if (texto) cssEmCache = texto;
  return texto;
}
