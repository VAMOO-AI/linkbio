import type { TemaForcado } from "./resolver";

/**
 * Contrato entre o editor e o <iframe> da prévia, pela mesma origem (postMessage).
 * O quadro carrega uma vez; cada edição chega por aqui, sem recarregar nem bater no servidor.
 * `pronta` sai do quadro quando ele já está ouvindo, e é o que libera o editor a mandar a config.
 */
export type RecadoDaPrevia =
  | { tipo: "pronta" }
  /**
   * `config: unknown` de propósito: o editor manda o que está na tela, que pode estar no meio da
   * digitação e inválido. Quem recebe valida com o mesmo schema do build antes de desenhar.
   */
  | { tipo: "config"; config: unknown; tema: TemaForcado }
  /**
   * O que está sendo editado: a prévia rola até ele e realça por um instante. `abriu`: veio de abrir
   * (bloco, oferta, produto), e não de pôr o cursor num campo; aí realça mesmo se já estiver na tela.
   */
  | { tipo: "foco"; alvo: AlvoDaPrevia; abriu: boolean };

/**
 * Onde a prévia deve ir. `bloco` é o índice em `config.blocks` (contando os desligados); com
 * `oferta` ou `produto` junto, é o card ou o produto dentro daquele bloco. Sem `bloco`, a oferta vai
 * ao primeiro card dela na página e o produto à primeira vitrine que o mostra. `perfil` é o topo;
 * `whatsapp`, o primeiro botão de WhatsApp da bio.
 */
export type AlvoDaPrevia = { bloco?: number; oferta?: string; produto?: string; perfil?: true; whatsapp?: true };

/** Confere o formato de um alvo vindo de postMessage (mesma origem, mas nada entra sem checar). */
export function alvoValido(x: unknown): x is AlvoDaPrevia {
  if (typeof x !== "object" || x === null || Array.isArray(x)) return false;
  const a = x as Record<string, unknown>;
  const chaves = Object.keys(a);
  if (!chaves.length || chaves.some((k) => !["bloco", "oferta", "produto", "perfil", "whatsapp"].includes(k))) return false;
  if (a.bloco !== undefined && !(Number.isInteger(a.bloco) && (a.bloco as number) >= 0)) return false;
  if (a.oferta !== undefined && typeof a.oferta !== "string") return false;
  if (a.produto !== undefined && typeof a.produto !== "string") return false;
  if (a.perfil !== undefined && a.perfil !== true) return false;
  if (a.whatsapp !== undefined && a.whatsapp !== true) return false;
  return true;
}
