import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Código de 6 dígitos do /admin. Funções puras (tests/admin-codigo.test.ts).
 * O código em si nunca fica no banco: só o HMAC com o segredo da sessão.
 * Sem o segredo, a tabela vazada não deixa testar os 1 milhão de códigos.
 */
export const CODIGO_VALIDADE_SEG = 10 * 60;
export const JANELA_MIN = 15;
export const MAX_FALHAS = 5;
export const MAX_ENVIOS = 5;

export const MSG_ENVIO =
  "Se este e-mail puder entrar no painel, o código chega em alguns minutos. Ele vale por 10 minutos e só pode ser usado uma vez.";
export const MSG_CODIGO_RUIM = "Código incorreto ou vencido.";
export const MSG_BLOQUEIO = `Muitas tentativas. Espere ${JANELA_MIN} minutos e tente de novo.`;
export const MSG_EMAIL = "Informe um e-mail válido.";
export const MSG_FORMATO = "Informe o código de 6 dígitos.";
export const MSG_SEM_ENVIO = "O envio de código ainda não está ligado.";
export const MSG_ENVIO_FALHOU = "Não foi possível enviar o código agora. Tente de novo em instantes.";

export function hashCodigo(codigo: string, segredo: string): string {
  const mac = createHmac("sha256", segredo).update(codigo).digest("base64url");
  return `hmac-sha256$${mac}`;
}

/** Compara em tempo constante. Hash malformado não confere e não estoura. */
export function conferirCodigo(codigo: string, guardado: string, segredo: string): boolean {
  const calculado = Buffer.from(hashCodigo(codigo, segredo));
  const recebido = Buffer.from(guardado);
  if (calculado.length !== recebido.length) {
    timingSafeEqual(calculado, calculado);
    return false;
  }
  return timingSafeEqual(calculado, recebido);
}

/** `expiresAtMs` é o instante em que o código deixa de valer. */
export function expirado(expiresAtMs: number, agora = Date.now()): boolean {
  return agora >= expiresAtMs;
}

export type DecisaoPedido =
  | { tipo: "bloqueado"; erro: string }
  | { tipo: "enviar"; mensagem: string }
  | { tipo: "fingir"; mensagem: string };

/** A frase de quem pode entrar e a de quem não pode são a mesma. O bloqueio também. */
export function decidirPedido(o: { emailValido: boolean; falhas: number; envios: number; cadastrado: boolean }): DecisaoPedido {
  if (!o.emailValido) return { tipo: "bloqueado", erro: MSG_EMAIL };
  if (o.falhas >= MAX_FALHAS || o.envios >= MAX_ENVIOS) return { tipo: "bloqueado", erro: MSG_BLOQUEIO };
  if (o.cadastrado) return { tipo: "enviar", mensagem: MSG_ENVIO };
  return { tipo: "fingir", mensagem: MSG_ENVIO };
}

export type DecisaoCodigo = { ok: true } | { ok: false; erro: string; contaFalha: boolean };

/**
 * Código vencido, já usado, errado ou de e-mail sem conta: a mesma frase.
 * Quem já estourou as tentativas nem chega a "acertar".
 */
export function decidirConfirmacao(o: {
  formatoOk: boolean;
  falhas: number;
  cadastrado: boolean;
  confere: boolean;
  expirado: boolean;
  usado: boolean;
}): DecisaoCodigo {
  if (!o.formatoOk) return { ok: false, erro: MSG_FORMATO, contaFalha: false };
  if (o.falhas >= MAX_FALHAS) return { ok: false, erro: MSG_BLOQUEIO, contaFalha: false };
  if (o.cadastrado && o.confere && !o.expirado && !o.usado) return { ok: true };
  return { ok: false, erro: MSG_CODIGO_RUIM, contaFalha: true };
}
