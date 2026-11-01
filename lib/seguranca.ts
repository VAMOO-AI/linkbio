import { idsEfetivos, type AmbientePixel } from "./pixel";
import { lerSupabase } from "./supabase-chave";

/**
 * Cabeçalhos de segurança de toda rota, com a Content-Security-Policy (CSP): a lista fechada de
 * sites de onde a página pode carregar script, conectar e abrir iframe.
 *
 * Decisões (v0.13.0):
 * - Aplicada, não Report-Only. Report-Only sem endpoint de relatório não protege nem avisa ninguém, e o
 *   que poderia quebrar está coberto: imagem aceita qualquer https (o schema aceita URL https em foto,
 *   galeria, capa do vídeo e fundo), estilo aceita inline, e os sites dos pixels vêm da documentação
 *   oficial de cada um. O e2e (e2e/seguranca.spec.ts) reprova qualquer violação nas páginas.
 * - `script-src` com 'unsafe-inline', sem nonce nem hash. A bio é estática (ISR até o /admin publicar):
 *   nonce exige página dinâmica a cada visita (o guia de CSP do Next diz o mesmo), e o Next injeta
 *   ~25 scripts inline (`self.__next_f.push`) cujo conteúdo muda a cada publicação, então hash não cobre.
 *   O ganho real fica em `connect-src`, `frame-src`, `object-src`, `base-uri` e `form-action`: um script
 *   injetado não carrega código de outro site nem manda dado para fora da lista.
 * - O cabeçalho sai no build (next.config.ts), mas a config publicada pelo /admin muda sem build. Por
 *   isso, com o painel ligado (Supabase), os três pixels entram sempre: ligar o Clarity no painel não
 *   pode ser bloqueado pela CSP. Sem painel, só entra o pixel com ID no arquivo ou no ambiente.
 * - Bloco novo que carrega algo de outro site (iframe, script, fetch direto) entra aqui (skill novo-bloco).
 */

export type PixelsNaPolitica = { meta: boolean; ga4: boolean; clarity: boolean };

/** Imagem fica de fora: `img-src` já aceita qualquer https (o /tr da Meta e o pixel do GA4 entram por aí). */
type Fornecedor = { script: string[]; connect: string[]; frame?: string[] };

/** Meta: https://developers.facebook.com/docs/meta-pixel/ (fbevents.js e o /tr de coleta). */
const META: Fornecedor = {
  script: ["https://connect.facebook.net"],
  connect: ["https://connect.facebook.net", "https://www.facebook.com"],
};

/**
 * GA4: https://developers.google.com/tag-platform/security/guides/csp ("Google Analytics", com os
 * recursos de anúncios, que o guia recomenda já listar; *.google.<TLD> vai um por domínio, aqui .com.br).
 */
const GA4: Fornecedor = {
  script: ["https://www.googletagmanager.com"],
  connect: [
    "https://www.googletagmanager.com",
    "https://*.google-analytics.com",
    "https://*.analytics.google.com",
    "https://*.google.com",
    "https://*.google.com.br",
    "https://*.g.doubleclick.net",
    "https://pagead2.googlesyndication.com",
  ],
  frame: ["https://www.googletagmanager.com"],
};

/** Clarity: https://learn.microsoft.com/clarity/setup-and-installation/clarity-csp */
const CLARITY: Fornecedor = {
  script: ["https://*.clarity.ms", "https://c.bing.com"],
  connect: ["https://*.clarity.ms", "https://c.bing.com"],
};

/** Vídeo do bloco youtube: iframe sem cookies, só depois do toque na capa. */
const YOUTUBE = "https://www.youtube-nocookie.com";

/**
 * Quais pixels a política libera. Painel ligado: os três (ver acima). Sem painel: os que têm ID válido
 * no arquivo ou no ambiente, pela mesma regra da página (idsEfetivos).
 */
export function pixelsNaPolitica(
  pixel: Parameters<typeof idsEfetivos>[0],
  env: AmbientePixel,
): PixelsNaPolitica {
  if (lerSupabase(env)) return { meta: true, ga4: true, clarity: true };
  const ids = idsEfetivos(pixel, env);
  return { meta: ids.meta !== null, ga4: ids.ga4 !== null, clarity: ids.clarity !== null };
}

/**
 * A política em uma linha. `dev`: o React usa eval e o recarregamento usa WebSocket só no `npm run dev`.
 * `frame-ancestors 'self'`: só o próprio site abre a página num iframe (a prévia do /admin).
 * `form-action 'self'`: o formulário de contato posta em /api/lead e volta para /contato/enviado.
 */
export function politicaDeConteudo({
  pixels,
  dev,
  supabase = null,
}: {
  pixels: PixelsNaPolitica;
  dev: boolean;
  /** Origem do Supabase: as imagens do painel vêm do Storage dele (já coberto por https:, salvo em teste local http). */
  supabase?: string | null;
}): string {
  const ligados = [pixels.meta && META, pixels.ga4 && GA4, pixels.clarity && CLARITY].filter((p): p is Fornecedor => Boolean(p));
  const de = (chave: "script" | "connect" | "frame") => [...new Set(ligados.flatMap((p) => p[chave] ?? []))];
  const diretivas: [string, string[]][] = [
    ["default-src", ["'self'"]],
    ["script-src", ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : []), ...de("script")]],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", ["'self'", "data:", "blob:", "https:", ...(supabase && !supabase.startsWith("https:") ? [supabase] : [])]],
    ["font-src", ["'self'", "data:"]],
    ["connect-src", ["'self'", ...(dev ? ["ws:"] : []), ...de("connect")]],
    ["frame-src", ["'self'", YOUTUBE, ...de("frame")]],
    ["media-src", ["'self'"]],
    ["worker-src", ["'self'", "blob:"]],
    ["manifest-src", ["'self'"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", ["'self'"]],
  ];
  return diretivas.map(([nome, valores]) => `${nome} ${valores.join(" ")}`).join("; ");
}

/** Origem do Supabase do ambiente (`https://xyz.supabase.co`), ou null sem painel. */
export function origemDoSupabase(env: Record<string, string | undefined>): string | null {
  const url = lerSupabase(env)?.url;
  try {
    return url ? new URL(url).origin : null;
  } catch {
    return null;
  }
}

/** Todos os cabeçalhos de segurança. Entra no next.config.ts para toda rota. */
export function cabecalhosDeSeguranca(entrada: Parameters<typeof politicaDeConteudo>[0]) {
  return [
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    { key: "Content-Security-Policy", value: politicaDeConteudo(entrada) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), usb=(), interest-cohort=()" },
  ];
}
