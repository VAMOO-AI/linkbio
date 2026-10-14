import type { LinkbioConfig } from "../config/schema";
import type { TemaResolvido } from "./resolver";

/**
 * Capa ao compartilhar: a parte que é só lógica (sem servidor, sem imagem), para ser testada.
 * O desenho da capa fica em lib/capa.tsx; a rota em app/(site)/capa.jpg/route.tsx.
 */

/** Caminho da capa no site. JPG: foto em PNG passaria dos 300 KB que o WhatsApp aceita. */
export const CAMINHO_CAPA = "/capa.jpg";
export const TAMANHO_CAPA = { width: 1200, height: 630 } as const;
/** Acima disso o WhatsApp não mostra a capa grande (ver README, "Capa ao compartilhar"). */
export const LIMITE_CAPA_BYTES = 300 * 1024;

/** Proporção da capa (1200 / 630, ~1,91:1): a do cartão grande do WhatsApp, Facebook e Telegram. */
export const PROPORCAO_CAPA = TAMANHO_CAPA.width / TAMANHO_CAPA.height;
/**
 * Quanto a proporção de uma capa própria pode fugir da 1,91:1 e ainda ser recortada (10%: de ~1,71:1
 * a ~2,10:1). Nessa faixa o corte tira no máximo uns 5% de cada lado, só borda.
 */
export const TOLERANCIA_PROPORCAO = 0.1;

/**
 * Como a capa própria entra no 1200 x 630:
 * - "cobrir": proporção perto da 1,91:1, preenche tudo recortando só a borda, centralizada;
 * - "encaixar": proporção muito diferente (banner largo, quadrada, vertical), entra inteira, sem
 *   perder nada, sobre a própria imagem desfocada e escurecida.
 * Antes toda imagem era recortada: um banner 2,9:1 perdia a lateral inteira (com texto).
 */
export type Encaixe = "cobrir" | "encaixar";
export function encaixeDaCapa(largura: number, altura: number): Encaixe {
  if (!(largura > 0 && altura > 0)) return "cobrir";
  const relacao = largura / altura / PROPORCAO_CAPA;
  return relacao >= 1 - TOLERANCIA_PROPORCAO && relacao <= 1 + TOLERANCIA_PROPORCAO ? "cobrir" : "encaixar";
}

/**
 * Corta o texto em até `max` caracteres, sem partir palavra, com reticências no fim.
 * Espaços repetidos e quebras de linha viram um espaço só.
 */
export function cortarTexto(texto: string, max: number): string {
  const limpo = texto.replace(/\s+/g, " ").trim();
  if (limpo.length <= max) return limpo;
  const corte = limpo.slice(0, Math.max(1, max - 1));
  const ultimoEspaco = corte.lastIndexOf(" ");
  // Palavra única enorme: corta no meio mesmo (melhor que sumir com o texto).
  const base = ultimoEspaco > max * 0.5 ? corte.slice(0, ultimoEspaco) : corte;
  return `${base.replace(/[\s.,;:!?\-–—]+$/u, "")}…`;
}

/** Iniciais para o círculo da foto quando não há foto: "Marina Duarte" -> "MD". */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter((p) => /\p{L}|\p{N}/u.test(p));
  if (!partes.length) return "?";
  const primeira = [...partes[0]!].find((c) => /\p{L}|\p{N}/u.test(c)) ?? "";
  const ultima = partes.length > 1 ? ([...partes.at(-1)!].find((c) => /\p{L}|\p{N}/u.test(c)) ?? "") : "";
  return (primeira + ultima).toLocaleUpperCase("pt-BR") || "?";
}

/** Foto padrão do template: na capa, as iniciais ficam mais bonitas que o boneco cinza. */
export const FOTO_PADRAO = "/avatar-placeholder.svg";

/** Domínio do exemplo (o mesmo marcador do check): o site ainda não tem o endereço de verdade. */
export function ehEnderecoDoExemplo(url: string): boolean {
  try {
    return /(^|\.)exemplo\.com$/i.test(new URL(url).hostname);
  } catch {
    return true;
  }
}

export type AmbienteVercel = { VERCEL_PROJECT_PRODUCTION_URL?: string; VERCEL_URL?: string; [outra: string]: string | undefined };

