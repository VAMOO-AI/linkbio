/**
 * npm run analisar -- --instagram @perfil [--site https://...] [--bio-atual https://linktr.ee/...]
 *
 * Coleta o que é público da própria pessoa e grava em analise/ (fora do git e do zip):
 *   instagram.json      perfil + últimos 15 posts (Apify, com o token da pessoa)
 *   foto.jpg            foto do perfil (a skill pergunta antes de usar)
 *   links.json          links da bio atual (Linktree e afins), achada sozinha no perfil ou passada
 *   site.json           cores, fontes, logo e textos do site
 *   logo.*, capa.*      logo e imagem de compartilhar do site (a skill pergunta antes de usar)
 *   site-computador.png, site-celular.png   fotos do site (com o navegador de teste), para ver a marca
 *   posts/1.jpg ...     imagens dos últimos posts próprios (até 6), para ver a marca no Instagram
 *   site-sugerido.json  site que o perfil aponta, quando --site não foi passado
 * Cada fonte pedida apaga antes os arquivos dela: dado de uma rodada errada não sobra.
 * Quem escreve a bio na voz da pessoa é o Claude, lendo estes arquivos.
 *
 * Acesso ao Instagram: APIFY_TOKEN (no ambiente ou no .env.local). Sem ele, a skill segue no modo manual.
 * Leva até uns 4 minutos no pior caso: rode com tempo limite de 10 minutos.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { ferramentaDeBio, lerBioAtual, type BioAtual } from "../lib/onboarding/bio-atual";
import { coletarDireto } from "../lib/onboarding/coleta-instagram";
import { coresDaImagem } from "../lib/onboarding/cores-foto";
import { limparUsuario, type ResultadoInstagram } from "../lib/onboarding/instagram";
import { corParaHex, lerCss, lerHtml, type LeituraCss, type LeituraHtml } from "../lib/onboarding/site";
import { lerVariavel } from "../lib/env-local";

const PASTA = "analise";
const NAVEGADOR = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
const MAX_CSS = 1_500_000;

function env(k: string): string {
  if (process.env[k]) return process.env[k]!.trim();
  return existsSync(".env.local") ? lerVariavel(readFileSync(".env.local", "utf8"), k) : "";
}

function argumento(nome: string): string | undefined {
  const i = process.argv.indexOf(`--${nome}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  return v && !v.startsWith("--") ? v : undefined;
}

/** "linktr.ee/ana" e "www.site.com" viram https://; "http://" fica como está. */
export function comEsquema(url: string): string {
  const t = url.trim();
  return /^https?:\/\//i.test(t) ? t : `https://${t.replace(/^\/+/, "")}`;
}

/** Erro técnico (em inglês, do Node) vira frase para leigo. */
export function explicarErro(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/aborted due to timeout|TimeoutError/i.test(msg)) return "Demorou demais para responder.";
  if (/Failed to parse URL|Invalid URL/i.test(msg)) return "O endereço parece incompleto ou errado.";
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|ECONNRESET|EAI_AGAIN/i.test(msg)) return "Não consegui abrir o endereço (confira se está certo e se há internet).";
  return /[.!?)]$/.test(msg) ? msg : `${msg}.`;
}

function gravar(nome: string, dados: unknown) {
  mkdirSync(PASTA, { recursive: true });
  writeFileSync(join(PASTA, nome), `${JSON.stringify(dados, null, 2)}\n`);
}

function apagar(...nomes: string[]) {
  for (const n of nomes) rmSync(join(PASTA, n), { force: true });
}

