/**
 * npm run check → `tsx scripts/check.ts [configPath]`
 *
 * Valida linkbio.config.ts × env × assets. Saída em PT-BR, exit ≠ 0 se quebrar.
 * Sem dependências além do Node (o schema zod é carregado se existir).
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { eventoPassou } from "../lib/agenda";
import { AVISO_CUSTO_IA } from "../lib/concierge-ia";
import { situacaoDaJanela } from "../lib/janela";
import { semAcento } from "../lib/pix";

type Sev = "erro" | "aviso";
export type AchadoCheck = { sev: Sev; msg: string };
const findings: AchadoCheck[] = [];
const erro = (msg: string) => findings.push({ sev: "erro", msg });
const aviso = (msg: string) => findings.push({ sev: "aviso", msg });

const root = resolve(process.env.LINKBIO_ROOT ?? process.cwd());
const configPath = resolve(process.argv[2] ?? join(root, "linkbio.config.ts"));

// --- env: process.env > .env.local > .env ---
function parseDotenv(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = (m[2] ?? "").trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
    const key = m[1] ?? "";
    if (key) out[key] = v;
  }
  return out;
}
const fileEnv = {
  ...parseDotenv(join(root, ".env")),
  ...parseDotenv(join(root, ".env.local")),
};
const env = (k: string) => process.env[k] ?? fileEnv[k] ?? "";
const has = (k: string) => env(k).trim().length > 0;

// Marcadores estáveis do linkbio.config.ts de exemplo. Aviso, não erro: o template sai com eles.
const MARCAS_DO_EXEMPLO: { teste: (v: string) => boolean; oque: string }[] = [
  { teste: (v) => v === "Marina Duarte", oque: "nome do exemplo" },
  { teste: (v) => /marina\.?exemplo/i.test(v), oque: "perfil do exemplo" },
  { teste: (v) => /(^|[/.@])exemplo\.com(?![\w.-])/i.test(v), oque: "link do exemplo (exemplo.com)" },
  { teste: (v) => v === "BEMVINDA10", oque: "cupom do exemplo" },
  { teste: (v) => v === "dQw4w9WgXcQ", oque: "vídeo do exemplo" },
  { teste: (v) => v.startsWith("Depoimento de exemplo") || v === "Nome do cliente", oque: "depoimento do exemplo" },
  { teste: (v) => v === "Nova turma em outubro", oque: "banner do exemplo" },
  { teste: (v) => v === "Respondo pessoalmente, em dias úteis", oque: "frase do exemplo" },
  {
    teste: (v) =>
      [
        "São 4 encontros semanais online, com um plano de rotina feito para você.",
        "Não. O método foi pensado para 15 minutos por dia.",
        "Sim, até 7 dias depois da compra, com reembolso integral.",
      ].includes(v),
    oque: "resposta do FAQ do exemplo",
  },
  { teste: (v) => ["/avatar-placeholder.svg", "/gallery-1.svg", "/gallery-2.svg"].includes(v), oque: "imagem de exemplo" },
];

/** Campos que ainda são do exemplo (Marina Duarte e afins). A frase é a mesma do aviso do check. */
export function camposDoExemplo(config: unknown): string[] {
  const doExemplo: string[] = [];
  function procurarExemplo(no: unknown, onde: string) {
    if (typeof no === "string") {
      const marca = MARCAS_DO_EXEMPLO.find((m) => m.teste(no));
      if (marca) doExemplo.push(`${onde}: ${marca.oque} (${JSON.stringify(no.length > 60 ? `${no.slice(0, 57)}...` : no)})`);
      return;
    }
    if (Array.isArray(no)) return no.forEach((v, i) => procurarExemplo(v, `${onde}[${i}]`));
    if (no && typeof no === "object") {
      for (const [k, v] of Object.entries(no)) procurarExemplo(v, onde ? `${onde}.${k}` : k);
    }
  }
  procurarExemplo(config, "");
  return doExemplo;
}

