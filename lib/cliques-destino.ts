import type { Block, LinkbioConfig } from "@/config/schema";
import { mensagemConcierge, respostaQueDecide, type RespostaConcierge } from "@/lib/concierge";
import {
  alvoBanner,
  alvoConciergeMais,
  alvoCta,
  alvoCupom,
  alvoItemLinks,
  alvoLink,
  alvoOfertaMais,
  alvoOfertaUrl,
  alvoOfertaWa,
  alvoPerfil,
  alvoProduto,
  alvoRede,
  chavesDosBlocos,
} from "@/lib/cliques";
import { linkWhatsApp } from "@/lib/whatsapp";

export type DestinoResolvido = { url: string; nome: string };

const ALVO_OK = /^[a-z0-9.-]{1,180}$/;

function indice(s: string | undefined): number | null {
  if (!s || !/^\d{1,3}$/.test(s)) return null;
  return Number(s);
}

function blocoPorChave<T extends Block["type"]>(
  config: LinkbioConfig,
  tipo: T,
  chave: string | undefined,
): Extract<Block, { type: T }> | undefined {
  if (!chave || chave.includes(".")) return undefined;
  const chaves = chavesDosBlocos(config.blocks);
  const i = config.blocks.findIndex((b, n) => b.type === tipo && chaves[n] === chave);
  const bloco = i >= 0 ? config.blocks[i] : undefined;
  return bloco && bloco.type === tipo ? (bloco as Extract<Block, { type: T }>) : undefined;
}

function waOferta(config: LinkbioConfig, titulo: string, texto?: string): string {
  return linkWhatsApp(config.contact.whatsapp, texto ?? `Oi! Quero saber mais sobre ${titulo}.`);
}

/**
 * Destino do atalho. O endereço sai da config publicada; o que veio na URL só escolhe
 * qual botão (e, no concierge, quais respostas). Endereço livre não passa.
 */
