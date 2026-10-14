/**
 * Limite de tamanho das imagens enviadas pelo painel. Fonte única para o servidor (lib/admin/dados.ts)
 * e para o navegador (campos.tsx), que recusa antes de mandar.
 *
 * Por que 4 MB: o envio é Server Action, e a Vercel corta o corpo do pedido em 4,5 MB. O
 * `serverActions.bodySizeLimit` do next.config.ts fica em 4,2 MB (4 MB do arquivo + folga do
 * multipart). O bucket aceita 5 MB, então quem manda é este limite.
 */
export const TAMANHO_MAX_IMAGEM = 4 * 1024 * 1024;
export const TAMANHO_MAX_IMAGEM_ROTULO = "4 MB";
export const ERRO_IMAGEM_GRANDE = `A imagem passa de ${TAMANHO_MAX_IMAGEM_ROTULO}. Reduza (ou exporte em JPG ou WebP) e envie de novo.`;