async function baixarTexto(url: string, limite = MAX_CSS): Promise<string> {
  const r = await fetch(url, { headers: { "User-Agent": NAVEGADOR, Accept: "text/html,text/css,*/*" }, redirect: "follow", signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error(`${url} respondeu ${r.status}`);
  return (await r.text()).slice(0, limite);
}

async function baixarImagem(url: string, nome: string): Promise<string | null> {
  try {
    const r = await fetch(url, { headers: { "User-Agent": NAVEGADOR }, signal: AbortSignal.timeout(20_000) });
    if (!r.ok) return null;
    const dados = Buffer.from(await r.arrayBuffer());
    const tipo = r.headers.get("content-type") ?? "";
    // SVG e ícone não servem de foto na bio (só JPG, PNG ou WebP): viram PNG.
    if (/svg|icon/.test(tipo) || /\.(svg|ico)(\?|$)/i.test(url)) {
      const arquivo = `${nome}.png`;
      await sharp(dados, { density: 300 }).resize(800, 800, { fit: "inside" }).png().toFile(join(PASTA, arquivo));
      return arquivo;
    }
    const ext = /png/.test(tipo) ? "png" : /webp/.test(tipo) ? "webp" : "jpg";
    const arquivo = `${nome}.${ext}`;
    writeFileSync(join(PASTA, arquivo), dados);
    return arquivo;
  } catch {
    return null;
  }
}

// Redes, encurtadores, checkout e agenda: não são "o site da pessoa".
const NAO_E_SITE =
  /(^|\.)(instagram|facebook|fb|tiktok|youtube|youtu|x|twitter|threads|linkedin|wa|whatsapp|t|telegram|pinterest|spotify|bit|tinyurl|cutt|short|rebrand|hotmart|kiwify|eduzz|monetizze|sympla|calendly)\.(com|me|be|net|ee|ly|gy|link|com\.br|org)$/i;

export function classificarLinks(links: { url: string }[]) {
  let bioAtual: string | undefined;
  let site: string | undefined;
  for (const l of links) {
    let host: string;
    try {
      host = new URL(l.url).hostname.replace(/^www\./, "");
    } catch {
      continue;
    }
    if (ferramentaDeBio(l.url)) bioAtual ??= l.url;
    else if (!site && !NAO_E_SITE.test(host)) site = l.url;
  }
  return { bioAtual, site };
}

// ---------- navegador (Playwright): páginas que só montam no navegador ou barram robô ----------

// Texto puro de propósito: o tsx injeta funções auxiliares que não existem dentro da página.
// Fundo: o primeiro não transparente entre html, body, main e o primeiro bloco. Botão: o maior
// botão colorido visível no começo da página (não o do menu nem o dos cookies).
const LER_ESTILOS = `(() => {
  const cs = (el, prop) => (el ? getComputedStyle(el).getPropertyValue(prop) : "");
  // Translúcido (alfa abaixo de 0,5, ex.: vidro do cabeçalho) não é a cor da marca.
  const alfa = (c) => { const m = /rgba?\\(([^)]*)\\)/.exec(c || ""); if (!m) return 1; const p = m[1].split(/[\\s,\\/]+/).filter(Boolean); return p.length > 3 ? parseFloat(p[3]) : 1; };
  const transparente = (c) => !c || c === "transparent" || alfa(c) < 0.5;
  // Degradê: as cores do background-image (ex.: botão dourado em degradê).
  const degrade = (el) => { const b = cs(el, "background-image"); return b && b.includes("gradient") ? (b.match(/rgba?\\([^)]*\\)/g) || []).filter((c) => alfa(c) >= 0.5).slice(0, 3) : []; };
  const corDe = (el) => { const c = cs(el, "background-color"); if (!transparente(c)) return c; return degrade(el)[0] || ""; };
  const candidatos = [document.documentElement, document.body, document.querySelector("main"),
    document.querySelector("body > div"), document.querySelector("section")];
  let fundo = "";
  for (const el of candidatos) { const c = cs(el, "background-color"); if (!transparente(c)) { fundo = c; break; } }
  const area = (el) => { const r = el.getBoundingClientRect(); return r.width * r.height; };
  const visivel = (el) => { const r = el.getBoundingClientRect(); return r.width > 60 && r.height > 24 && r.top < innerHeight * 1.5; };
  const botoes = [...document.querySelectorAll("a, button, [role='button']")]
    .filter((el) => visivel(el) && corDe(el) && el.textContent.trim().length > 1)
    // Fora: atalhos de acessibilidade ("Pular para o conteúdo") e âncoras da própria página.
    .filter((el) => !/^#/.test(el.getAttribute("href") || "") && !/pular para|skip to/i.test(el.textContent))
    .sort((a, b) => area(b) - area(a));
  const botao = botoes[0];
  const titulo = document.querySelector("h1") || document.querySelector("h2");
  return {
    fundo, texto: cs(document.body, "color"),
    fonteTexto: cs(document.body, "font-family"), fonteTitulo: cs(titulo, "font-family"), corTitulo: cs(titulo, "color"),
    botaoFundo: botao ? corDe(botao) : "", botaoTexto: cs(botao, "color"), botaoCanto: cs(botao, "border-radius"),
    botaoDegrade: botao ? degrade(botao).join(" ") : "",
    botaoRotulo: botao ? botao.textContent.trim().slice(0, 60) : "",
  };
})()`;

type Estilos = Record<string, string>;
type Renderizado = { html: string; estilos: Estilos };

/** Abre a página no navegador de teste; com `fotos`, grava a 1ª dobra no computador e no celular. */
async function renderizar(url: string, fotos?: string): Promise<Renderizado | null> {
  try {
    const { chromium } = await import("@playwright/test");
    const navegador = await chromium.launch();
    try {
      const pagina = await navegador.newPage({ userAgent: NAVEGADOR, viewport: { width: 1280, height: 800 } });
      await pagina.goto(url, { waitUntil: "load", timeout: 30_000 });
      await pagina.waitForTimeout(2_500);
      const estilos = (await pagina.evaluate(LER_ESTILOS)) as Estilos;
      const html = await pagina.content();
      if (fotos) {
        mkdirSync(PASTA, { recursive: true });
        await pagina.screenshot({ path: join(PASTA, `${fotos}-computador.png`) });
        const celular = await navegador.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
        await celular.goto(url, { waitUntil: "load", timeout: 30_000 });
        await celular.waitForTimeout(2_000);
        await celular.screenshot({ path: join(PASTA, `${fotos}-celular.png`) });
      }
      return { html, estilos };
    } finally {
      await navegador.close();
    }
  } catch (e) {
    const msg = (e as Error).message ?? "";
    console.log(
      /Executable doesn't exist|install/i.test(msg)
        ? "  Navegador de teste não instalado. Para instalar: npx playwright install chromium (1 a 2 min) e rode de novo."
        : `  Leitura com navegador falhou: ${explicarErro(e)}`,
    );
    return null;
  }
}

/** Cores do renderizado em hex (o tema só aceita hex); o resto como veio. */
export function estilosEmHex(e: Estilos): Estilos {
  const saida: Estilos = { ...e };
  for (const k of ["fundo", "texto", "corTitulo", "botaoFundo", "botaoTexto"]) {
    if (e[k]) saida[k] = corParaHex(e[k]) ?? "";
  }
  if (e.botaoDegrade) saida.botaoDegrade = (e.botaoDegrade.match(/rgba?\([^)]*\)/g) ?? []).map((c) => corParaHex(c) ?? "").filter(Boolean).join(" ");
  return saida;
}

// ---------- fontes de dados ----------

async function instagram(usuario: string): Promise<ResultadoInstagram | null> {
  // links.json sai junto: a bio atual é achada a partir deste perfil.
  apagar("instagram.json", "foto.jpg", "site-sugerido.json", "links.json");
  rmSync(join(PASTA, "posts"), { recursive: true, force: true });
  const token = env("APIFY_TOKEN");
  if (!token) {
    console.log("Instagram: SEM ACESSO (falta o APIFY_TOKEN no .env.local). Use o modo manual.");
    return null;
  }
  console.log(`Instagram: buscando @${usuario} na Apify (leva até 1 minuto)...`);
  const { resultado: ig, falhaPosts } = await coletarDireto(token, usuario);
  let coresDaFoto: string[] = [];
  if (ig.foto) {
    try {
      const r = await fetch(ig.foto, { signal: AbortSignal.timeout(20_000) });
      if (r.ok) {
        writeFileSync(join(PASTA, "foto.jpg"), Buffer.from(await r.arrayBuffer()));
        coresDaFoto = await coresDaImagem(join(PASTA, "foto.jpg"));
      }
    } catch {
      /* sem foto: segue */
    }
  }
  gravar("instagram.json", { ...ig, coresDaFoto });
  // Imagens dos posts próprios: o Claude olha para entender a cara da marca (cores, fotos, estilo).
  const comImagem = ig.posts.filter((p) => p.proprio && p.imagem).slice(0, 6);
  let baixadas = 0;
  for (const [i, p] of comImagem.entries()) {
    try {
      const r = await fetch(p.imagem!, { signal: AbortSignal.timeout(20_000) });
      if (!r.ok) continue;
      mkdirSync(join(PASTA, "posts"), { recursive: true });
      await sharp(Buffer.from(await r.arrayBuffer())).resize(720, 720, { fit: "inside" }).jpeg({ quality: 80 }).toFile(join(PASTA, "posts", `${i + 1}.jpg`));
      baixadas++;
    } catch {
      /* imagem que não baixou: segue */
    }
  }
  const proprios = ig.posts.filter((p) => p.proprio && p.legenda).length;
  const deOutros = ig.posts.filter((p) => !p.proprio);
  const autores = [...new Set(deOutros.map((p) => `@${p.autor}`))];
  console.log(`Instagram: ok. ${ig.nome || ig.usuario}, ${ig.posts.length} posts (${proprios} com legenda própria), ${ig.links.length} link(s) no perfil, ${baixadas} imagem(ns) de post.`);
  if (falhaPosts) console.log(`  Aviso: o perfil veio, os posts não (${explicarErro(falhaPosts)}) Rode de novo daqui a pouco ou peça 3 a 5 legendas.`);
  if (deOutros.length) console.log(`  ${deOutros.length} post(s) em parceria escritos por ${autores.join(", ")}. Pergunte se é a pessoa quem escreve nessa(s) conta(s) antes de usar para a voz.`);
  if (ig.privado) console.log("  Aviso: perfil PRIVADO, os posts não aparecem. A voz vai ficar mais genérica: peça 3 a 5 legendas.");
  else if (!falhaPosts && proprios < 5 && !deOutros.length) console.log("  Aviso: poucas legendas próprias. Peça mais 2 ou 3 textos que a pessoa escreveu.");
  return ig;
}

async function bioAtual(url: string): Promise<boolean> {
  apagar("links.json");
  console.log(`Bio atual: lendo ${url} ...`);
  let b: BioAtual | null = null;
  try {
    b = lerBioAtual(await baixarTexto(url), url);
  } catch (e) {
    console.log(`  Leitura simples falhou (${explicarErro(e)}) Tentando pelo navegador...`);
  }
  if (!b || b.links.length === 0) {
    const r = await renderizar(url);
    if (r) b = lerBioAtual(r.html, url);
  }
  if (!b || b.links.length === 0) {
    console.log("Bio atual: nenhum link encontrado. Use os links do perfil do Instagram ou peça a lista à pessoa.");
    return false;
  }
  gravar("links.json", b);
  console.log(`Bio atual: ok. ${b.ferramenta}, ${b.links.length} link(s).`);
  return true;
}

async function site(url: string): Promise<boolean> {
  apagar("site.json", "logo.png", "logo.jpg", "logo.webp", "capa.png", "capa.jpg", "capa.webp", "site-computador.png", "site-celular.png");
  console.log(`Site: lendo ${url} ...`);
  let leitura: LeituraHtml | null = null;
  try {
    leitura = lerHtml(await baixarTexto(url, 3_000_000), url);
  } catch (e) {
    // Anti-robô (403, 503) ou fora do ar para o download simples: o navegador ainda pode abrir.
    console.log(`  Leitura simples falhou (${explicarErro(e)}) Tentando pelo navegador...`);
  }
  // Sempre tenta o navegador: as fotos do site e o estilo de verdade (fundo, botão) valem muito para o
  // visual. Sem navegador instalado, segue só com a leitura simples.
  const renderizado: Renderizado | null = await renderizar(url, "site");
  if (renderizado) {
    const r = lerHtml(renderizado.html, url);
    // Fica com a leitura que trouxe mais conteúdo (o navegador vence em site que monta na tela).
    const maisTexto = !leitura || r.titulos.length + r.textos.length >= leitura.titulos.length + leitura.textos.length;
    leitura = leitura
      ? { ...leitura, ...(maisTexto ? { titulos: r.titulos, textos: r.textos, links: r.links } : {}), logos: leitura.logos.length ? leitura.logos : r.logos, precisaNavegador: false }
      : { ...r, precisaNavegador: false };
  }
  if (!leitura) throw new Error("O site não abriu nem pelo navegador.");
  const cssTextos = [leitura.estilosInternos];
  for (const folha of leitura.folhas.slice(0, 5)) {
    try {
      cssTextos.push(await baixarTexto(folha));
    } catch {
      /* folha fora do ar: segue */
    }
  }
  const css: LeituraCss = lerCss(cssTextos.join("\n"));
  const logo = leitura.logos[0] ? await baixarImagem(leitura.logos[0], "logo") : null;
  const capa = leitura.ogImagem ? await baixarImagem(leitura.ogImagem, "capa") : null;
  const semCss: Partial<LeituraHtml> = { ...leitura };
  delete semCss.estilosInternos;
  gravar("site.json", {
    url,
    ...semCss,
    css,
    renderizado: renderizado ? estilosEmHex(renderizado.estilos) : null,
    arquivos: { logo: logo ? `analise/${logo}` : null, capa: capa ? `analise/${capa}` : null },
  });
  console.log(`Site: ok. ${css.cores.length} cores, ${css.fontes.length + leitura.fontesGoogle.length} fonte(s), ${leitura.titulos.length} títulos, ${leitura.textos.length} textos${logo ? ", logo" : ""}.`);
  if (renderizado) console.log("  Fotos do site: analise/site-computador.png e analise/site-celular.png.");
  else console.log("  Sem fotos do site (navegador de teste indisponível): o visual fica só pelos números. Para melhorar: npx playwright install chromium e rode de novo.");
  if (leitura.precisaNavegador) console.log("  Aviso: o site monta o conteúdo no navegador e a leitura com navegador não deu certo. Os textos ficaram de fora.");
  return true;
}

async function main() {
  const igArg = argumento("instagram");
  const siteArg = argumento("site");
  let bioArg = argumento("bio-atual");
  if (!igArg && !siteArg && !bioArg) {
    console.error("Uso: npm run analisar -- --instagram @perfil [--site https://...] [--bio-atual https://...]");
    process.exit(2);
  }
  let falhas = 0;
  let feitos = 0;
  const tentar = async (nome: string, f: () => Promise<boolean>) => {
    try {
      if (await f()) feitos++;
    } catch (e) {
      falhas++;
      const dica = nome === "Instagram" ? " Confira o @; se estiver certo, siga no modo manual." : "";
      console.log(`${nome}: FALHOU. ${explicarErro(e)}${dica}`);
    }
  };

  // Instagram e site ao mesmo tempo; a bio atual depende do que o Instagram achar.
  const tarefaSite = siteArg ? tentar("Site", () => site(comEsquema(siteArg))) : Promise.resolve();
  if (igArg) {
    await tentar("Instagram", async () => {
      const ig = await instagram(limparUsuario(igArg));
      if (!ig) return false;
      const achados = classificarLinks(ig.links);
      bioArg ??= achados.bioAtual;
      if (!siteArg && achados.site) {
        gravar("site-sugerido.json", { perfil: ig.usuario, url: achados.site });
        console.log(`  O perfil aponta para ${achados.site}. Confirme com a pessoa se é o site dela antes de ler.`);
      }
      return true;
    });
  }
  if (bioArg) {
    const alvo = comEsquema(bioArg);
    await tentar("Bio atual", () => bioAtual(alvo));
  }
  await tarefaSite;

  console.log(feitos ? `Pronto: ${feitos} fonte(s) em ${PASTA}/.` : "Nada coletado: siga no modo manual.");
  process.exit(feitos === 0 && falhas > 0 ? 1 : 0);
}

if (process.argv[1]?.endsWith("analisar.ts")) main();
