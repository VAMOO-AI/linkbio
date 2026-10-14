import { describe, expect, test } from "vitest";
import { acompanharCantos, acompanharModelo, acompanharReferencias } from "../lib/admin/referencias";
import { ConfigSchema } from "../config/schema";
import arquivo from "./fixtures/config-exemplo";

/**
 * lib/admin/referencias.ts: apagar ou renomear oferta e produto no painel não deixa referência
 * perdida onde o leigo não enxerga.
 */
type Obj = Record<string, unknown>;
const base = (): Obj => JSON.parse(JSON.stringify(arquivo));
const blocos = (c: Obj, tipo: string) => (c.blocks as Obj[]).filter((b) => b.type === tipo);
const ofertasDoConcierge = (c: Obj) =>
  (blocos(c, "concierge")[0]!.flow as { options: { offer?: string }[] }[]).map((p) => p.options.map((o) => o.offer));

describe("acompanharReferencias", () => {
  test("sem mudança em ofertas e produtos devolve o mesmo objeto", () => {
    const antes = base();
    const depois = { ...antes, profile: { ...(antes.profile as Obj), name: "Outro" } };
    expect(acompanharReferencias(antes, depois)).toBe(depois);
  });

  test("oferta apagada sai dos cards e das perguntas de contexto; na 1ª pergunta fica para a pessoa escolher", () => {
    const antes = base();
    const depois = { ...antes, offers: (antes.offers as Obj[]).filter((o) => o.id !== "mentoria") };
    const r = acompanharReferencias(antes, depois);
    expect(blocos(r, "cards")[0]!.items).toEqual(["guia"]);
    const [primeira, segunda] = ofertasDoConcierge(r);
    expect(primeira).toEqual(["mentoria", "guia", undefined]);
    expect(segunda).not.toContain("mentoria");
    // O que sobra é exatamente o que o painel mostra e aponta: a 1ª resposta da 1ª pergunta.
    const problemas = ConfigSchema.safeParse(r).error!.issues.map((i) => i.path.join("."));
    expect(problemas).toEqual(["blocks.3.flow.0.options"]);
  });

  test('com decide "ultima", oferta apagada fica em todas as perguntas (todas decidem) e o painel pede outra', () => {
    const antes = base();
    antes.blocks = (antes.blocks as Obj[]).map((b) => (b.type === "concierge" ? { ...b, decide: "ultima" } : b));
    const depois = { ...antes, offers: (antes.offers as Obj[]).filter((o) => o.id !== "mentoria") };
    const r = acompanharReferencias(antes, depois);
    const [primeira, segunda] = ofertasDoConcierge(r);
    expect(primeira).toContain("mentoria");
    expect(segunda).toContain("mentoria");
    const problemas = ConfigSchema.safeParse(r).error!.issues.map((i) => i.path.join("."));
    expect(problemas).toEqual(["blocks.3.flow.0.options", "blocks.3.flow.1.options"]);
  });

  test("identificador trocado leva cards, concierge e vitrine junto (e a config continua válida)", () => {
    const antes = base();
    const offers = (antes.offers as Obj[]).map((o) => (o.id === "mentoria" ? { ...o, id: "mentoria-vip" } : o));
    const catalog = (antes.catalog as Obj[]).map((p, i) => (i === 0 ? { ...p, id: "curso-novo" } : p));
    const comVitrine = { ...antes, blocks: (antes.blocks as Obj[]).map((b) => (b.type === "products" ? { ...b, items: [(antes.catalog as Obj[])[0]!.id] } : b)) };
    const r = acompanharReferencias(comVitrine, { ...comVitrine, offers, catalog });
    expect(blocos(r, "cards")[0]!.items).toEqual(["mentoria-vip", "guia"]);
    expect(ofertasDoConcierge(r).flat()).not.toContain("mentoria");
    expect(ofertasDoConcierge(r).flat()).toContain("mentoria-vip");
    expect(blocos(r, "products")[0]!.items).toEqual(["curso-novo"]);
    expect(ConfigSchema.safeParse(r).success).toBe(true);
  });

  test("reordenar ofertas não mexe em nada", () => {
    const antes = base();
    const depois = { ...antes, offers: [...(antes.offers as Obj[])].reverse() };
    const r = acompanharReferencias(antes, depois);
    expect(r.blocks).toBe(depois.blocks);
  });

  test("apagar o identificador para redigitar não tira a oferta dos cards", () => {
    const antes = base();
    const offers = (antes.offers as Obj[]).map((o) => (o.id === "mentoria" ? { ...o, id: "" } : o));
    const r = acompanharReferencias(antes, { ...antes, offers });
    expect(blocos(r, "cards")[0]!.items).toEqual(["mentoria", "guia"]);
  });

  test("produto apagado sai da vitrine que o listava", () => {
    const antes = base();
    const ids = (antes.catalog as Obj[]).map((p) => p.id);
    const comVitrine = { ...antes, blocks: (antes.blocks as Obj[]).map((b) => (b.type === "products" ? { ...b, items: ids.slice(0, 2) } : b)) };
    const r = acompanharReferencias(comVitrine, { ...comVitrine, catalog: (antes.catalog as Obj[]).slice(1) });
    expect(blocos(r, "products")[0]!.items).toEqual([ids[1]]);
  });
});