// --- carrega a config ---
async function conferir(config: any): Promise<void> {
// --- validação via schema zod, se existir ---
let schemaValidado = false;
try {
  const schemaMod = await import(
    pathToFileURL(join(root, "config", "schema.ts")).href
  );
  const candidato = [
    "LinkbioConfigSchema",
    "linkbioConfigSchema",
    "ConfigSchema",
    "configSchema",
    "schema",
  ]
    .map((n) => schemaMod[n])
    .find((s) => s && typeof s.safeParse === "function");
  if (candidato) {
    const r = candidato.safeParse(config);
    schemaValidado = true;
    if (!r.success) {
      for (const issue of r.error.issues) {
        erro(`config.${issue.path.join(".") || "(raiz)"}: ${issue.message}`);
      }
    }
  }
} catch {
  // sem schema — segue a validação estrutural abaixo
}
// --- contraste AA das paletas (modelo + theme.palette da config) ---
if (schemaValidado) {
  try {
    const { resolverTema, semEfeitoNoTema } = await import(pathToFileURL(join(root, "lib", "resolver.ts")).href);
    const { problemasDeContraste } = await import(pathToFileURL(join(root, "lib", "theme.ts")).href);
    const temaCfg = { preset: "neutro", ...(config.theme ?? {}) };
    // Sobra de troca de modelo: não quebra nada (o motor ignora), mas vale limpar.
    const sobras = semEfeitoNoTema(temaCfg) as { modo?: string; paletas: string[] };
    if (sobras.modo) aviso(`theme.mode "${sobras.modo}" não existe no modelo "${temaCfg.preset}" e foi ignorado (vale o modo do modelo). Pode apagar.`);
    for (const m of sobras.paletas) aviso(`theme.palette.${m} não tem efeito: o modelo "${temaCfg.preset}" não tem a versão ${m}. Pode apagar.`);
    for (const p of problemasDeContraste(resolverTema(temaCfg)) as string[]) {
      erro(`theme.palette: ${p} Escolha uma cor mais escura ou mais clara.`);
    }
  } catch (e: any) {
    aviso(`não foi possível conferir o contraste do tema: ${e?.message ?? e}`);
  }
}
if (!schemaValidado) {
  aviso(
    "schema zod não encontrado em config/schema.ts — validação parcial (só checagens estruturais)",
  );
}

// --- checagens estruturais (valem mesmo sem zod) ---
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

if (typeof config?.site?.url === "string" && !/^https:\/\//.test(config.site.url)) {
  erro(`site.url precisa ser https (atual: ${config.site.url})`);
}
// Endereço grátis da Vercel (nome.vercel.app): o nome vira o projeto na Vercel e o repositório no GitHub.
{
  let host = "";
  try {
    host = new URL(String(config?.site?.url ?? "")).hostname;
  } catch {
    /* URL inválida: o schema já acusa */
  }
  if (host.endsWith(".vercel.app")) {
    const nome = host.slice(0, -".vercel.app".length);
    if (!SLUG.test(nome) || nome.length < 3 || nome.length > 40) {
      erro(
        `site.url: o nome "${nome}" não serve como endereço da Vercel. Use de 3 a 40 letras minúsculas sem acento, números e hífen, começando e terminando com letra ou número (ex.: https://ana-nutri.vercel.app).`,
      );
    }
  }
}
if (!config?.profile?.name) erro("profile.name é obrigatório");
if (!config?.profile?.handle) erro("profile.handle é obrigatório");
const avatar: unknown = config?.profile?.avatar;
if (
  typeof avatar === "string" &&
  avatar.startsWith("/") &&
  !existsSync(join(root, "public", avatar.slice(1)))
) {
  erro(`profile.avatar: arquivo ausente em public/${avatar.slice(1)}`);
}

const wa: string = config?.contact?.whatsapp ?? "";
if (!/^\d{8,15}$/.test(wa)) {
  erro(
    `contact.whatsapp precisa ser só dígitos, com DDI (ex.: 5511987654321; atual: ${wa || "(vazio)"})`,
  );
}

const offers: any[] = Array.isArray(config?.offers) ? config.offers : [];
const offerIds = new Set<string>();
for (const o of offers) {
  if (typeof o?.id !== "string" || !SLUG.test(o.id)) {
    erro(`offer com id instável — use slug minúsculo com hífens (atual: ${JSON.stringify(o?.id)})`);
  } else if (offerIds.has(o.id)) {
    erro(`offer.id duplicado: ${o.id}`);
  } else {
    offerIds.add(o.id);
  }
  if (o?.url && !/^https:\/\//.test(o.url)) {
    erro(`offer "${o.id}": url externa precisa ser https (atual: ${o.url})`);
  }
  if (
    o?.price_cents !== undefined &&
    (!Number.isInteger(o.price_cents) || o.price_cents < 0)
  ) {
    erro(`offer "${o.id}": price_cents precisa ser inteiro ≥ 0 (atual: ${JSON.stringify(o.price_cents)})`);
  }
}

// --- imagem de outro site ---
// next/image só carrega imagem externa do Storage do Supabase deste projeto (next.config.ts). Imagem de
// qualquer outro host passa no schema, mas quebra a página no ar ("hostname is not configured").
const PUBLICO_STORAGE = "/storage/v1/object/public/";
const urlSupabase = (env("SUPABASE_URL") || env("NEXT_PUBLIC_SUPABASE_URL")).trim();
const chaveSupabase = (env("SUPABASE_SERVICE_ROLE_KEY") || env("SUPABASE_SECRET_KEY")).trim();
let hostSupabase = "";
try {
  hostSupabase = urlSupabase ? new URL(urlSupabase).hostname : "";
} catch {
  // Endereço inválido: sem host liberado (o next.config.ts também não libera nenhum).
}
function imagemExternaOk(v: string): boolean {
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return false;
  }
  if (!u.pathname.startsWith(PUBLICO_STORAGE)) return false;
  // Com SUPABASE_URL, só o host dele (é o único que o next.config.ts libera). Sem ele no env do check,
  // não dá para saber o projeto: aceita qualquer *.supabase.co.
  return hostSupabase ? u.hostname === hostSupabase : u.hostname.endsWith(".supabase.co");
}
function conferirImagem(v: unknown, onde: string) {
  if (typeof v !== "string" || !/^https?:\/\//i.test(v) || imagemExternaOk(v)) return;
  erro(
    `${onde}: imagem de outro site (${v}) quebra a página: o site só carrega imagem da pasta public/ ou enviada pelo painel. ` +
      `Salve o arquivo em public/ e use o caminho (ex.: "/foto.jpg"), ou envie a imagem pelo painel /admin.`,
  );
}
conferirImagem(avatar, "profile.avatar");
// Capa própria do link (site.share.image): mesmas regras da foto.
const capa: unknown = config?.site?.share?.image;
if (typeof capa === "string" && capa.startsWith("/") && !existsSync(join(root, "public", capa.slice(1)))) {
  erro(`site.share.image: arquivo ausente em public/${capa.slice(1)}`);
}
conferirImagem(capa, "site.share.image");

// Percorre blocos: URLs http, assets locais, imagens de outro site, refs de oferta, concierge.
const blocks: any[] = Array.isArray(config?.blocks) ? config.blocks : [];
let conciergeIa = false;
let temAgenda = false;
let temLead = false;
function visitar(no: any, onde: string) {
  if (Array.isArray(no)) {
    no.forEach((v, i) => visitar(v, `${onde}[${i}]`));
    return;
  }
  if (!no || typeof no !== "object") return;
  for (const [k, v] of Object.entries(no)) {
    if (k === "url" && typeof v === "string" && /^http:\/\//.test(v)) {
      erro(`${onde}.${k}: URL externa precisa ser https (atual: ${v})`);
    }
    if (
      (k === "avatar" || k === "image" || k === "cover" || k === "poster" || k === "src") &&
      typeof v === "string" &&
      v.startsWith("/") &&
      !existsSync(join(root, "public", v.slice(1)))
    ) {
      erro(`${onde}.${k}: arquivo ausente em public/${v.slice(1)}`);
    }
    if (k === "avatar" || k === "image" || k === "cover" || k === "poster" || k === "src") {
      conferirImagem(v, `${onde}.${k}`);
    }
    if (k === "images" && Array.isArray(v)) {
      for (const img of v) {
        // gallery usa [{ src, alt }]; outros blocos podem usar strings
        const arq = typeof img === "string" ? img : img?.src;
        // Objeto { src }: o src já é conferido quando o percurso desce nele.
        if (typeof img === "string") conferirImagem(img, `${onde}.images`);
        if (
          typeof arq === "string" &&
          arq.startsWith("/") &&
          !existsSync(join(root, "public", arq.slice(1)))
        ) {
          erro(`${onde}.images: arquivo ausente em public/${arq.slice(1)}`);
        }
      }
    }
    // A oferta de cada resposta do concierge é conferida pelo schema (config/schema.ts), com o passo no texto.
    if (k === "offer_id" && typeof v === "string" && !offerIds.has(v)) {
      erro(`${onde}.${k}: offer inexistente ("${v}")`);
    }
    visitar(v, `${onde}.${k}`);
  }
}
const catalog: any[] = Array.isArray(config?.catalog) ? config.catalog : [];
const catalogIds = new Set<string>(catalog.map((p) => p?.id).filter((id) => typeof id === "string"));
const fuso = typeof config?.site?.tz === "string" && config.site.tz ? config.site.tz : "America/Sao_Paulo";
const agora = new Date();
blocks.forEach((b, i) => {
  if (b?.type === "concierge" && b?.mode === "ia") conciergeIa = true;
  // title/cta/wa de uma resposta só valem em resposta que decide o final e sem offer: fora disso são
  // ignorados em silêncio. Decide: a 1ª pergunta; com decide "ultima", também resposta com reason.
  if (b?.type === "concierge" && Array.isArray(b?.flow)) {
    const ultima = b?.decide === "ultima";
    b.flow.forEach((passo: any, j: number) => {
      (Array.isArray(passo?.options) ? passo.options : []).forEach((op: any, k: number) => {
        const extras = ["title", "cta", "wa"].filter((c) => op?.[c] !== undefined);
        if (!extras.length) return;
        const onde = `blocks[${i}].flow[${j}].options[${k}]`;
        if (j > 0 && !ultima) aviso(`${onde}: ${extras.join(", ")} só vale na 1ª pergunta do concierge (ou com decide "ultima"); aqui é ignorado`);
        else if (op?.offer !== undefined) aviso(`${onde}: ${extras.join(", ")} só vale em resposta sem offer; com offer "${op.offer}" é ignorado`);
        else if (j > 0 && op?.reason === undefined) aviso(`${onde}: ${extras.join(", ")} só vale em resposta com reason (sem reason ela não muda o final); aqui é ignorado`);
      });
    });
  }
  if (b?.type === "agenda") temAgenda = true;
  if (b?.type === "lead" && b?.enabled !== false) temLead = true;
  if (b?.type === "agenda" && Array.isArray(b.items) && b.items.length > 0) {
    const tz = typeof config?.site?.tz === "string" ? config.site.tz : "America/Sao_Paulo";
    try {
      const algumFuturo = b.items.some(
        (ev: { date?: string; time?: string; duration?: number }) =>
          typeof ev?.date === "string" && !eventoPassou({ date: ev.date, time: ev.time, duration: ev.duration }, tz),
      );
      if (!algumFuturo) {
        aviso(
          `blocks[${i}]: todos os eventos da agenda já passaram. A página não mostra nenhum. Troque as datas ou apague o bloco. A página é estática: o evento some na próxima publicação ou na atualização de hora em hora.`,
        );
      }
    } catch {
      aviso(`blocks[${i}]: não consegui usar o fuso "${tz}" para saber se o evento da agenda já passou.`);
    }
  }
  if (b?.type === "pix") {
    for (const campo of ["nome", "cidade"] as const) {
      const texto = b[campo];
      if (typeof texto !== "string") continue;
      const limpo = semAcento(texto);
      if (limpo && limpo !== texto) {
        aviso(`blocks[${i}]: o ${campo} "${texto}" entra no Pix sem acento, como "${limpo}".`);
      }
    }
  }
  // items só é lista de ids em cards (ofertas) e products (catálogo); em links, faq etc. são objetos.
  if (b?.type === "cards" && b?.enabled !== false && Array.isArray(b?.items) && b.items.length === 0) {
    aviso(`blocks[${i}]: bloco cards sem ofertas não aparece na página. Inclua uma oferta ou apague o bloco.`);
  }
  const refs = b?.type === "cards" ? offerIds : b?.type === "products" ? catalogIds : null;
  if (refs && Array.isArray(b?.items)) {
    for (const id of b.items) {
      if (typeof id === "string" && !refs.has(id)) {
        const onde = b.type === "cards" ? "offer_id" : "produto do catalog";
        erro(`blocks[${i}].items: referencia ${onde} inexistente ("${id}")`);
      }
    }
  }
  if (b?.type === "coupon" && typeof b?.expires === "string") {
    const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: fuso });
    if (b.expires < hoje) {
      aviso(`blocks[${i}]: cupom "${b.code}" venceu em ${b.expires}. Tire o bloco ou troque a data.`);
    }
  }
  if (b?.enabled !== false && b?.visivel && typeof b.visivel === "object" && situacaoDaJanela(b.visivel, agora, fuso) === "depois") {
    const ate = typeof b.visivel.ate === "string" ? b.visivel.ate : "";
    aviso(`blocks[${i}]: este bloco saiu do ar em ${ate}. Tire o bloco, apague a data ou empurre o prazo.`);
  }
  visitar(b, `blocks[${i}]`);
});
// Imagens também vivem fora dos blocos: capas das ofertas e fotos do catálogo.
offers.forEach((o, i) => visitar(o, `offers[${i}]`));
catalog.forEach((p, i) => visitar(p, `catalog[${i}]`));

