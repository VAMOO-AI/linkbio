import "server-only";
import { cabecalhosDaChave, lerSupabase } from "./supabase-chave";

/**
 * Acesso ao Supabase só pelo servidor, com a service role (nunca vai ao navegador).
 * Sem SDK: REST do PostgREST e do Storage com fetch. Sem as envs, o template roda só com o arquivo de config.
 * Aceita também os nomes que a integração da Vercel grava (`SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_URL`).
 */
export function supabaseConfigurado(): boolean {
  return lerSupabase(process.env) !== null;
}

function base(): { url: string; chave: string } {
  const c = lerSupabase(process.env);
  if (!c) throw new Error("Supabase não configurado: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  return c;
}

function cabecalhos(extra: Record<string, string> = {}): Record<string, string> {
  const { chave } = base();
  return { ...cabecalhosDaChave(chave), ...extra };
}

/** GET/POST/PATCH/DELETE no PostgREST (`/rest/v1/<caminho>`). Erro HTTP vira exceção com a mensagem do banco. */
export async function rest<T = unknown>(
  caminho: string,
  init: RequestInit & { next?: { tags?: string[] } } = {},
): Promise<T> {
  const { url } = base();
  const resp = await fetch(`${url}/rest/v1/${caminho}`, {
    ...init,
    headers: cabecalhos({ "Content-Type": "application/json", ...(init.headers as Record<string, string>) }),
  });
  if (!resp.ok) {
    const corpo = await resp.text();
    throw new Error(`Supabase ${resp.status} em ${caminho.split("?")[0]}: ${corpo.slice(0, 300)}`);
  }
  const texto = await resp.text();
  return (texto ? JSON.parse(texto) : null) as T;
}

/** Envia um arquivo ao bucket público e devolve a URL pública. */
export async function enviarArquivo(bucket: string, caminho: string, corpo: Blob, tipo: string): Promise<string> {
  const { url } = base();
  const resp = await fetch(`${url}/storage/v1/object/${bucket}/${caminho}`, {
    method: "POST",
    headers: cabecalhos({ "Content-Type": tipo, "x-upsert": "true", "Cache-Control": "31536000" }),
    body: corpo,
  });
  if (!resp.ok) throw new Error(`Falha ao enviar a imagem (${resp.status}): ${(await resp.text()).slice(0, 200)}`);
  return `${url}/storage/v1/object/public/${bucket}/${caminho}`;
}
