/**
 * npm run eval:setup -- <caso> <caminho-da-config> [--json]
 *
 * Mede a config que o setup escreveu contra tests/fixtures/eval/<caso>/esperado.json.
 * Sem rede: a coleta simulada já está em fontes/ (o que `npm run analisar` gravaria em analise/).
 * Nota de 0 a 10. Sai 1 se ficar abaixo de 8.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { defineConfig } from "../config/schema";
import { camposDoExemplo, executarCheck } from "./check";

export type IdCriterio = "ofertas" | "links" | "voz" | "inventado" | "visual" | "exemplo" | "check";

export type Criterio = {
  id: IdCriterio;
  nome: string;
  nota: number;
  peso: number;
  pontos: number;
  detalhes: string[];
};

export type Relatorio = {
  caso: string;
  config: string;
  nota: number;
  criterios: Criterio[];
  schema: { ok: boolean; problemas: string[] };
  check: { ok: boolean; erros: string[]; avisos: string[] };
};

type OfertaEsperada = { titulo: string; precoCentavos?: number | null; url?: string };
type LinkEsperado = { titulo?: string; url: string };
type Esperado = {
  titulo?: string;
  ofertas: OfertaEsperada[];
  maxOfertas?: number;
  maxCatalogo?: number;
  concierge?: "obrigatorio" | "proibido";
  links: LinkEsperado[];
  whatsapp: string;
  voz: { frases: string[]; palavras: string[] };
  proibido: { depoimento?: boolean; frases?: string[] };
  precosPermitidos: number[];
  visual: { presets: string[]; accent: string; distanciaMax?: number };
};

const PESOS: Record<IdCriterio, number> = {
  ofertas: 2,
  links: 1.5,
  voz: 1.5,
  inventado: 2,
  visual: 1,
  exemplo: 1,
  check: 1,
};

const NOMES: Record<IdCriterio, string> = {
  ofertas: "Fidelidade de ofertas",
  links: "Links",
  voz: "Voz",
  inventado: "Nada inventado",
  visual: "Visual",
  exemplo: "Nada do exemplo",
  check: "Check verde",
};

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function canais(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = (i: number) => Number.parseInt(h.slice(i, i + 2), 16);
  return [n(0), n(2), n(4)];
}

/** Distância euclidiana entre duas cores #rrggbb (0 = iguais, ~442 = preto e branco). */
export function distanciaCor(a: string, b: string): number {
  const [r1, g1, b1] = canais(a);
  const [r2, g2, b2] = canais(b);
  if ([r1, g1, b1, r2, g2, b2].some((n) => Number.isNaN(n))) return Number.POSITIVE_INFINITY;
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

export function normalizarUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "");
    return `${u.hostname.replace(/^www\./, "").toLowerCase()}${path}${u.search}`;
  } catch {
    return norm(url).replace(/\/+$/, "");
  }
}

function visitar(no: unknown, fn: (valor: unknown, chave?: string) => void, chave?: string): void {
  fn(no, chave);
  if (Array.isArray(no)) {
    for (const item of no) visitar(item, fn);
    return;
  }
  if (no && typeof no === "object") {
    for (const [k, v] of Object.entries(no)) visitar(v, fn, k);
  }
}

function comoLista(config: unknown, chave: string): Record<string, unknown>[] {
  const v = (config as Record<string, unknown>)[chave];
  if (!Array.isArray(v)) return [];
  return v.filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
}

function temBloco(config: unknown, type: string): boolean {
  return comoLista(config, "blocks").some((b) => b.type === type && b.enabled !== false);
}

