import { describe, expect, test } from "vitest";
import exemplo from "./fixtures/config-exemplo";
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
  diaNoFuso,
  ehRobo,
  hrefConcierge,
  hrefDoClique,
  linksDeOrigem,
  normalizarOrigem,
  origemDoPedido,
  resumirCliques,
} from "@/lib/cliques";
import { resolverDestino } from "@/lib/cliques-destino";

const DIRETO = "https://exemplo.com/planner";

describe("href do clique", () => {
  test("sem contagem, o link continua o destino direto", () => {
    expect(hrefDoClique(null, DIRETO)).toBe(DIRETO);
    expect(hrefDoClique(undefined, DIRETO)).toBe(DIRETO);
  });

  test("com contagem, o link passa pelo atalho /r/", () => {
    expect(hrefDoClique(alvoCta("falar-whatsapp"), DIRETO)).toBe("/r/cta.falar-whatsapp");
    expect(hrefConcierge("concierge", ["perdida", "pouco"])).toBe("/r/concierge.concierge?r=perdida.pouco");
  });
});

describe("alvo estável", () => {
  test("bloco com id usa o id; sem id usa tipo e posição", () => {
    const blocos = [{ type: "cta", id: "falar" }, { type: "cta" }, { type: "link" }];
    expect(chavesDosBlocos(blocos)).toEqual(["falar", "cta-1", "link-0"]);
    expect(alvoCta("cta-1")).toBe("cta.cta-1");
  });

  test("sem id, mudar a ordem muda a chave", () => {
    const semId = { type: "cta" };
    const comId = { type: "cta", id: "falar" };
    expect(chavesDosBlocos([comId, semId])[1]).toBe("cta-1");
    expect(chavesDosBlocos([semId, comId])[0]).toBe("cta-0");
  });
});

describe("origem", () => {
  test("normaliza para minúsculas, números e hífen, até 20", () => {
    expect(normalizarOrigem("Stories")).toBe("stories");
    expect(normalizarOrigem("reels-2")).toBe("reels-2");
    expect(normalizarOrigem("BIO")).toBe("bio");
  });

  test("origem inválida vira direto", () => {
    expect(normalizarOrigem("")).toBe("direto");
    expect(normalizarOrigem(null)).toBe("direto");
    expect(normalizarOrigem("com espaço")).toBe("direto");
    expect(normalizarOrigem("a".repeat(21))).toBe("direto");
    expect(normalizarOrigem("foo_bar")).toBe("direto");
    expect(normalizarOrigem("https://evil.example")).toBe("direto");
  });

  test("lê src do próprio atalho ou, se não vier, do Referer da bio", () => {
    expect(origemDoPedido("https://bio.exemplo/?src=stories", null)).toBe("stories");
    expect(origemDoPedido("https://bio.exemplo/r/cta.x", "https://bio.exemplo/?src=reels")).toBe("reels");
    expect(origemDoPedido("https://bio.exemplo/r/cta.x?src=bio", "https://bio.exemplo/?src=reels")).toBe("bio");
    expect(origemDoPedido("https://bio.exemplo/r/cta.x", "https://bio.exemplo/")).toBe("direto");
    expect(origemDoPedido("https://bio.exemplo/r/cta.x", null)).toBe("direto");
  });
});

