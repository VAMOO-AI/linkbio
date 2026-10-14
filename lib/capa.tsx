import "server-only";
import { readFile } from "node:fs/promises";
import { join, normalize, sep } from "node:path";
import { ImageResponse } from "next/og";
import sharp, { type Sharp } from "sharp";
import type { LinkbioConfig } from "@/config/schema";
import type { Paleta } from "@/config/presets";
import {
  FOTO_PADRAO,
  LIMITE_CAPA_BYTES,
  TAMANHO_CAPA,
  capaPropria,
  cortarTexto,
  encaixeDaCapa,
  iniciais,
  modoDaCapa,
  podeBaixar,
  type Encaixe,
} from "./compartilhar";
import { resolverTema, type TemaResolvido } from "./resolver";
import { lerSupabase } from "./supabase-chave";
import { accentFill, accentTexto } from "./theme";

/**
 * Desenho da capa ao compartilhar (1200 x 630, JPG). Duas saídas:
 * - capa própria (site.share.image): a imagem enviada, recortada se a proporção for perto da 1,91:1,
 *   senão inteira sobre ela mesma desfocada (lib/compartilhar.ts, encaixeDaCapa);
 * - capa automática: foto redonda, nome, @ e bio no visual do modelo (cores, fonte, fundo).
 * O conteúdo fica no miolo (~760 px): onde o WhatsApp corta em quadrado, nome e foto continuam lá.
 */

const { width: W, height: H } = TAMANHO_CAPA;

// Fontes do catálogo (config/opcoes.ts > font) em arquivo local: o ImageResponse não usa a fonte do
// next/font e o build não pode depender da rede. Licença OFL: assets/fonts/OFL-*.txt.
const PASTA_FONTES = join(process.cwd(), "assets", "fonts");
const arquivosDeFonte = [
  { name: "jakarta", arquivo: "PlusJakartaSans-Regular.ttf", weight: 400 },
  { name: "jakarta", arquivo: "PlusJakartaSans-Bold.ttf", weight: 700 },
  { name: "serif", arquivo: "InstrumentSerif-Regular.ttf", weight: 400 },
  { name: "grotesk", arquivo: "SpaceGrotesk-Regular.ttf", weight: 400 },
  { name: "grotesk", arquivo: "SpaceGrotesk-Bold.ttf", weight: 700 },
  { name: "bricolage", arquivo: "BricolageGrotesque-ExtraBold.ttf", weight: 800 },
] as const;
let fontes: Promise<{ name: string; data: Buffer; weight: 400 | 700 | 800; style: "normal" }[]> | null = null;
function carregarFontes() {
  fontes ??= Promise.all(
    arquivosDeFonte.map(async (f) => ({
      name: f.name,
      data: await readFile(join(PASTA_FONTES, f.arquivo)),
      weight: f.weight,
      style: "normal" as const,
    })),
  );
  return fontes;
}

/** Peso e espaçamento do título por fonte (os mesmos de lib/theme.ts). */
const TITULO = {
  jakarta: { peso: 700, tracking: -0.02 },
  serif: { peso: 400, tracking: -0.01 },
  grotesk: { peso: 700, tracking: -0.03 },
  bricolage: { peso: 800, tracking: -0.03 },
} as const;

type FonteDaCapa = keyof typeof TITULO;
/**
 * A capa só tem arquivo das 4 fontes originais (o zip não cresce com 14 fontes a mais). As outras do
 * catálogo usam a mais parecida aqui; a página usa a fonte exata.
 */
const PARECIDA: Record<string, FonteDaCapa> = {
  lora: "serif", playfair: "serif", fraunces: "serif",
  mono: "grotesk", sora: "grotesk", archivo: "grotesk", syne: "bricolage",
};
const naCapa = (k: string): FonteDaCapa => (k in TITULO ? (k as FonteDaCapa) : (PARECIDA[k] ?? "jakarta"));

/** Até 8 MB baixados; mais que isso não é foto de perfil. */
const MAX_DOWNLOAD = 8 * 1024 * 1024;

/**
 * Bytes da imagem da config: arquivo de public/ ou URL do Storage do Supabase. Falha (arquivo
 * ausente, fora do ar, lento, outro site) devolve null e a capa segue sem ela.
 */
export async function lerImagem(src: string): Promise<Buffer | null> {
  try {
    if (src.startsWith("/")) {
      const publico = join(process.cwd(), "public");
      const caminho = normalize(join(publico, src));
      if (!caminho.startsWith(publico + sep)) return null;
      return await readFile(caminho);
    }
    if (!podeBaixar(src, lerSupabase(process.env)?.url)) return null;
    const r = await fetch(src, { signal: AbortSignal.timeout(5000), cache: "no-store" });
    if (!r.ok) return null;
    const corpo = Buffer.from(await r.arrayBuffer());
    return corpo.length > 0 && corpo.length <= MAX_DOWNLOAD ? corpo : null;
  } catch {
    return null;
  }
}

