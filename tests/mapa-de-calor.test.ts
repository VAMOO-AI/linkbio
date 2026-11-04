import { describe, expect, it } from "vitest";
import { cliquesPorSecao, mapaDeCalor, resumirEngajamento, secaoDoClique, type SecaoRolagem } from "@/lib/engajamento";
import type { LinhaClique } from "@/lib/cliques";
import { calorValido } from "@/lib/previa";

const HOJE = "2026-11-04";

// Só o que o mapa olha em cada bloco: tipo, id, e os itens de cards e vitrine.
const BLOCOS = [
  { type: "profile" },
  { type: "cta", id: "falar" },
  { type: "cards", items: ["mentoria", "guia"] },
  { type: "products", items: ["planner"] },
  { type: "links" },
  { type: "concierge" },
  { type: "divider" },
  { type: "faq" },
];

const clique = (alvo: string, total: number, dia = HOJE): LinhaClique => ({ dia, alvo, origem: "bio", total });

describe("secaoDoClique", () => {
  it("botão do próprio bloco: a chave vem logo depois do tipo", () => {
    expect(secaoDoClique("cta.falar", BLOCOS)).toBe("falar");
    expect(secaoDoClique("links.links-0.2", BLOCOS)).toBe("links-0");
    expect(secaoDoClique("concierge.concierge-0", BLOCOS)).toBe("concierge-0");
    expect(secaoDoClique("concierge.concierge-0.mais.guia", BLOCOS)).toBe("concierge-0");
  });

  it("oferta e produto caem no bloco que mostra o card; rede do perfil cai no perfil", () => {
    expect(secaoDoClique("oferta.guia.url", BLOCOS)).toBe("cards-0");
    expect(secaoDoClique("produto.planner", BLOCOS)).toBe("products-0");
    expect(secaoDoClique("perfil.1", BLOCOS)).toBe("profile-0");
  });

  it("vitrine sem lista mostra o catálogo inteiro: qualquer produto cai nela", () => {
    expect(secaoDoClique("produto.qualquer", [{ type: "products" }])).toBe("products-0");
  });

  it("alvo que não é de nenhum bloco da bio fica de fora", () => {
    expect(secaoDoClique("cta.saiu", BLOCOS)).toBeNull();
    expect(secaoDoClique("oferta.sem-card.url", BLOCOS)).toBeNull();
    expect(secaoDoClique("lixo", BLOCOS)).toBeNull();
  });
});

describe("cliquesPorSecao", () => {
  it("soma os 30 dias por seção e deixa o resto de fora", () => {
    const m = cliquesPorSecao(
      [clique("cta.falar", 3), clique("cta.falar", 2, "2026-10-20"), clique("oferta.mentoria.wa", 4), clique("cta.falar", 9, "2026-09-01"), clique("cta.saiu", 7)],
      BLOCOS,
      HOJE,
    );
    expect(Object.fromEntries(m)).toEqual({ falar: 5, "cards-0": 4 });
  });
});

describe("resumirEngajamento com cliques", () => {
  it("cada seção traz os cliques dos botões dela", () => {
    const r = resumirEngajamento(
      [{ dia: HOJE, tipo: "secao", chave: "falar", origem: "bio", total: 8 }],
      [{ dia: HOJE, origem: "bio", total: 10 }],
      [
        { chave: "profile-0", nome: "Perfil" },
        { chave: "falar", nome: "Botão" },
      ],
      [],
      HOJE,
      new Map([["falar", 6]]),
    );
    expect(r.secoes.map((s) => [s.chave, s.cliques30])).toEqual([
      ["profile-0", 0],
      ["falar", 6],
    ]);
  });
});

describe("mapaDeCalor", () => {
  const secao = (chave: string, pct: number | null, extra: Partial<SecaoRolagem> = {}): SecaoRolagem => ({
    chave,
    nome: chave,
    vistas30: pct ?? 0,
    pct,
    toques30: 0,
    cliques30: 0,
    ...extra,
  });

  it("liga cada seção ao índice do bloco em config.blocks e dá o nível pela % que chegou", () => {
    const m = mapaDeCalor(BLOCOS, [
      secao("profile-0", 100),
      secao("falar", 60, { cliques30: 12 }),
      secao("cards-0", 35, { toques30: 2 }),
      secao("faq-0", 10),
    ]);
    expect(m).toEqual([
      { indice: 0, pct: 100, cliques: 0, toques: 0, nivel: "quente" },
      { indice: 1, pct: 60, cliques: 12, toques: 0, nivel: "quente" },
      { indice: 2, pct: 35, cliques: 0, toques: 2, nivel: "morno" },
      { indice: 7, pct: 10, cliques: 0, toques: 0, nivel: "frio" },
    ]);
  });

  it("bloco novo do rascunho (sem dado) e seção que saiu da bio não entram", () => {
    expect(mapaDeCalor(BLOCOS, [secao("profile-0", null), secao("saiu", 50)])).toEqual([]);
  });
});

describe("calorValido", () => {
  it("aceita a lista do mapa e recusa o que veio torto", () => {
    expect(calorValido([{ indice: 0, pct: 80, cliques: 1, toques: 0, nivel: "quente" }])).toBe(true);
    expect(calorValido(null)).toBe(true);
    expect(calorValido([{ indice: -1, pct: 80, cliques: 1, toques: 0, nivel: "quente" }])).toBe(false);
    expect(calorValido([{ indice: 0, pct: 80, cliques: 1, toques: 0, nivel: "<b>" }])).toBe(false);
    expect(calorValido("x")).toBe(false);
  });
});
