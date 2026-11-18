/**
 * npm run instagram -- @perfil                      (com APIFY_TOKEN no .env.local: busca os últimos posts)
 * npm run instagram -- @perfil reel/ABC p/DEF ...   (sem Apify: os códigos dos posts, mais novo primeiro)
 *
 * Grava os últimos posts do Instagram em public/instagram/: uma imagem .webp por post (3:4) e o
 * posts.json que o bloco "instagram" lê. O Instagram não deixa a página buscar ao vivo, então é uma
 * foto do feed: rode de novo e publique (commit + deploy) para atualizar.
 * Sem Apify, a legenda de um post que já estava no posts.json é mantida; post novo entra sem legenda
 * (o texto alternativo vira "Reel do Instagram"): escreva a legenda no posts.json se quiser.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { coletarDireto } from "../lib/onboarding/coleta-instagram";
import { limparUsuario } from "../lib/onboarding/instagram";
import { lerVariavel } from "../lib/env-local";
import { lerFeed, type PostDoFeed } from "../lib/instagram";

const PASTA = join("public", "instagram");
const ARQUIVO = join(PASTA, "posts.json");
const LIMITE = 12;
const NAVEGADOR = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

type Novo = { codigo: string; tipo: PostDoFeed["tipo"]; url: string; legenda: string; origemImagem: string };

/** "reel/ABC", "p/ABC" ou o link do post. Devolve o código e o tipo provável. */
export function lerCodigo(entrada: string): { codigo: string; tipo: PostDoFeed["tipo"] } {
  const m = entrada.match(/(?:^|\/)(p|reel|tv)\/([A-Za-z0-9_-]{5,})/);
  if (!m) throw new Error(`"${entrada}" não parece um post (use reel/CODIGO, p/CODIGO ou o link do post).`);
  return { codigo: m[2]!, tipo: m[1] === "p" ? "imagem" : "video" };
}

function urlDoPost(codigo: string, tipo: PostDoFeed["tipo"]): string {
  return `https://www.instagram.com/${tipo === "video" ? "reel" : "p"}/${codigo}/`;
}

function tokenApify(): string | null {
  if (process.env.APIFY_TOKEN) return process.env.APIFY_TOKEN;
  if (!existsSync(".env.local")) return null;
  return lerVariavel(readFileSync(".env.local", "utf8"), "APIFY_TOKEN") || null;
}

async function pelaApify(usuario: string, token: string): Promise<Novo[]> {
  const { resultado, falhaPosts } = await coletarDireto(token, usuario);
  if (falhaPosts) throw new Error(falhaPosts);
  return resultado.posts
    .filter((p) => p.proprio && p.imagem && p.url)
    .map((p) => {
      const { codigo } = lerCodigo(p.url);
      return { codigo, tipo: p.tipo, url: urlDoPost(codigo, p.tipo), legenda: p.legenda, origemImagem: p.imagem! };
    });
}

function pelosCodigos(entradas: string[], antigo: PostDoFeed[]): Novo[] {
  return entradas.map((e) => {
    const { codigo, tipo } = lerCodigo(e);
    const ja = antigo.find((p) => p.codigo === codigo);
    const t = ja?.tipo ?? tipo;
    return {
      codigo,
      tipo: t,
      url: urlDoPost(codigo, t),
      legenda: ja?.legenda ?? "",
      origemImagem: `https://www.instagram.com/p/${codigo}/media/?size=l`,
    };
  });
}

async function baixar(url: string, destino: string): Promise<void> {
  const r = await fetch(url, { headers: { "User-Agent": NAVEGADOR }, redirect: "follow", signal: AbortSignal.timeout(30_000) });
  const tipo = r.headers.get("content-type") ?? "";
  if (!r.ok || !tipo.startsWith("image/")) throw new Error(`o Instagram respondeu ${r.status} (${tipo || "sem tipo"})`);
  const bruto = Buffer.from(await r.arrayBuffer());
  await sharp(bruto).resize(720, 960, { fit: "cover", position: "centre" }).webp({ quality: 74 }).toFile(destino);
}

async function main() {
  const [perfil, ...codigos] = process.argv.slice(2);
  if (!perfil) {
    console.error("Diga o @: npm run instagram -- @perfil (com APIFY_TOKEN) ou npm run instagram -- @perfil reel/ABC p/DEF");
    process.exit(1);
  }
  const usuario = limparUsuario(perfil);
  const antigo = existsSync(ARQUIVO) ? lerFeed(JSON.parse(readFileSync(ARQUIVO, "utf8"))) : null;
  const anteriores = antigo?.usuario === usuario ? antigo.posts : [];

  let novos: Novo[];
  if (codigos.length > 0) novos = pelosCodigos(codigos, anteriores);
  else {
    const token = tokenApify();
    if (!token) {
      console.error("Sem APIFY_TOKEN no .env.local. Passe os códigos dos posts: npm run instagram -- @perfil reel/ABC p/DEF");
      process.exit(1);
    }
    novos = await pelaApify(usuario, token);
  }
  novos = novos.slice(0, LIMITE);
  if (novos.length === 0) {
    console.error(`Nenhum post de @${usuario} para gravar. Nada mudou.`);
    process.exit(1);
  }

  mkdirSync(PASTA, { recursive: true });
  const posts: PostDoFeed[] = [];
  for (const n of novos) {
    const arquivo = `${n.codigo}.webp`;
    try {
      await baixar(n.origemImagem, join(PASTA, arquivo));
    } catch (e) {
      console.error(`Pulei ${n.codigo}: ${(e as Error).message}`);
      continue;
    }
    posts.push({ codigo: n.codigo, tipo: n.tipo, url: n.url, imagem: `/instagram/${arquivo}`, legenda: n.legenda });
  }
  if (posts.length === 0) {
    console.error("Nenhuma imagem baixou (o Instagram pode estar limitando; tente mais tarde). Nada mudou.");
    process.exit(1);
  }
  // Imagem de post que saiu da lista é apagada: o repositório não acumula feed velho.
  const ficam = new Set(posts.map((p) => `${p.codigo}.webp`));
  for (const f of readdirSync(PASTA)) if (f.endsWith(".webp") && !ficam.has(f)) rmSync(join(PASTA, f));

  writeFileSync(ARQUIVO, `${JSON.stringify({ usuario, coletadoEm: new Date().toISOString(), posts }, null, 2)}\n`);
  console.log(`${posts.length} posts de @${usuario} em ${ARQUIVO}. Publique (commit + deploy) para aparecer na bio.`);
}

if (process.argv[1]?.endsWith("instagram.ts")) main();