describe("acompanharCantos (auditoria)", () => {
  test("escolher Cantos tira o raio em px legado, que passava por cima e a escolha não mudava a bio", () => {
    const antes = { ...base(), theme: { preset: "neutro", radius: 6 } };
    const depois = { ...antes, theme: { preset: "neutro", radius: 6, corners: "retos" } };
    expect(acompanharCantos(antes, depois).theme).toEqual({ preset: "neutro", corners: "retos" });
    // Voltar ao Padrão também: vale o do modelo.
    const padrao = { ...antes, theme: { preset: "neutro", radius: 6, corners: undefined } };
    expect(acompanharCantos({ ...antes, theme: { preset: "neutro", radius: 6, corners: "retos" } }, padrao).theme).toEqual({ preset: "neutro", corners: undefined });
  });

  test("mexer só no raio em px (Avançado) ou em outra coisa não apaga nada", () => {
    const antes = { ...base(), theme: { preset: "neutro", corners: "medios" } };
    const depois = { ...antes, theme: { preset: "neutro", corners: "medios", radius: 10 } };
    expect(acompanharCantos(antes, depois)).toBe(depois);
    const outra = { ...antes, profile: { ...(antes.profile as Obj), name: "Outro" } };
    expect(acompanharCantos(antes, outra)).toBe(outra);
  });
});

describe("acompanharModelo", () => {
  test("ao trocar de modelo, tira o modo e a paleta que o novo não tem", () => {
    const antes = { theme: { preset: "noite", mode: "escuro", accent: "#f59e0b", palette: { escuro: { bg: "#0b1120" } } } };
    const depois = { theme: { ...antes.theme, preset: "editorial" } };
    expect(acompanharModelo(antes, depois)).toEqual({ theme: { preset: "editorial", accent: "#f59e0b" } });
  });

  test("neutro tem as duas versões: guarda paleta e modo", () => {
    const antes = { theme: { preset: "noite", mode: "escuro", palette: { escuro: { bg: "#0b1120" } } } };
    const depois = { theme: { ...antes.theme, preset: "neutro" } };
    expect(acompanharModelo(antes, depois)).toEqual(depois);
  });

  test("sem troca de modelo não mexe em nada", () => {
    const antes = { theme: { preset: "editorial", palette: { escuro: { bg: "#000000" } } } };
    const depois = { theme: { ...antes.theme, accent: "#123456" } };
    expect(acompanharModelo(antes, depois)).toBe(depois);
  });
});
