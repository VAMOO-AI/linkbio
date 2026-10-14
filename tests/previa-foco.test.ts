import { describe, expect, it } from "vitest";
import { alvoDoCaminho } from "@/app/(admin)/admin/previa-foco";
import { alvoValido } from "@/lib/previa";

const cfg = {
  offers: [{ id: "mentoria" }, { id: "guia" }],
  catalog: [{ id: "caneca" }, { id: "camiseta" }],
  blocks: [{ type: "profile" }, { type: "cards", items: ["mentoria", "guia"] }],
};

describe("alvoDoCaminho (a prévia segue a edição)", () => {
  it("bloco aberto ou campo dele vai ao bloco, contando os desligados como o painel conta", () => {
    expect(alvoDoCaminho(["blocks.1"], cfg)).toEqual({ bloco: 1 });
    expect(alvoDoCaminho(["blocks.4.items.0", "blocks.4"], cfg)).toEqual({ bloco: 4 });
  });

  it("oferta aberta dentro do bloco de cards vai ao card daquele bloco", () => {
    expect(alvoDoCaminho(["offers.1.cover", "offers.1", "blocks.1"], cfg)).toEqual({ bloco: 1, oferta: "guia" });
  });

  it("oferta e produto fora de bloco vão pelo id, não pela posição", () => {
    expect(alvoDoCaminho(["offers.0"], cfg)).toEqual({ oferta: "mentoria" });
    expect(alvoDoCaminho(["catalog.1"], cfg)).toEqual({ produto: "camiseta" });
  });

  it("Perfil vai ao topo e Contato ao botão do WhatsApp", () => {
    expect(alvoDoCaminho(["profile.socials.0", "profile"], cfg)).toEqual({ perfil: true });
    expect(alvoDoCaminho(["contact"], cfg)).toEqual({ whatsapp: true });
  });

  it("Aparência, Site, lista sem índice e item que não existe não pedem nada", () => {
    expect(alvoDoCaminho(["theme"], cfg)).toBeNull();
    expect(alvoDoCaminho(["site.share", "site"], cfg)).toBeNull();
    expect(alvoDoCaminho(["offers"], cfg)).toBeNull();
    expect(alvoDoCaminho(["offers.9"], cfg)).toBeNull();
    expect(alvoDoCaminho([], cfg)).toBeNull();
  });
});

describe("alvoValido (recado que chega ao quadro)", () => {
  it("aceita os formatos do contrato", () => {
    for (const a of [{ bloco: 0 }, { bloco: 3, oferta: "guia" }, { oferta: "x" }, { produto: "y" }, { perfil: true }, { whatsapp: true }]) expect(alvoValido(a)).toBe(true);
  });
  it("recusa o resto", () => {
    for (const a of [null, [], {}, "x", { bloco: -1 }, { bloco: 1.5 }, { bloco: "2" }, { oferta: 1 }, { perfil: false }, { outra: 1 }]) expect(alvoValido(a)).toBe(false);
  });
});