// --- conteúdo do exemplo esquecido ---
// Aviso, não erro: o próprio template sai com o exemplo e precisa passar.
const doExemplo = camposDoExemplo(config);
if (doExemplo.length) {
  const MAX = 20;
  const linhas = doExemplo.slice(0, MAX).map((l) => `\n    - ${l}`).join("");
  const resto = doExemplo.length > MAX ? `\n    - e mais ${doExemplo.length - MAX} campo(s)` : "";
  aviso(
    `a bio ainda tem conteúdo do exemplo em ${doExemplo.length} campo(s). Troque pelo seu ou apague antes de publicar:${linhas}${resto}`,
  );
}

// --- config × env (nomes seguem .env.example) ---
const supabaseUrlOk = urlSupabase.length > 0;
const supabaseChaveOk = chaveSupabase.length > 0;
const leadsOn = config?.features?.leads === true;
const analyticsOn = config?.features?.analytics === true;
// O bloco lead ligado já é a captura. features.leads continua valendo para config antiga.
const capturaOn = leadsOn || temLead;
if (capturaOn && !supabaseUrlOk) {
  erro(
    `Supabase ligado na config (${[leadsOn && "features.leads", temLead && "bloco lead"].filter(Boolean).join(", ")}) mas SUPABASE_URL não está no env`,
  );
}
if (capturaOn && !supabaseChaveOk) {
  erro(
    "Supabase ligado na config mas SUPABASE_SERVICE_ROLE_KEY não está no env" + (temLead ? " (bloco lead)" : ""),
  );
}
if (conciergeIa) {
  if (!has("ANTHROPIC_API_KEY")) {
    erro("concierge em modo ia mas ANTHROPIC_API_KEY não está no env");
  }
  aviso(AVISO_CUSTO_IA);
}
// O ID mora na config (painel ou arquivo). META_PIXEL_ID e GA4_MEASUREMENT_ID só valem se o campo estiver vazio.
const pixelMod = await import(pathToFileURL(join(root, "lib", "pixel.ts")).href);
for (const msg of pixelMod.avisosDePixel(config?.features?.pixel, {
  META_PIXEL_ID: env("META_PIXEL_ID"),
  GA4_MEASUREMENT_ID: env("GA4_MEASUREMENT_ID"),
})) {
  aviso(msg);
}
if (capturaOn && !has("LEAD_WEBHOOK_URL") && !has("RESEND_API_KEY")) {
  aviso(
    temLead
      ? "bloco lead ligado sem LEAD_WEBHOOK_URL nem RESEND_API_KEY — os contatos ficam só no banco"
      : "features.leads ligado sem LEAD_WEBHOOK_URL nem RESEND_API_KEY — leads ficam só no Supabase",
  );
}
if (capturaOn && has("RESEND_API_KEY") && !has("LEAD_EMAIL_PARA")) {
  aviso("RESEND_API_KEY preenchida sem LEAD_EMAIL_PARA — o e-mail de contato novo não tem destinatário");
}
const apareceHoje = (b: any) => b?.enabled !== false && situacaoDaJanela(b?.visivel, agora, fuso) === "dentro";
if (blocks.length > 0 && !blocks.some(apareceHoje)) {
  aviso("nenhum bloco aparece hoje: a página vai ao ar vazia");
}