/** Foto em PNG quadrado (qualquer formato de entrada, SVG e WebP inclusive) para embutir na capa. */
async function fotoQuadrada(bytes: Buffer, lado: number): Promise<string | null> {
  try {
    const png = await sharp(bytes, { density: 300 }).resize(lado, lado, { fit: "cover", position: "attention" }).png().toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

/** JPG abaixo do limite do WhatsApp: baixa a qualidade até caber. */
async function paraJpg(entrada: Sharp): Promise<Buffer> {
  const base = await entrada.toBuffer();
  let ultimo = base;
  for (const quality of [88, 80, 72, 64, 56]) {
    ultimo = await sharp(base).jpeg({ quality, mozjpeg: true, chromaSubsampling: quality >= 80 ? "4:4:4" : "4:2:0" }).toBuffer();
    if (ultimo.length <= LIMITE_CAPA_BYTES) return ultimo;
  }
  return ultimo;
}

const rgba = (hex: string, a: number) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

/** Detalhe de marca: o fundo do modelo (onda, degradê, pontos ou liso), discreto. */
function Fundo({ tema, pal, accent }: { tema: TemaResolvido; pal: Paleta; accent: string }) {
  const cheio = { position: "absolute", top: 0, left: 0, width: W, height: H, display: "flex" } as const;
  if (tema.background === "gradiente") {
    return (
      <div style={{ ...cheio, backgroundImage: `radial-gradient(70% 80% at 50% -8%, ${rgba(accent, 0.42)}, ${rgba(accent, 0)} 70%)` }} />
    );
  }
  if (tema.background === "pontos") {
    // Grade de pontos em SVG (o padrão de fundo do CSS não passa pelo ImageResponse).
    const pontos: React.ReactNode[] = [];
    for (let y = 11; y < H; y += 22) for (let x = 11; x < W; x += 22) pontos.push(<circle key={`${x}-${y}`} cx={x} cy={y} r={1.8} />);
    return (
      <div style={cheio}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill={rgba(pal.text, 0.18)}>
          {pontos}
        </svg>
      </div>
    );
  }
  if (tema.background === "onda") {
    return (
      <div style={{ ...cheio, backgroundImage: `linear-gradient(180deg, ${rgba(accent, 0.12)}, ${rgba(accent, 0)} 60%)` }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", top: 0, left: 0 }}>
          <path d={`M0 520 C 240 470, 420 590, 640 545 S 1020 470, 1200 520 L 1200 630 L 0 630 Z`} fill={rgba(accent, 0.1)} />
          <path d={`M0 575 C 260 540, 460 625, 700 590 S 1040 545, 1200 580 L 1200 630 L 0 630 Z`} fill={rgba(accent, 0.14)} />
        </svg>
      </div>
    );
  }
  // liso: moldura fina, como papel impresso.
  return (
    <div style={cheio}>
      <div style={{ position: "absolute", top: 28, left: 28, width: W - 56, height: H - 56, border: `2px solid ${pal.line}`, display: "flex" }} />
      <div style={{ position: "absolute", bottom: 28, left: W / 2 - 60, width: 120, height: 6, backgroundColor: accent, display: "flex" }} />
    </div>
  );
}

/** Capa automática no visual do modelo, como elemento do ImageResponse. */
function CapaAutomatica({ config, tema, modo, foto }: { config: LinkbioConfig; tema: TemaResolvido; modo: "claro" | "escuro"; foto: string | null }) {
  const pal = tema.paletas[modo]!;
  const accent = tema.accent[modo];
  const corDoAt = accentTexto(accent, pal);
  const display = naCapa(tema.font.display);
  const titulo = TITULO[display];
  const nome = cortarTexto(config.profile.name, 34);
  const tamNome = nome.length <= 16 ? 78 : nome.length <= 24 ? 64 : 52;
  const bio = cortarTexto(config.profile.bio, 118);
  const brutal = tema.buttons === "brutal";
  const lado = 208;
  const aro = brutal
    ? { border: `6px solid ${pal.text}`, boxShadow: `10px 10px 0 ${pal.text}` }
    : { border: `6px solid ${accent}`, boxShadow: `0 0 0 10px ${rgba(accent, 0.16)}` };
  return (
    <div
      style={{
        width: W,
        height: H,
        display: "flex",
        position: "relative",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pal.bg,
        color: pal.text,
        fontFamily: naCapa(tema.font.body),
      }}
    >
      <Fundo tema={tema} pal={pal} accent={accent} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 820 }}>
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element -- ImageResponse só entende <img>.
          <img src={foto} width={lado} height={lado} alt="" style={{ borderRadius: lado, ...aro }} />
        ) : (
          <div
            style={{
              width: lado,
              height: lado,
              borderRadius: lado,
              backgroundColor: accentFill(accent),
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: display,
              fontWeight: titulo.peso,
              fontSize: 84,
              ...aro,
            }}
          >
            {iniciais(config.profile.name)}
          </div>
        )}
        <div
          style={{
            marginTop: 30,
            fontFamily: display,
            fontWeight: titulo.peso,
            fontSize: tamNome,
            letterSpacing: tamNome * titulo.tracking,
            lineHeight: 1.05,
            textAlign: "center",
            color: pal.text,
          }}
        >
          {nome}
        </div>
        <div style={{ marginTop: 10, fontSize: 34, fontWeight: 700, color: corDoAt }}>{cortarTexto(config.profile.handle, 32)}</div>
        <div
          style={{
            marginTop: 18,
            fontSize: 30,
            lineHeight: 1.35,
            color: pal.dim,
            textAlign: "center",
            maxWidth: 760,
            lineClamp: 3,
          }}
        >
          {bio}
        </div>
      </div>
    </div>
  );
}