/**
 * Endereço base das URLs absolutas (og:url, og:image). Vale o site.url; se ele ainda for o do
 * exemplo, a capa apontaria para um domínio que não existe e o WhatsApp mostraria o link sem capa.
 * Nesse caso usa o domínio de produção da Vercel (ou o do deploy), que o próprio site responde.
 * Não usa o endereço do pedido: isso deixaria a página dinâmica (sem cache).
 */
export function enderecoBase(siteUrl: string, env: AmbienteVercel = {}): URL {
  if (!ehEnderecoDoExemplo(siteUrl)) return new URL(siteUrl);
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL;
  if (vercel) return new URL(`https://${vercel.replace(/^https?:\/\//, "")}`);
  return new URL(siteUrl);
}

/**
 * Versão do DESENHO da capa. Suba a cada mudança no jeito de gerar a imagem (lib/capa.tsx): ela entra no
 * `?v=` e obriga WhatsApp, Facebook e CDN a buscar a imagem de novo mesmo sem mudança de conteúdo.
 * 2 = capa própria de outro formato entra inteira, sem recorte (v0.4.1).
 */
export const DESENHO_DA_CAPA = 2;

/** Resumo curto (FNV-1a) do que aparece na capa e de como ela é desenhada: muda a URL da imagem quando a capa muda. */
export function versaoDaCapa(config: LinkbioConfig): string {
  const { name, handle, bio, avatar } = config.profile;
  const texto = JSON.stringify([DESENHO_DA_CAPA, name, handle, bio, avatar, config.theme, config.site.share ?? null]);
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Capa própria enviada pelo painel, se houver. */
export function capaPropria(config: LinkbioConfig): string | null {
  return config.site.share?.image ?? null;
}

export type Compartilhar = {
  titulo: string;
  descricao: string;
  url: string;
  nomeDoSite: string;
  imagem: { url: string; width: number; height: number; alt: string; type: string };
};

/** Título e texto do cartão do link: os próprios (site.share) ou nome e @ e a bio. O painel usa na prévia. */
export function textosDoLink(
  profile: { name: string; handle: string; bio: string },
  share?: { title?: string; description?: string } | null,
): { titulo: string; descricao: string } {
  return { titulo: share?.title || `${profile.name} ${profile.handle}`, descricao: share?.description || profile.bio };
}

/**
 * Link da bio com um final que muda junto com a capa (`/?v=<versão>`). O WhatsApp guarda a prévia de
 * cada link pelo texto exato: um final novo faz ele buscar a capa de novo. A página ignora o `?v`.
 */
export function linkComPreviaNova(base: string, versao: string): string {
  const u = new URL("/", base);
  u.searchParams.set("v", versao);
  return u.toString();
}

/** Título, texto, link e imagem do cartão do link. Capa própria e textos próprios têm prioridade. */
export function dadosDeCompartilhar(config: LinkbioConfig, base: URL): Compartilhar {
  const { name, handle } = config.profile;
  const share = config.site.share;
  const { titulo, descricao } = textosDoLink(config.profile, share);
  const alt = share?.image ? (share.title ?? `Capa de ${name} (${handle})`) : `Foto, nome e bio de ${name} (${handle})`;
  return {
    titulo,
    descricao,
    url: new URL("/", base).toString(),
    nomeDoSite: name,
    imagem: {
      url: new URL(`${CAMINHO_CAPA}?v=${versaoDaCapa(config)}`, base).toString(),
      ...TAMANHO_CAPA,
      alt,
      type: "image/jpeg",
    },
  };
}

/** Modo da capa: o mesmo que a página mostra primeiro (lib/theme.ts: claro, se existir, salvo mode escuro). */
export function modoDaCapa(tema: Pick<TemaResolvido, "mode" | "paletas">): "claro" | "escuro" {
  return tema.mode === "escuro" || !tema.paletas.claro ? "escuro" : "claro";
}

/**
 * Imagem que o servidor pode baixar para desenhar a capa: só do Storage do Supabase (o mesmo que o
 * check e o next.config.ts liberam). Qualquer outra URL fica de fora (o servidor não sai buscando
 * endereço arbitrário).
 */
export function podeBaixar(url: string, supabaseUrl?: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" && !(supabaseUrl && u.origin === new URL(supabaseUrl).origin)) return false;
  if (!u.pathname.startsWith("/storage/v1/object/public/")) return false;
  if (supabaseUrl) {
    try {
      return u.hostname === new URL(supabaseUrl).hostname;
    } catch {
      return false;
    }
  }
  return u.hostname.endsWith(".supabase.co");
}
