/**
 * Códigos de verificação do Google Search Console e do Bing Webmaster Tools (site.verificacao).
 * A pessoa pode colar só o código ou a meta tag inteira que o Google ou o Bing mostra.
 */

export const RE_GOOGLE_VERIFICACAO = /^[A-Za-z0-9_-]{20,100}$/;
export const RE_BING_VERIFICACAO = /^[A-Fa-f0-9]{32}$/;

export const MSG_GOOGLE_VERIFICACAO =
  'O código do Google Search Console tem de 20 a 100 letras, números, "-" ou "_". Cole o content da meta tag google-site-verification (ou a tag inteira).';
export const MSG_BING_VERIFICACAO =
  "O código do Bing tem 32 caracteres (números e letras de A a F). Cole o content da meta tag msvalidate.01 (ou a tag inteira).";

/** Código limpo, ou null se vier vazio. Meta tag colada inteira vira só o content. */
export function codigoDeVerificacao(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (t === "") return null;
  const tag = t.match(/content\s*=\s*["']([^"']*)["']/i);
  return (tag ? tag[1]! : t).trim() || null;
}