/** Lado maior com que a capa própria é trabalhada: banner de 6000 px não precisa passar inteiro. */
const LADO_DE_TRABALHO = 2400;

/**
 * Capa própria em 1200 x 630 sem perder conteúdo (ver encaixeDaCapa). Fundo branco no lugar da
 * transparência (o JPG não tem). Erro se os bytes não forem imagem.
 */
export async function capaDeImagem(bytes: Buffer): Promise<{ corpo: Buffer; encaixe: Encaixe; largura: number; altura: number }> {
  // Tamanho de verdade (com a orientação da câmera aplicada): é o que o painel mostra. Sem a
  // densidade alta, que só serve para o SVG sair nítido (e multiplicaria o tamanho dele).
  const meta = await sharp(bytes).metadata();
  const deitada = (meta.orientation ?? 1) >= 5;
  const largura = (deitada ? meta.height : meta.width) ?? 0;
  const altura = (deitada ? meta.width : meta.height) ?? 0;
  // Gira pela orientação da câmera (EXIF) antes de medir: foto vertical do celular vem "deitada".
  const plano = await sharp(bytes, { density: 300 })
    .rotate()
    .resize(LADO_DE_TRABALHO, LADO_DE_TRABALHO, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .png()
    .toBuffer({ resolveWithObject: true });
  const encaixe = encaixeDaCapa(plano.info.width, plano.info.height);
  if (encaixe === "cobrir") {
    const corpo = await paraJpg(sharp(plano.data).resize(W, H, { fit: "cover", position: "centre" }));
    return { corpo, encaixe, largura, altura };
  }
  // Fundo: as cores da própria imagem cobrindo tudo, tão desfocadas que nenhum texto dela se lê
  // (reduz a 16 x 8, amplia e desfoca), e escurecidas para a imagem inteira se destacar na frente.
  // As sobras parecem continuação da imagem, não faixa de cor chapada nem conteúdo repetido.
  const fundo = await sharp(plano.data)
    .resize(16, 8, { fit: "cover", position: "centre" })
    .resize(W, H, { kernel: "cubic" })
    .blur(40)
    .modulate({ brightness: 0.55, saturation: 0.85 })
    .toBuffer();
  const frente = await sharp(plano.data).resize(W, H, { fit: "inside" }).toBuffer({ resolveWithObject: true });
  const capa = sharp(fundo).composite([
    { input: frente.data, left: Math.round((W - frente.info.width) / 2), top: Math.round((H - frente.info.height) / 2) },
  ]);
  return { corpo: await paraJpg(capa), encaixe, largura, altura };
}

export type Capa = {
  corpo: Buffer;
  tipo: "image/jpeg";
  /** "propria" só quando a imagem de site.share abriu; se não abriu, vale a automática. */
  origem: "propria" | "automatica";
  /** Como a capa própria entrou (e o tamanho original dela). */
  encaixe?: Encaixe;
  largura?: number;
  altura?: number;
};

/**
 * Gera a capa da config. `modo` força claro ou escuro (as amostras usam); sem ele, vale o modo que a
 * página mostra primeiro.
 */
export async function gerarCapa(config: LinkbioConfig, opcoes: { modo?: "claro" | "escuro" } = {}): Promise<Capa> {
  const propria = capaPropria(config);
  if (propria) {
    const bytes = await lerImagem(propria);
    if (bytes) {
      try {
        const c = await capaDeImagem(bytes);
        return { corpo: c.corpo, tipo: "image/jpeg", origem: "propria", encaixe: c.encaixe, largura: c.largura, altura: c.altura };
      } catch {
        // Arquivo que não é imagem: segue para a capa automática.
      }
    }
  }
  const tema = resolverTema(config.theme);
  const modo = opcoes.modo && tema.paletas[opcoes.modo] ? opcoes.modo : modoDaCapa(tema);
  const avatar = config.profile.avatar;
  const bytesFoto = avatar === FOTO_PADRAO ? null : await lerImagem(avatar);
  const foto = bytesFoto ? await fotoQuadrada(bytesFoto, 416) : null;
  const png = new ImageResponse(<CapaAutomatica config={config} tema={tema} modo={modo} foto={foto} />, {
    ...TAMANHO_CAPA,
    fonts: await carregarFontes(),
  });
  const bytes = Buffer.from(await png.arrayBuffer());
  return { corpo: await paraJpg(sharp(bytes)), tipo: "image/jpeg", origem: "automatica" };
}
