import { linkWhatsApp } from "./whatsapp";

/**
 * Regras do final do concierge, sem React: a ilha client (blocks/concierge.tsx) e os testes usam as
 * mesmas funções. Só dados: nada de zod nem da config inteira aqui.
 *
 * Quem decide o final (`decide` do bloco):
 * - "primeira" (padrão): a resposta da 1ª pergunta. As outras são só contexto.
 * - "ultima": a ÚLTIMA resposta que tem destino próprio (`offer` ou `reason`). Resposta sem os dois
 *   não muda o final e vale a anterior; se nenhuma depois da 1ª tiver, vale a 1ª (que sempre tem
 *   `reason`, então o final nunca fica sem destino).
 */

export type DecideConcierge = "primeira" | "ultima";

export type RespostaConcierge = {
  id: string;
  label: string;
  offer?: string;
  reason?: string;
  title?: string;
  cta?: string;
  wa?: string;
};

/** A resposta tem destino próprio: leva para uma oferta ou para a conversa, com a sua explicação. */
export const temDestino = (r: RespostaConcierge) => r.offer !== undefined || r.reason !== undefined;

/** A resposta que define o final (oferta ou conversa, explicação, título e botão). */
export function respostaQueDecide(respostas: RespostaConcierge[], decide: DecideConcierge = "primeira"): RespostaConcierge | undefined {
  if (decide === "ultima") {
    for (let k = respostas.length - 1; k > 0; k -= 1) {
      if (temDestino(respostas[k]!)) return respostas[k];
    }
  }
  return respostas[0];
}

/**
 * Texto da mensagem do WhatsApp: as respostas numa linha própria, ANTES do texto-modelo, separadas por
 * uma linha em branco. O modelo pode terminar em campos para a pessoa preencher ("O principal
 * gargalo:"); o WhatsApp põe o cursor no fim, então o modelo fica por último e o contexto não cai no
 * meio dele.
 */
export function mensagemConcierge(modelo: string, respostas: RespostaConcierge[]): string {
  const contexto = respostas.map((r) => r.label).join(" · ");
  return `(Vim pelo concierge: ${contexto})\n\n${modelo}`;
}

/**
 * Link do botão final: a url da oferta, ou o WhatsApp com as respostas como contexto.
 * O bloco de roteiro e o modo IA usam a mesma regra.
 */
export function destinoConcierge(opts: {
  whatsapp: string;
  respostas: RespostaConcierge[];
  oferta?: { url?: string; wa?: string; title: string };
  waSemOferta?: string;
}): string {
  if (opts.oferta) {
    return (
      opts.oferta.url ??
      linkWhatsApp(opts.whatsapp, mensagemConcierge(opts.oferta.wa ?? `Oi! Quero saber mais sobre ${opts.oferta.title}.`, opts.respostas))
    );
  }
  return linkWhatsApp(
    opts.whatsapp,
    mensagemConcierge(opts.waSemOferta ?? "Oi! Quero entender qual caminho faz sentido pra mim.", opts.respostas),
  );
}