function corpusDe(config: unknown): string {
  const partes: string[] = [];
  visitar(config, (valor) => {
    if (typeof valor !== "string") return;
    if (/^https?:\/\//i.test(valor) || valor.startsWith("/")) return;
    partes.push(valor);
  });
  return norm(partes.join("\n"));
}

function temFrase(corpus: string, frase: string): boolean {
  return corpus.includes(norm(frase));
}

function temPalavra(corpus: string, palavra: string): boolean {
  const p = norm(palavra).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${p}([^a-z0-9]|$)`).test(corpus);
}

function temUrl(config: unknown, url: string): boolean {
  const alvo = normalizarUrl(url);
  const achadas: string[] = [];
  visitar(config, (valor) => {
    if (typeof valor === "string" && /^https?:\/\//i.test(valor)) achadas.push(valor);
  });
  return achadas.some((u) => normalizarUrl(u) === alvo);
}

function precosDe(config: unknown): number[] {
  const out: number[] = [];
  visitar(config, (valor, chave) => {
    if (chave === "price_cents" && typeof valor === "number") out.push(valor);
  });
  return out;
}

function nota10(fracao: number): number {
  return Math.round(fracao * 100) / 10;
}

function media(partes: boolean[]): number {
  if (partes.length === 0) return 1;
  return partes.filter(Boolean).length / partes.length;
}

function ofertaBate(o: Record<string, unknown>, esp: OfertaEsperada): boolean {
  const titulo = norm(String(o.title ?? ""));
  if (!titulo.includes(norm(esp.titulo))) return false;
  if (typeof esp.precoCentavos === "number" && o.price_cents !== esp.precoCentavos) return false;
  if (esp.precoCentavos === null && o.price_cents !== undefined) return false;
  if (esp.url && normalizarUrl(String(o.url ?? "")) !== normalizarUrl(esp.url)) return false;
  return true;
}

function pontuarOfertas(config: unknown, esp: Esperado): { fracao: number; detalhes: string[] } {
  const offers = comoLista(config, "offers");
  const usados = new Set<number>();
  const ok: boolean[] = [];
  const falhas: string[] = [];
  if (esp.ofertas.length === 0) {
    const max = esp.maxOfertas ?? 0;
    const dentro = offers.length <= max;
    ok.push(dentro);
    if (!dentro) falhas.push(`esperava no máximo ${max} oferta(s) e a config tem ${offers.length}`);
  } else {
    for (const item of esp.ofertas) {
      const i = offers.findIndex((o, idx) => !usados.has(idx) && ofertaBate(o, item));
      if (i >= 0) usados.add(i);
      ok.push(i >= 0);
      if (i < 0) falhas.push(`oferta "${item.titulo}" não está com o título, o preço e o link da coleta`);
    }
    if (esp.maxOfertas !== undefined) {
      const dentro = offers.length <= esp.maxOfertas;
      ok.push(dentro);
      if (!dentro) falhas.push(`${offers.length} oferta(s), acima do máximo ${esp.maxOfertas}`);
    }
  }
  if (esp.maxCatalogo !== undefined) {
    const n = comoLista(config, "catalog").length;
    const dentro = n <= esp.maxCatalogo;
    ok.push(dentro);
    if (!dentro) falhas.push(`catálogo com ${n} item(ns); o máximo é ${esp.maxCatalogo}`);
  }
  const concierge = temBloco(config, "concierge");
  if (esp.concierge === "proibido") {
    ok.push(!concierge);
    if (concierge) falhas.push("concierge presente; com uma oferta ou nenhuma ele sai");
  }
  if (esp.concierge === "obrigatorio") {
    ok.push(concierge);
    if (!concierge) falhas.push("concierge ausente com duas ofertas ou mais");
  }
  return { fracao: media(ok), detalhes: falhas.length ? falhas : ["ofertas fiéis à coleta"] };
}

function pontuarLinks(config: unknown, esp: Esperado): { fracao: number; detalhes: string[] } {
  const falhas: string[] = [];
  const acertos = esp.links.filter((l) => {
    const urlOk = temUrl(config, l.url);
    const tituloOk = !l.titulo || temFrase(corpusDe(config), l.titulo);
    if (!urlOk) falhas.push(`link ausente: ${l.url}`);
    else if (!tituloOk) falhas.push(`link ${l.url} sem o título "${l.titulo}"`);
    return urlOk && tituloOk;
  }).length;
  const wa = (config as { contact?: { whatsapp?: string } }).contact?.whatsapp === esp.whatsapp;
  if (!wa) falhas.push(`WhatsApp diferente de ${esp.whatsapp}`);
  const fracaoUrls = esp.links.length ? acertos / esp.links.length : 1;
  const fracao = esp.links.length ? fracaoUrls * 0.7 + (wa ? 0.3 : 0) : wa ? 1 : 0;
  return { fracao, detalhes: falhas.length ? falhas : ["links e WhatsApp preservados"] };
}

function pontuarVoz(config: unknown, esp: Esperado): { fracao: number; detalhes: string[] } {
  const corpus = corpusDe(config);
  const falhas: string[] = [];
  let total = 0;
  let acertos = 0;
  for (const frase of esp.voz.frases) {
    total++;
    if (temFrase(corpus, frase)) acertos++;
    else falhas.push(`frase ausente: "${frase}"`);
  }
  for (const palavra of esp.voz.palavras) {
    total++;
    if (temPalavra(corpus, palavra)) acertos++;
    else falhas.push(`palavra ausente: "${palavra}"`);
  }
  return { fracao: total ? acertos / total : 1, detalhes: falhas.length ? falhas : ["voz da coleta presente"] };
}

function pontuarInventado(config: unknown, esp: Esperado): { fracao: number; detalhes: string[] } {
  const corpus = corpusDe(config);
  const permitidos = new Set(esp.precosPermitidos);
  const ruins = precosDe(config).filter((p) => !permitidos.has(p));
  const depoimento = esp.proibido.depoimento === true && temBloco(config, "testimonials");
  const frases = (esp.proibido.frases ?? []).filter((f) => temFrase(corpus, f));
  const falhas: string[] = [];
  if (ruins.length) falhas.push(`preço que não está na coleta: ${ruins.join(", ")} centavos`);
  if (depoimento) falhas.push("depoimento na página sem fonte na coleta");
  for (const f of frases) falhas.push(`frase inventada: "${f}"`);
  const fracao = media([ruins.length === 0, !depoimento, frases.length === 0]);
  return { fracao, detalhes: falhas.length ? falhas : ["nada inventado"] };
}

function pontuarVisual(config: unknown, esp: Esperado): { fracao: number; detalhes: string[] } {
  const theme = (config as { theme?: { preset?: string; accent?: string } }).theme ?? {};
  const preset = theme.preset ?? "";
  const accent = theme.accent ?? "";
  const max = esp.visual.distanciaMax ?? 40;
  const presetOk = esp.visual.presets.includes(preset);
  const dist = accent ? distanciaCor(accent, esp.visual.accent) : Number.POSITIVE_INFINITY;
  const corOk = dist <= max;
  const falhas: string[] = [];
  if (!presetOk) falhas.push(`modelo "${preset || "(vazio)"}" fora de ${esp.visual.presets.join(", ")}`);
  if (!corOk) {
    const quanto = Number.isFinite(dist) ? String(Math.round(dist)) : "longe demais";
    falhas.push(`cor ${accent || "(vazia)"} está a ${quanto} de ${esp.visual.accent} (máximo ${max})`);
  }
  return {
    fracao: media([presetOk, corOk]),
    detalhes: falhas.length ? falhas : [`modelo ${preset}, cor a ${Math.round(dist)} de ${esp.visual.accent}`],
  };
}

function criterio(id: IdCriterio, fracao: number, detalhes: string[]): Criterio {
  const peso = PESOS[id];
  return { id, nome: NOMES[id], nota: nota10(fracao), peso, pontos: fracao * peso, detalhes };
}

function validarSchema(config: unknown): { ok: boolean; problemas: string[]; config: unknown } {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return { ok: false, problemas: ["a config não é um objeto"], config };
  }
  try {
    const data = defineConfig(config as Parameters<typeof defineConfig>[0]);
    return { ok: true, problemas: [], config: data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const linhas = msg
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("-"));
    return { ok: false, problemas: linhas.length ? linhas : [msg], config };
  }
}

export async function avaliarSetup(caso: string, caminhoConfig: string, raiz = process.cwd()): Promise<Relatorio> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(caso)) throw new Error(`caso inválido: ${caso}`);
  const pasta = join(raiz, "tests/fixtures/eval", caso);
  const esperadoPath = join(pasta, "esperado.json");
  if (!existsSync(esperadoPath)) throw new Error(`não achei o caso "${caso}"`);
  const esperado = JSON.parse(readFileSync(esperadoPath, "utf8")) as Esperado;
  const arquivo = resolve(raiz, caminhoConfig);
  if (!existsSync(arquivo)) throw new Error(`não achei a config em ${caminhoConfig}`);
  const bruto = arquivo.endsWith(".json")
    ? (JSON.parse(readFileSync(arquivo, "utf8")) as unknown)
    : ((await import(pathToFileURL(arquivo).href)).default ?? null);
  const schema = validarSchema(bruto);
  const alvo = schema.config;
  const achados = await executarCheck(alvo);
  const erros = achados.filter((a) => a.sev === "erro").map((a) => a.msg);
  const avisos = achados.filter((a) => a.sev === "aviso").map((a) => a.msg);
  const checkOk = schema.ok && erros.length === 0;
  const ofertas = pontuarOfertas(alvo, esperado);
  const links = pontuarLinks(alvo, esperado);
  const voz = pontuarVoz(alvo, esperado);
  const inventado = pontuarInventado(alvo, esperado);
  const visual = pontuarVisual(alvo, esperado);
  const campos = camposDoExemplo(alvo);
  const exemplo = {
    fracao: campos.length ? 0 : 1,
    detalhes: campos.length ? campos.slice(0, 8) : ["nenhum conteúdo do exemplo"],
  };
  const check = {
    fracao: checkOk ? 1 : 0,
    detalhes: checkOk ? ["schema válido e check sem erro"] : [...schema.problemas, ...erros].slice(0, 12),
  };
  const criterios = [
    criterio("ofertas", ofertas.fracao, ofertas.detalhes),
    criterio("links", links.fracao, links.detalhes),
    criterio("voz", voz.fracao, voz.detalhes),
    criterio("inventado", inventado.fracao, inventado.detalhes),
    criterio("visual", visual.fracao, visual.detalhes),
    criterio("exemplo", exemplo.fracao, exemplo.detalhes),
    criterio("check", check.fracao, check.detalhes),
  ];
  const nota = Math.round(criterios.reduce((s, c) => s + c.pontos, 0) * 10) / 10;
  return {
    caso,
    config: caminhoConfig,
    nota,
    criterios,
    schema: { ok: schema.ok, problemas: schema.problemas },
    check: { ok: checkOk, erros, avisos },
  };
}

function formatar(rel: Relatorio): string {
  const n = (v: number) => v.toFixed(1).replace(".", ",");
  const linhas = [
    `Eval do setup — ${rel.caso}`,
    `Config: ${rel.config}`,
    `Nota: ${n(rel.nota)}/10`,
    "",
  ];
  for (const c of rel.criterios) {
    linhas.push(`${c.nome} (peso ${n(c.peso)}): ${n(c.nota)}/10`);
    for (const d of c.detalhes) linhas.push(`  - ${d}`);
    linhas.push("");
  }
  return linhas.join("\n").trimEnd();
}

async function cli(): Promise<void> {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const pos = args.filter((a) => !a.startsWith("--"));
  const caso = pos[0];
  const config = pos[1];
  if (!caso || !config) {
    console.error("Uso: npm run eval:setup -- <caso> <caminho-da-config> [--json]");
    process.exit(2);
  }
  try {
    const rel = await avaliarSetup(caso, config);
    console.log(json ? JSON.stringify(rel, null, 2) : formatar(rel));
    process.exit(rel.nota >= 8 ? 0 : 1);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(2);
  }
}

const ehCli = process.argv[1]?.endsWith("eval-setup.ts") || process.argv[1]?.endsWith("eval-setup.js");
if (ehCli) void cli();
