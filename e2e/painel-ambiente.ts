/**
 * Combinado entre a config do Playwright, o Supabase falso e o teste do painel.
 * Fonte única, pelo mesmo motivo de `lib/previa.ts`: se a porta mudar de um lado, o outro acompanha.
 */

/** Porta do app nos testes. Própria de propósito: o `npm run dev` (3000) usa as credenciais reais. */
export const PORTA_APP = Number(process.env.LINKBIO_E2E_PORTA ?? 3100);

/** Porta do Supabase falso. Longe do 54321 do `supabase start` e da faixa efêmera do macOS. */
export const PORTA_FALSA = Number(process.env.LINKBIO_E2E_PORTA_FALSA ?? 3155);

export const URL_APP = `http://localhost:${PORTA_APP}`;
export const URL_FALSA = `http://127.0.0.1:${PORTA_FALSA}`;

/** API falsa da Anthropic, só no teste do concierge em modo IA. */
export const PORTA_ANTHROPIC = 3191;
export const URL_ANTHROPIC = `http://127.0.0.1:${PORTA_ANTHROPIC}`;

/** Chave de mentira: o falso confere o cabeçalho, então o app só roda ligado nele de propósito. */
export const CHAVE_FALSA = "chave-do-supabase-falso-para-teste";

/** 32 caracteres ou mais, senão `faltaParaOAdmin()` desliga o painel. */
export const SEGREDO_SESSAO = "segredo-de-sessao-do-teste-com-mais-de-32-caracteres";

/** Pessoa de teste do falso. Domínio reservado: não é ninguém de verdade. */
export const EMAIL_TESTE = "teste@exemplo.com";
export const SENHA_TESTE = "teste-do-painel-1234";

/** Chave de mentira da Resend. O falso só aceita o e-mail do código com ela. */
export const RESEND_FALSA = "re_teste_do_painel";
