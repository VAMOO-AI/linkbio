/**
 * O que o script da origem (lib/origem.ts) guardou na sessão do navegador. Módulo pequeno de
 * propósito: o componente do agendamento importa só isto, sem levar o texto do script junto.
 */
export const CHAVE_ORIGEM = "linkbio-origem";
export const CHAVE_UTM = "linkbio-utm";
export const CHAVES_CAMPANHA = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"] as const;

export function origemGuardada(): { origem: string | null; utm: Record<string, string> | null } {
  try {
    const origem = sessionStorage.getItem(CHAVE_ORIGEM);
    const utm = JSON.parse(sessionStorage.getItem(CHAVE_UTM) ?? "null") as Record<string, string> | null;
    return { origem, utm: utm && typeof utm === "object" ? utm : null };
  } catch {
    return { origem: null, utm: null };
  }
}
