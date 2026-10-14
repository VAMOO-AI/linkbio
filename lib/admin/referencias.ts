/**
 * Quando uma oferta ou um produto some ou troca de identificador no painel, quem apontava para ele
 * acompanha. Sem isto, apagar uma oferta deixava referências que o leigo não tinha como achar: a 2ª
 * pergunta do concierge guarda uma oferta que o painel não mostra (só a 1ª decide o final).
 *
 * Regras:
 * - identificador trocado (mesma posição, o antigo sumiu e o novo não existia): as referências
 *   seguem o novo nome, no bloco de cards, na vitrine e no concierge;
 * - oferta apagada: sai dos blocos de cards e das perguntas de contexto do concierge (onde não muda
 *   nada na página). Na 1ª pergunta ela FICA: é uma escolha da pessoa, e o painel pede outra. Com
 *   `decide: "ultima"` toda pergunta pode decidir o final, então ela fica em todas;
 * - produto apagado: sai das vitrines que o listavam.
 *
 * Só dados: o editor client importa este arquivo. Testes em tests/admin-referencias.test.ts.
 */

import { limparTemaParaModelo } from "../resolver";

type Obj = Record<string, unknown>;

const ehObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const idsDe = (v: unknown) => (Array.isArray(v) ? v.map((x) => (ehObj(x) ? String(x.id ?? "") : "")) : []);

function mudancas(antes: string[], depois: string[]) {
  const renomes = new Map<string, string>();
  if (antes.length === depois.length) {
    antes.forEach((a, i) => {
      const d = depois[i]!;
      if (a && d && a !== d && !depois.includes(a) && !antes.includes(d)) renomes.set(a, d);
    });
  }
  // Só conta como apagado quando a lista encolheu: identificador sendo redigitado não é exclusão.
  const apagados = new Set(depois.length < antes.length ? antes.filter((a) => a && !depois.includes(a)) : []);
  return { renomes, apagados };
}

function trocarLista(itens: unknown, renomes: Map<string, string>, apagados: Set<string>): unknown {
  if (!Array.isArray(itens)) return itens;
  return itens.filter((x) => !apagados.has(String(x))).map((x) => renomes.get(String(x)) ?? x);
}

/** Ajusta os blocos de `depois` ao que mudou em `offers` e `catalog` desde `antes`. */
export function acompanharReferencias(antes: Obj, depois: Obj): Obj {
  if (antes.offers === depois.offers && antes.catalog === depois.catalog) return depois;
  if (!Array.isArray(depois.blocks)) return depois;
  const ofertas = mudancas(idsDe(antes.offers), idsDe(depois.offers));
  const produtos = mudancas(idsDe(antes.catalog), idsDe(depois.catalog));
  const nadaMudou = !ofertas.renomes.size && !ofertas.apagados.size && !produtos.renomes.size && !produtos.apagados.size;
  if (nadaMudou) return depois;

  const blocks = depois.blocks.map((b) => {
    if (!ehObj(b)) return b;
    if (b.type === "cards") return { ...b, items: trocarLista(b.items, ofertas.renomes, ofertas.apagados) };
    if (b.type === "products" && Array.isArray(b.items)) return { ...b, items: trocarLista(b.items, produtos.renomes, produtos.apagados) };
    if (b.type === "concierge" && Array.isArray(b.flow)) {
      const todasDecidem = b.decide === "ultima";
      const flow = b.flow.map((passo, j) => {
        if (!ehObj(passo) || !Array.isArray(passo.options)) return passo;
        const options = passo.options.map((op) => {
          if (!ehObj(op) || typeof op.offer !== "string") return op;
          const novo = ofertas.renomes.get(op.offer);
          if (novo) return { ...op, offer: novo };
          if (j > 0 && !todasDecidem && ofertas.apagados.has(op.offer)) {
            const resto = { ...op };
            delete resto.offer;
            return resto;
          }
          return op;
        });
        return { ...passo, options };
      });
      return { ...b, flow };
    }
    return b;
  });
  return { ...depois, blocks };
}

/**
 * Cantos x raio em px: o `theme.radius` (da v0.1.0, em Avançado) passa por cima de "Cantos". Numa bio
 * que já tinha raio, escolher Retos, Médios, Redondos ou Padrão não mudava os cards e parecia que o
 * painel estava quebrado. Quem escolhe Cantos quer os cantos dele: o raio em px sai. Mexer só no raio
 * (Avançado) continua valendo.
 */
/**
 * Trocar de modelo não deixa sobra: o modo e a paleta de uma versão que o modelo novo não tem saem
 * (ex.: paleta escura ao ir de "noite" para "editorial"). Sem isto, a sobra não fazia nada na página
 * e ainda assustava com aviso. Só age quando o modelo muda.
 */
export function acompanharModelo(antes: Obj, depois: Obj): Obj {
  const ta = ehObj(antes.theme) ? antes.theme : {};
  const td = ehObj(depois.theme) ? depois.theme : {};
  if (ta.preset === td.preset || typeof td.preset !== "string") return depois;
  const theme = limparTemaParaModelo(td as Parameters<typeof limparTemaParaModelo>[0]);
  return theme === td ? depois : { ...depois, theme };
}

export function acompanharCantos(antes: Obj, depois: Obj): Obj {
  const ta = ehObj(antes.theme) ? antes.theme : {};
  const td = ehObj(depois.theme) ? depois.theme : {};
  if (ta.corners === td.corners || td.radius === undefined) return depois;
  const theme = { ...td };
  delete theme.radius;
  return { ...depois, theme };
}
