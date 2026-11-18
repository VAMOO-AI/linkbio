/**
 * npm run youtube -- @canal                 (últimos vídeos do canal, pelo feed público, sem chave)
 * npm run youtube -- @canal --sem ID ...    (deixa de fora os vídeos com esses ids)
 *
 * Grava os últimos vídeos em public/youtube/: uma capa .webp por vídeo (16:9) e o videos.json que o
 * bloco "videos" lê. A página não busca ao vivo (mais leve e sem depender do YouTube no carregamento),
 * então é uma foto do canal: rode de novo e publique (commit + deploy) para atualizar.
 */
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import type { VideoDoCanal } from "../lib/youtube";

const PASTA = join("public", "youtube");
const ARQUIVO = join(PASTA, "videos.json");
const NAVEGADOR = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

/** "@canal", "canal" ou o link do canal. Devolve só o nome, sem @. */
export function lerCanalDaEntrada(entrada: string): string {
  const m = entrada.trim().match(/^(?:https?:\/\/(?:www\.|m\.)?youtube\.com\/)?@?([A-Za-z0-9._-]{3,30})\/?$/);
  if (!m) throw new Error(`"${entrada}" não parece um canal (use @canal ou o link youtube.com/@canal).`);
  return m[1]!;
}

function desescapar(t: string): string {
  return t
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Lê o feed Atom do canal (youtube.com/feeds/videos.xml). */
export function lerFeed(xml: string): Omit<VideoDoCanal, "imagem">[] {
  const entradas = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
  const videos: Omit<VideoDoCanal, "imagem">[] = [];
  for (const e of entradas) {
    const id = e.match(/<yt:videoId>([A-Za-z0-9_-]{11})<\/yt:videoId>/)?.[1];
    const titulo = e.match(/<title>([\s\S]*?)<\/title>/)?.[1];
    const publicado = e.match(/<published>(\d{4}-\d{2}-\d{2})/)?.[1];
    const link = e.match(/<link rel="alternate" href="([^"]+)"/)?.[1] ?? "";
    if (!id || !titulo || !publicado) continue;
    const short = link.includes("/shorts/");
    videos.push({
      id,
      titulo: desescapar(titulo).trim(),
      publicado,
      url: short ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`,
      short,
    });
  }
  return videos;
}

async function buscarTexto(url: string): Promise<string> {
  const r = await fetch(url, { headers: { "User-Agent": NAVEGADOR, "Accept-Language": "pt-BR" }, signal: AbortSignal.timeout(30_000) });
  if (!r.ok) throw new Error(`o YouTube respondeu ${r.status} em ${url}`);
  return r.text();
}

async function idDoCanal(nome: string): Promise<string> {
  const html = await buscarTexto(`https://www.youtube.com/@${nome}`);
  const id = html.match(/"externalId":"(UC[A-Za-z0-9_-]{22})"/)?.[1] ?? html.match(/"channelId":"(UC[A-Za-z0-9_-]{22})"/)?.[1];
  if (!id) throw new Error(`não achei o canal @${nome} no YouTube.`);
  return id;
}

async function baixarCapa(id: string, destino: string): Promise<void> {
  for (const tamanho of ["maxresdefault", "hqdefault"]) {
    const r = await fetch(`https://i.ytimg.com/vi/${id}/${tamanho}.jpg`, { signal: AbortSignal.timeout(30_000) });
    if (!r.ok) continue;
    const bruto = Buffer.from(await r.arrayBuffer());
    await sharp(bruto).resize(640, 360, { fit: "cover", position: "centre" }).webp({ quality: 74 }).toFile(destino);
    return;
  }
  throw new Error("sem capa no YouTube");
}

async function main() {
  const args = process.argv.slice(2);
  const i = args.indexOf("--sem");
  const sem = new Set(i >= 0 ? args.slice(i + 1) : []);
  const entrada = (i >= 0 ? args.slice(0, i) : args)[0];
  if (!entrada) {
    console.error("Diga o canal: npm run youtube -- @canal");
    process.exit(1);
  }
  const nome = lerCanalDaEntrada(entrada);
  const canalId = await idDoCanal(nome);
  const lidos = lerFeed(await buscarTexto(`https://www.youtube.com/feeds/videos.xml?channel_id=${canalId}`)).filter((v) => !sem.has(v.id));
  if (lidos.length === 0) {
    console.error(`Nenhum vídeo de @${nome} para gravar. Nada mudou.`);
    process.exit(1);
  }

  mkdirSync(PASTA, { recursive: true });
  const videos: VideoDoCanal[] = [];
  for (const v of lidos) {
    const arquivo = `${v.id}.webp`;
    try {
      await baixarCapa(v.id, join(PASTA, arquivo));
    } catch (e) {
      console.error(`Pulei ${v.id}: ${(e as Error).message}`);
      continue;
    }
    videos.push({ ...v, imagem: `/youtube/${arquivo}` });
  }
  if (videos.length === 0) {
    console.error("Nenhuma capa baixou (tente mais tarde). Nada mudou.");
    process.exit(1);
  }
  // Capa de vídeo que saiu da lista é apagada: o repositório não acumula feed velho.
  const ficam = new Set(videos.map((v) => `${v.id}.webp`));
  if (existsSync(PASTA)) for (const f of readdirSync(PASTA)) if (f.endsWith(".webp") && !ficam.has(f)) rmSync(join(PASTA, f));

  writeFileSync(ARQUIVO, `${JSON.stringify({ canal: nome.toLowerCase(), coletadoEm: new Date().toISOString(), videos }, null, 2)}\n`);
  const longos = videos.filter((v) => !v.short).length;
  console.log(`${videos.length} vídeos de @${nome} (${longos} vídeos e ${videos.length - longos} Shorts) em ${ARQUIVO}. Publique (commit + deploy) para aparecer na bio.`);
}

if (process.argv[1]?.endsWith("youtube.ts")) main();