describe("robô", () => {
  test("navegador comum conta; crawler, prefetch e o preview do WhatsApp não", () => {
    expect(ehRobo("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15")).toBe(false);
    expect(ehRobo("Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36 WhatsApp/2.23.24.76")).toBe(false);
    expect(ehRobo("WhatsApp/2.23.20.0")).toBe(true);
    expect(ehRobo("facebookexternalhit/1.1")).toBe(true);
    expect(ehRobo("Facebot")).toBe(true);
    expect(ehRobo("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(true);
    expect(ehRobo("Mozilla/5.0", { purpose: "prefetch" })).toBe(true);
    expect(ehRobo("Mozilla/5.0", { secPurpose: "prefetch" })).toBe(true);
  });
});

describe("resolução do destino", () => {
  test("cada botão da config aponta para o destino dele, nunca para um endereço livre", () => {
    expect(resolverDestino(exemplo, "cta.falar-whatsapp", null)?.url).toBe(
      "https://wa.me/5511987654321?text=Oi!%20Vim%20pela%20sua%20bio.",
    );
    expect(resolverDestino(exemplo, "banner.nova-turma", null)?.url).toContain("wa.me/5511987654321");
    expect(resolverDestino(exemplo, "link.planner", null)?.url).toBe("https://exemplo.com/planner");
    expect(resolverDestino(exemplo, "links.acompanhe.2", null)?.url).toBe("https://exemplo.com/blog");
    expect(resolverDestino(exemplo, alvoOfertaUrl("mentoria"), null)?.url).toBe("https://exemplo.com/mentoria");
    expect(resolverDestino(exemplo, alvoOfertaMais("mentoria"), null)?.url).toBe("https://exemplo.com/mentoria-sobre");
    expect(resolverDestino(exemplo, alvoOfertaWa("guia"), null)?.url).toContain("wa.me/5511987654321");
    expect(resolverDestino(exemplo, alvoProduto("curso-rotina"), null)?.url).toBe("https://exemplo.com/curso-rotina");
    expect(resolverDestino(exemplo, alvoCupom("cupom-boas-vindas"), null)?.url).toBe("https://exemplo.com/curso-rotina");
    expect(resolverDestino(exemplo, alvoPerfil(0), null)?.url).toBe("https://instagram.com/marina.exemplo");
    expect(resolverDestino(exemplo, alvoBanner("nova-turma"), null)?.nome).toBe("Quero entrar");
    expect(resolverDestino(exemplo, alvoLink("planner"), null)?.nome).toBe("Planner semanal grátis");
    expect(resolverDestino(exemplo, alvoItemLinks("acompanhe", 0), null)?.nome).toBe("@marina.exemplo");
  });

  test("o botão final do concierge reconstrói a mensagem a partir das respostas da config", () => {
    const r = resolverDestino(exemplo, "concierge.concierge", "nao-sei.pouco");
    expect(r?.url.startsWith("https://wa.me/5511987654321?text=")).toBe(true);
    expect(decodeURIComponent(r!.url)).toContain("Vim pelo concierge: Ainda não sei · Até 15 min");
    expect(resolverDestino(exemplo, alvoConciergeMais("concierge", "mentoria"), null)?.url).toBe(
      "https://exemplo.com/mentoria-sobre",
    );
  });

  test("alvo desconhecido ou endereço livre não vira destino", () => {
    expect(resolverDestino(exemplo, "https://evil.example", null)).toBeNull();
    expect(resolverDestino(exemplo, "//evil.example", null)).toBeNull();
    expect(resolverDestino(exemplo, "cta.nao-existe", null)).toBeNull();
    expect(resolverDestino(exemplo, "oferta.mentoria.url", "https://evil.example")?.url).toBe("https://exemplo.com/mentoria");
    expect(resolverDestino(exemplo, "concierge.concierge", "texto-livre")).toBeNull();
    expect(resolverDestino(exemplo, "produto.curso-rotina", "https://evil.example")?.url).toBe("https://exemplo.com/curso-rotina");
  });

  test("bloco social sem id usa tipo e posição", () => {
    const cfg = {
      ...exemplo,
      blocks: [
        ...exemplo.blocks,
        { type: "social" as const, items: [{ icone: "site" as const, rotulo: "Site", url: "https://exemplo.com/site" }] },
      ],
    };
    expect(resolverDestino(cfg, alvoRede("social-0", 0), null)?.url).toBe("https://exemplo.com/site");
  });
});

describe("resumo", () => {
  test("soma 7 e 30 dias no fuso da bio e nomeia o botão", () => {
    expect(diaNoFuso("America/Sao_Paulo", new Date("2026-10-13T02:30:00Z"))).toBe("2026-10-12");
    expect(diaNoFuso("America/Sao_Paulo", new Date("2026-10-13T15:00:00Z"))).toBe("2026-10-13");
    const nomes = new Map([["cta.falar-whatsapp", "Falar no WhatsApp"]]);
    const r = resumirCliques(
      [
        { dia: "2026-10-13", alvo: "cta.falar-whatsapp", origem: "stories", total: 2 },
        { dia: "2026-10-01", alvo: "cta.falar-whatsapp", origem: "bio", total: 4 },
        { dia: "2026-09-01", alvo: "cta.falar-whatsapp", origem: "bio", total: 9 },
        { dia: "2026-10-13", alvo: "sumiu", origem: "reels", total: 1 },
      ],
      nomes,
      "2026-10-13",
    );
    expect(r.botoes[0]).toEqual({ nome: "Falar no WhatsApp", dias7: 2, dias30: 6 });
    expect(r.botoes.find((b) => b.nome === "Botão que saiu da bio")?.dias7).toBe(1);
    expect(r.origens.find((o) => o.origem === "stories")).toMatchObject({ rotulo: "Stories", dias7: 2, dias30: 2 });
    expect(r.origens.find((o) => o.origem === "bio")).toMatchObject({ rotulo: "Bio", dias7: 0, dias30: 4 });
  });

  test("links para copiar levam a origem na bio", () => {
    expect(linksDeOrigem("https://link.exemplo.com")).toEqual([
      { rotulo: "Bio", url: "https://link.exemplo.com/?src=bio" },
      { rotulo: "Stories", url: "https://link.exemplo.com/?src=stories" },
      { rotulo: "Reels", url: "https://link.exemplo.com/?src=reels" },
    ]);
  });
});