export function resolverDestino(config: LinkbioConfig, alvo: string, caminho: string | null): DestinoResolvido | null {
  if (!ALVO_OK.test(alvo) || alvo.includes("..")) return null;
  const [tipo, a, b, c, extra] = alvo.split(".");
  if (extra !== undefined && tipo !== "concierge") return null;

  if (tipo === "cta" && a && b === undefined) {
    const bloco = blocoPorChave(config, "cta", a);
    if (!bloco) return null;
    const url = "wa" in bloco.action ? linkWhatsApp(config.contact.whatsapp, bloco.action.wa) : bloco.action.url;
    return { url, nome: bloco.label };
  }

  if (tipo === "banner" && a && b === undefined) {
    const bloco = blocoPorChave(config, "banner", a);
    if (!bloco?.action || !bloco.label) return null;
    const url = "wa" in bloco.action ? linkWhatsApp(config.contact.whatsapp, bloco.action.wa) : bloco.action.url;
    return { url, nome: bloco.label };
  }

  if (tipo === "link" && a && b === undefined) {
    const bloco = blocoPorChave(config, "link", a);
    if (!bloco) return null;
    return { url: bloco.url, nome: bloco.title };
  }

  if (tipo === "links" && a && b !== undefined && c === undefined) {
    const bloco = blocoPorChave(config, "links", a);
    const i = indice(b);
    const item = bloco && i !== null ? bloco.items[i] : undefined;
    if (!item) return null;
    return { url: item.url, nome: item.title };
  }

  if (tipo === "cupom" && a && b === undefined) {
    const bloco = blocoPorChave(config, "coupon", a);
    if (!bloco?.action) return null;
    const url = "wa" in bloco.action ? linkWhatsApp(config.contact.whatsapp, bloco.action.wa) : bloco.action.url;
    return { url, nome: bloco.label };
  }

  if (tipo === "perfil" && a !== undefined && b === undefined) {
    const i = indice(a);
    const rede = i !== null ? config.profile.socials?.[i] : undefined;
    if (!rede) return null;
    return { url: rede.url, nome: rede.rotulo };
  }

  if (tipo === "rede" && a && b !== undefined && c === undefined) {
    const bloco = blocoPorChave(config, "social", a);
    const i = indice(b);
    const item = bloco && i !== null ? bloco.items[i] : undefined;
    if (!item) return null;
    return { url: item.url, nome: item.rotulo };
  }

  if (tipo === "oferta" && a && (b === "url" || b === "mais" || b === "wa") && c === undefined) {
    const oferta = config.offers.find((o) => o.id === a);
    if (!oferta) return null;
    if (b === "url" && oferta.url) return { url: oferta.url, nome: oferta.title };
    if (b === "mais" && oferta.more_url) return { url: oferta.more_url, nome: `${oferta.title} (saiba mais)` };
    if (b === "wa") return { url: waOferta(config, oferta.title, oferta.wa), nome: oferta.title };
    return null;
  }

  if (tipo === "produto" && a && b === undefined) {
    const produto = config.catalog.find((p) => p.id === a);
    if (!produto) return null;
    return { url: produto.url, nome: produto.title };
  }

  if (tipo === "concierge" && a && b === "mais" && c && extra === undefined) {
    const bloco = blocoPorChave(config, "concierge", a);
    const oferta = config.offers.find((o) => o.id === c);
    if (!bloco || !oferta?.more_url) return null;
    const cita = bloco.flow.some((p) => p.options.some((op) => op.offer === oferta.id));
    if (!cita) return null;
    return { url: oferta.more_url, nome: `Concierge: ${oferta.title} (saiba mais)` };
  }

  if (tipo === "concierge" && a && b === undefined) {
    const bloco = blocoPorChave(config, "concierge", a);
    if (!bloco) return null;
    const ids = (caminho ?? "").split(".").filter(Boolean);
    if (ids.length !== bloco.flow.length) return null;
    const respostas: RespostaConcierge[] = [];
    for (let i = 0; i < bloco.flow.length; i += 1) {
      const op = bloco.flow[i]!.options.find((o) => o.id === ids[i]);
      if (!op) return null;
      respostas.push(op);
    }
    const decisiva = respostaQueDecide(respostas, bloco.decide ?? "primeira") ?? respostas.at(-1);
    if (!decisiva) return null;
    const oferta = decisiva.offer ? config.offers.find((o) => o.id === decisiva.offer) : undefined;
    const nome = oferta ? `Concierge: ${oferta.title}` : `Concierge: ${decisiva.title ?? "Vamos conversar"}`;
    if (oferta?.url) return { url: oferta.url, nome };
    if (oferta) return { url: linkWhatsApp(config.contact.whatsapp, mensagemConcierge(oferta.wa ?? `Oi! Quero saber mais sobre ${oferta.title}.`, respostas)), nome };
    return {
      url: linkWhatsApp(config.contact.whatsapp, mensagemConcierge(decisiva.wa ?? "Oi! Quero entender qual caminho faz sentido pra mim.", respostas)),
      nome,
    };
  }

  return null;
}

/** Nome que a pessoa reconhece, para a aba Resultados. Alvo que saiu da config não entra. */
export function nomesDosBotoes(config: LinkbioConfig): Map<string, string> {
  const nomes = new Map<string, string>();
  const por = (alvo: string) => {
    const d = resolverDestino(config, alvo, null);
    if (d) nomes.set(alvo, d.nome);
  };
  const chaves = chavesDosBlocos(config.blocks);
  config.profile.socials?.forEach((_, i) => por(alvoPerfil(i)));
  for (const o of config.offers) {
    if (o.url) por(alvoOfertaUrl(o.id));
    if (o.more_url) por(alvoOfertaMais(o.id));
    if (!o.url) por(alvoOfertaWa(o.id));
  }
  for (const p of config.catalog) por(alvoProduto(p.id));
  config.blocks.forEach((b, n) => {
    const chave = chaves[n]!;
    if (b.type === "cta") por(alvoCta(chave));
    else if (b.type === "banner" && b.action) por(alvoBanner(chave));
    else if (b.type === "link") por(alvoLink(chave));
    else if (b.type === "links") b.items.forEach((_, i) => por(alvoItemLinks(chave, i)));
    else if (b.type === "coupon" && b.action) por(alvoCupom(chave));
    else if (b.type === "social") b.items.forEach((_, i) => por(alvoRede(chave, i)));
    else if (b.type === "concierge") {
      nomes.set(`concierge.${chave}`, b.title?.trim() || "Concierge");
      for (const passo of b.flow) {
        for (const op of passo.options) {
          if (op.offer) por(alvoConciergeMais(chave, op.offer));
        }
      }
    }
  });
  return nomes;
}
