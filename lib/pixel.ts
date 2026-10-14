/**
 * Pixel da Meta e Google Analytics 4.
 * A config (arquivo ou painel) é a fonte. A variável de ambiente só vale se o campo estiver vazio.
 * ID inválido não liga script nenhum.
 */

export const RE_META = /^\d{10,20}$/;
export const RE_GA4 = /^G-[A-Za-z0-9]+$/;

export const MSG_META =
  'O ID do Pixel da Meta deve ter só números, de 10 a 20 dígitos (ex.: "123456789012345").';
export const MSG_GA4 =
  'O ID do Google Analytics deve começar com G- seguido de letras ou números (ex.: "G-AB12CD34").';

export type IdsPixel = { meta: string | null; ga4: string | null };

/** process.env entra direto: a assinatura aberta evita o erro de tipo fraco do Node. */
export type AmbientePixel = {
  META_PIXEL_ID?: string;
  GA4_MEASUREMENT_ID?: string;
  [outra: string]: string | undefined;
};

function texto(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function escolher(daConfig: string, doAmbiente: string, re: RegExp): string | null {
  const bruto = daConfig || doAmbiente;
  return bruto && re.test(bruto) ? bruto : null;
}

/** IDs que a página pode carregar. Config preenchida ganha da variável de ambiente. */
export function idsEfetivos(
  pixel: { meta?: string | null; ga4?: string | null } | null | undefined,
  env: AmbientePixel,
): IdsPixel {
  return {
    meta: escolher(texto(pixel?.meta), texto(env.META_PIXEL_ID), RE_META),
    ga4: escolher(texto(pixel?.ga4), texto(env.GA4_MEASUREMENT_ID), RE_GA4),
  };
}

/** Avisos do `npm run check`. ID na config inválida já quebra no schema; aqui o ambiente entra. */
export function avisosDePixel(
  pixel: { meta?: unknown; ga4?: unknown } | null | undefined,
  env: AmbientePixel,
): string[] {
  const avisos: string[] = [];
  const metaCfg = texto(pixel?.meta);
  const ga4Cfg = texto(pixel?.ga4);
  const metaEnv = texto(env.META_PIXEL_ID);
  const ga4Env = texto(env.GA4_MEASUREMENT_ID);
  if (metaCfg && !RE_META.test(metaCfg)) {
    avisos.push("features.pixel.meta não parece um ID do Pixel da Meta (só números, de 10 a 20 dígitos).");
  }
  if (ga4Cfg && !RE_GA4.test(ga4Cfg)) {
    avisos.push('features.pixel.ga4 não parece um ID do Google Analytics (deve começar com G-).');
  }
  if (!metaCfg && metaEnv && !RE_META.test(metaEnv)) {
    avisos.push(
      "META_PIXEL_ID não parece um ID do Pixel da Meta (só números, de 10 a 20 dígitos). O painel e a config têm prioridade; esta variável só vale se o campo estiver vazio.",
    );
  }
  if (!ga4Cfg && ga4Env && !RE_GA4.test(ga4Env)) {
    avisos.push(
      "GA4_MEASUREMENT_ID não parece um ID do Google Analytics (deve começar com G-). O painel e a config têm prioridade; esta variável só vale se o campo estiver vazio.",
    );
  }
  return avisos;
}
