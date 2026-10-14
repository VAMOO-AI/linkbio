const IN_APP_RE = /instagram|fbav|fbios|fban|tiktok|musical_ly|bytedancewebview|pinterest|twitter/i;

/** Tipos de bloco que sofrem no in-app browser (.ics da agenda, Pix copia-e-cola). */
export const BLOCOS_SENSIVEIS_IN_APP: ReadonlySet<string> = new Set(["agenda", "pix"]);

export type AvisoInApp = { texto: string; intent: string | null };

export function ehInApp(ua: string): boolean {
  return IN_APP_RE.test(ua);
}

/**
 * O que mostrar para quem abriu a bio dentro do app (IG, TikTok, FB).
 * Android ganha link intent:// que abre o Chrome direto; iOS só tem instrução.
 */
export function avisoInApp(ua: string, url: string): AvisoInApp | null {
  if (!ehInApp(ua)) return null;
  if (/android/i.test(ua)) {
    const { host, pathname, search } = new URL(url);
    return {
      texto: "Algumas ações funcionam melhor no navegador.",
      intent: `intent://${host}${pathname}${search}#Intent;scheme=https;package=com.android.chrome;end`,
    };
  }
  return { texto: "Toque em ⋯ e escolha “Abrir no navegador”.", intent: null };
}