// --- cliques (features.analytics) ---
// Aviso, não erro: sem o banco a bio continua no ar, só não conta os toques.
if (analyticsOn && (!supabaseUrlOk || !supabaseChaveOk)) {
  aviso(
    "features.analytics ligado sem Supabase (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY): a contagem de cliques não grava e os botões continuam diretos",
  );
}
}

export async function executarCheck(config: any): Promise<AchadoCheck[]> {
  const anteriores = findings.splice(0, findings.length);
  try {
    await conferir(config);
    return findings.slice();
  } finally {
    findings.length = 0;
    findings.push(...anteriores);
  }
}

async function main(): Promise<void> {
let config: any = null;
try {
  const mod = await import(pathToFileURL(configPath).href);
  config = mod.default ?? mod.config ?? null;
} catch (e: any) {
  erro(`não foi possível carregar ${configPath}: ${e.message}`);
}
if (!config) {
  resumo();
  process.exit(1);
}

await conferir(config);

// Versão nova do template: só aviso. URL explícita ganha. Sem ela, consulta o versao.json
// do repositório de distribuição e, se ele não responder, a tag do remote upstream.
// LINKBIO_SEM_VERSAO=1 existe para a suíte não depender de rede. Timeout curto; falha fica em silêncio.
if (process.env.LINKBIO_SEM_VERSAO !== "1") {
  try {
    const { mensagemVersaoNova, urlDaVersaoPublicada } = await import("./versao-remota");
    const { URL_DISTRIBUICAO } = await import("../config/distribuicao");
    const versaoAtual = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version ?? "";
    const explicita = env("LINKBIO_VERSAO_URL").trim();
    const versaoUrl = explicita || urlDaVersaoPublicada(URL_DISTRIBUICAO) || "";
    const msgVersao = await mensagemVersaoNova({
      versaoAtual: String(versaoAtual),
      versaoUrl,
      root,
    });
    if (msgVersao) aviso(msgVersao);
  } catch {
    // offline ou sem o remote: o check segue
  }
}

resumo();
} // fim de main — resumo() é chamado aqui, dentro do fluxo

// --- saída ---
function resumo(): never {
  const erros = findings.filter((f) => f.sev === "erro");
  const avisos = findings.filter((f) => f.sev === "aviso");
  console.log(`linkbio check — ${configPath}`);
  for (const f of findings) {
    console.log(`${f.sev === "erro" ? "❌ [erro]" : "⚠️ [aviso]"} ${f.msg}`);
  }
  if (findings.length === 0) console.log("✔ config, env e assets consistentes");
  console.log(`Resumo: ${erros.length} erro(s), ${avisos.length} aviso(s).`);
  process.exit(erros.length > 0 ? 1 : 0);
}
const ehCli = process.argv[1]?.endsWith("check.ts") || process.argv[1]?.endsWith("check.js");
if (ehCli) {
  main().catch((e) => {
    console.error(`❌ [erro] falha inesperada no check: ${e?.message ?? e}`);
    process.exit(1);
  });
}
