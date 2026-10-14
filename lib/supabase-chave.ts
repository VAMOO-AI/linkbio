/**
 * Cabeçalhos de autenticação do Supabase, a partir da chave de servidor.
 *
 * Dois formatos de chave convivem:
 * - a `service_role` antiga, que é um JWT (`eyJ...`): vai em `apikey` e em `Authorization: Bearer`;
 * - a "Secret key" nova (`sb_secret_...`), que não é JWT: vai SÓ em `apikey`. A doc do Supabase
 *   (https://supabase.com/docs/guides/api/api-keys) manda enviar as chaves novas no `apikey` e não no
 *   `Authorization: Bearer`, porque o que tentar ler a chave como JWT falha.
 *
 * Sem `server-only` de propósito: é função pura, usada também por `scripts/admin-usuario.ts` e pelos testes.
 * Quem guarda a chave longe do navegador é quem chama (`lib/supabase.ts` importa `server-only`).
 */
export function cabecalhosDaChave(chave: string): Record<string, string> {
  if (chave.startsWith("sb_")) return { apikey: chave };
  return { apikey: chave, Authorization: `Bearer ${chave}` };
}

/**
 * Endereço e chave do projeto. A integração da Vercel (Marketplace) grava
 * `SUPABASE_URL` e `SUPABASE_SECRET_KEY` (não `SUPABASE_SERVICE_ROLE_KEY`),
 * e também `NEXT_PUBLIC_SUPABASE_URL`. Os nomes nossos ganham, se os dois existirem.
 * https://supabase.com/docs/guides/integrations/vercel-marketplace
 */
export function lerSupabase(env: Record<string, string | undefined>): { url: string; chave: string } | null {
  const url = (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/$/, "");
  const chave = (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || "").trim();
  if (!url || !chave) return null;
  return { url, chave };
}
