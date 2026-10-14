import type { LinkbioConfig } from "@/config/schema";
import { resolverOrigem, type MotivoArquivo } from "./origem-config";

const TIMEOUT_MS = 2_000;

export type CorpoPing = {
  site: string;
  versao: string;
  fonte: "banco" | "arquivo";
  motivo?: MotivoArquivo;
};

/** Só os quatro campos. Conteúdo da bio e chave nunca entram. */
function corpoEnxuto(c: CorpoPing): CorpoPing {
  const base: CorpoPing = { site: c.site, versao: c.versao, fonte: c.fonte };
  if (c.fonte === "arquivo" && c.motivo) base.motivo = c.motivo;
  return base;
}

/** URL vazia = desligado. Falha de rede não sobe. */
export async function enviarPingVersao(e: {
  pingUrl?: string;
  corpo: CorpoPing;
  fetch?: typeof fetch;
  timeoutMs?: number;
}): Promise<void> {
  const url = e.pingUrl?.trim() ?? "";
  if (!url) return;
  const buscar = e.fetch ?? fetch;
  try {
    await buscar(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpoEnxuto(e.corpo)),
      signal: AbortSignal.timeout(e.timeoutMs ?? TIMEOUT_MS),
    });
  } catch {
    // o ping é opt-in e nunca derruba quem chamou
  }
}

/**
 * Roda depois do keepalive, em função separada. 401 não pinga (não é a cron).
 * URL vazia não consulta o banco. Qualquer falha é engolida.
 */
export async function pingAposKeepalive(e: {
  statusKeepalive: number;
  pingUrl?: string;
  supabaseUrl?: string;
  chave?: string;
  arquivo: LinkbioConfig;
  versao: string;
  fetch?: typeof fetch;
}): Promise<void> {
  if (e.statusKeepalive === 401) return;
  if (!e.pingUrl?.trim()) return;
  try {
    const origem = await resolverOrigem({
      supabaseUrl: e.supabaseUrl,
      chave: e.chave,
      arquivo: e.arquivo,
      fetch: e.fetch,
      cache: "no-store",
    });
    await enviarPingVersao({
      pingUrl: e.pingUrl,
      fetch: e.fetch,
      corpo: {
        site: origem.config.site.url,
        versao: e.versao,
        fonte: origem.fonte,
        motivo: origem.fonte === "arquivo" ? origem.motivo : undefined,
      },
    });
  } catch {
    // falha do ping nunca derruba o keepalive
  }
}
