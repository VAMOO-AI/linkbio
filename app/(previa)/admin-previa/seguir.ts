import type { LinkbioConfig } from "@/config/schema";
import type { AlvoDaPrevia } from "@/lib/previa";

/**
 * Dentro do quadro da prévia: acha o alvo pedido pelo painel, rola até ele e realça por um instante.
 *
 * Os blocos chegam embrulhados em `.previa-bloco[data-bloco-indice]` (só aqui na prévia, com
 * `display: contents`: o layout é o mesmo da bio). O card de uma oferta e o item de um produto são
 * achados pela posição, com a mesma regra que o bloco usa para desenhar; a bio pública não ganha
 * nenhum atributo a mais.
 */

const DURACAO_REALCE = 1600;

const bloco = (i: number) => document.querySelector(`.previa-bloco[data-bloco-indice="${i}"]`);
const visivel = (el: Element | null | undefined): el is HTMLElement => !!el && el.getClientRects().length > 0;
const filhosVisiveis = (w: Element | null) => (w ? [...w.children].filter(visivel) : []);

type Bloco = LinkbioConfig["blocks"][number];

function cardNoBloco(w: Element, b: Bloco, oferta: string, config: LinkbioConfig): HTMLElement | null {
  if (b.type !== "cards") return null;
  // A mesma conta do CardsBlock: só entram as ofertas que existem, na ordem do bloco.
  const existentes = b.items.filter((id) => config.offers.some((o) => o.id === id));
  const k = existentes.indexOf(oferta);
  const el = k < 0 ? null : w.querySelectorAll(".card-oferta")[k];
  return visivel(el) ? el : null;
}

function produtoNoBloco(w: Element, b: Bloco, produto: string, config: LinkbioConfig): HTMLElement | null {
  if (b.type !== "products") return null;
  // A mesma conta do ProductsBlock: `items` escolhe (e ordena) os produtos; sem ele, o catálogo todo.
  const ids = b.items ? b.items.filter((id) => config.catalog.some((p) => p.id === id)) : config.catalog.map((p) => p.id);
  const k = ids.indexOf(produto);
  const el = k < 0 ? null : w.querySelectorAll(".produtos-lista > li")[k];
  return visivel(el) ? el : null;
}

/** Os elementos que formam o alvo (um bloco pode desenhar mais de um, como o botão e a nota). */
function elementosDoAlvo(alvo: AlvoDaPrevia, config: LinkbioConfig): HTMLElement[] {
  const blocos = config.blocks;
  if (alvo.bloco !== undefined) {
    const w = bloco(alvo.bloco);
    const b = blocos[alvo.bloco];
    if (!w || !b) return [];
    const dentro = (alvo.oferta && cardNoBloco(w, b, alvo.oferta, config)) || (alvo.produto && produtoNoBloco(w, b, alvo.produto, config));
    return dentro ? [dentro] : filhosVisiveis(w);
  }
  if (alvo.oferta) {
    for (const [i, b] of blocos.entries()) {
      const w = bloco(i);
      const card = w && cardNoBloco(w, b, alvo.oferta, config);
      if (card) return [card];
    }
    // Sem card, o concierge que indica a oferta.
    const i = blocos.findIndex((b) => b.type === "concierge" && b.flow.some((p) => p.options.some((op) => op.offer === alvo.oferta)));
    return i < 0 ? [] : filhosVisiveis(bloco(i));
  }
  if (alvo.produto) {
    for (const [i, b] of blocos.entries()) {
      const w = bloco(i);
      const item = w && produtoNoBloco(w, b, alvo.produto, config);
      if (item) return [item];
    }
    return [];
  }
  if (alvo.perfil) {
    const i = blocos.findIndex((b) => b.type === "profile");
    return i < 0 ? [] : filhosVisiveis(bloco(i));
  }
  if (alvo.whatsapp) {
    const botao = [...document.querySelectorAll('main a[href^="https://wa.me/"]')].find(visivel);
    return botao ? [botao as HTMLElement] : [];
  }
  return [];
}

function uniao(els: HTMLElement[]) {
  const rs = els.map((e) => e.getBoundingClientRect());
  const top = Math.min(...rs.map((r) => r.top));
  const left = Math.min(...rs.map((r) => r.left));
  return { top, left, width: Math.max(...rs.map((r) => r.right)) - left, height: Math.max(...rs.map((r) => r.bottom)) - top };
}

/** Card num carrossel (ou produto numa fileira que rola de lado): traz para o meio da fileira. */
function trazerDeLado(el: HTMLElement) {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const ox = getComputedStyle(p).overflowX;
    if ((ox === "auto" || ox === "scroll") && p.scrollWidth > p.clientWidth) {
      const r = el.getBoundingClientRect();
      const rp = p.getBoundingClientRect();
      p.scrollTo({ left: p.scrollLeft + (r.left + r.width / 2) - (rp.left + rp.width / 2), behavior: "instant" });
      return;
    }
  }
}

let realceAtual: { el: HTMLElement; t: ReturnType<typeof setTimeout> } | null = null;

/** Contorno por cima do alvo, fora dele: não mexe no estilo do bloco nem no layout da página. */
function realcar(r: ReturnType<typeof uniao>) {
  if (realceAtual) {
    clearTimeout(realceAtual.t);
    realceAtual.el.remove();
  }
  const folga = 6;
  const el = document.createElement("div");
  el.className = "previa-realce";
  el.setAttribute("aria-hidden", "true");
  Object.assign(el.style, {
    top: `${r.top + scrollY - folga}px`,
    left: `${r.left + scrollX - folga}px`,
    width: `${r.width + folga * 2}px`,
    height: `${r.height + folga * 2}px`,
  });
  document.body.appendChild(el);
  realceAtual = { el, t: setTimeout(() => (el.remove(), (realceAtual = null)), DURACAO_REALCE) };
}

let ultimoAlvo = "";

export function seguirAlvo(alvo: AlvoDaPrevia, config: LinkbioConfig, abriu: boolean) {
  const els = elementosDoAlvo(alvo, config);
  const chave = JSON.stringify(alvo);
  const repetido = chave === ultimoAlvo;
  ultimoAlvo = chave;
  if (!els.length) return;
  // Cursor de um campo a outro do mesmo alvo, que já está na tela: nada a fazer (sem piscar a cada Tab).
  const antes = uniao(els);
  const naTela = antes.top >= 0 && antes.top + antes.height <= innerHeight && antes.left >= 0 && antes.left + antes.width <= innerWidth;
  if (!abriu && repetido && naTela) return;
  if (els.length === 1) trazerDeLado(els[0]!);
  const r = uniao(els);
  // Cabe na tela: fica no meio. Maior que a tela: o começo dele, com um respiro em cima.
  const destino = r.height + 32 <= innerHeight ? r.top + scrollY - (innerHeight - r.height) / 2 : r.top + scrollY - 16;
  const max = document.documentElement.scrollHeight - innerHeight;
  const suave = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: Math.max(0, Math.min(max, destino)), behavior: suave ? "smooth" : "instant" });
  realcar(r);
}
