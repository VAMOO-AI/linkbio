import { describe, expect, test } from "vitest";
import exemplo from "./fixtures/config-exemplo";
import type { LinkbioConfig } from "../config/schema";
import { resolverTema } from "../lib/resolver";
import {
  capaPropria,
  cortarTexto,
  dadosDeCompartilhar,
  ehEnderecoDoExemplo,
  encaixeDaCapa,
  enderecoBase,
  iniciais,
  linkComPreviaNova,
  textosDoLink,
  modoDaCapa,
  podeBaixar,
  versaoDaCapa,
} from "../lib/compartilhar";

/** lib/compartilhar.ts: a lógica da capa ao compartilhar (texto, escolha da capa, metadados). */
const com = (mudar: (c: LinkbioConfig) => void): LinkbioConfig => {
  const c = structuredClone(exemplo);
  mudar(c);
  return c;
};

describe("cortarTexto", () => {
  test("texto curto fica igual, só com os espaços arrumados", () => {
    expect(cortarTexto("  Olá,\n  tudo   bem? ", 50)).toBe("Olá, tudo bem?");
  });
  test("texto longo corta na palavra, com reticências, dentro do limite", () => {
    const r = cortarTexto("Ajudo pessoas ocupadas a organizar a rotina em quinze minutos por dia", 30);
    expect(r).toBe("Ajudo pessoas ocupadas a…");
    expect(r.length).toBeLessThanOrEqual(30);
  });
  test("não deixa pontuação antes das reticências", () => {
    expect(cortarTexto("Primeira parte, segunda parte bem comprida", 17)).toBe("Primeira parte…");
  });
  test("palavra única enorme é cortada no meio", () => {
    expect(cortarTexto("a".repeat(40), 10)).toBe(`${"a".repeat(9)}…`);
  });
});

describe("iniciais", () => {
  test("primeiro e último nome", () => {
    expect(iniciais("Marina Duarte")).toBe("MD");
    expect(iniciais("ana maria de souza")).toBe("AS");
    expect(iniciais("Érico")).toBe("É");
  });
  test("ignora emoji e símbolo solto; vazio vira ?", () => {
    expect(iniciais("✨ Studio Luz")).toBe("SL");
    expect(iniciais("  ")).toBe("?");
  });
});

describe("enderecoBase", () => {
  test("site.url de verdade é usado como está", () => {
    expect(enderecoBase("https://bio.minhamarca.com.br", { VERCEL_PROJECT_PRODUCTION_URL: "x.vercel.app" }).origin).toBe(
      "https://bio.minhamarca.com.br",
    );
  });
  test("site.url do exemplo cai no domínio de produção da Vercel, depois no do deploy", () => {
    expect(ehEnderecoDoExemplo("https://link.exemplo.com")).toBe(true);
    expect(enderecoBase("https://link.exemplo.com", { VERCEL_PROJECT_PRODUCTION_URL: "minha-bio.vercel.app" }).origin).toBe(
      "https://minha-bio.vercel.app",
    );
    expect(enderecoBase("https://link.exemplo.com", { VERCEL_URL: "minha-bio-abc123.vercel.app" }).origin).toBe(
      "https://minha-bio-abc123.vercel.app",
    );
  });
  test("fora da Vercel, sem saída melhor, fica o site.url", () => {
    expect(enderecoBase("https://link.exemplo.com", {}).origin).toBe("https://link.exemplo.com");
  });
  test("domínio que só contém a palavra não é o exemplo", () => {
    expect(ehEnderecoDoExemplo("https://meuexemplo.com.br")).toBe(false);
  });
});

describe("capa própria x automática e metadados", () => {
  const base = new URL("https://bio.minhamarca.com.br");

  test("sem site.share: capa automática, título nome + @, texto = bio", () => {
    expect(capaPropria(exemplo)).toBeNull();
    const d = dadosDeCompartilhar(exemplo, base);
    expect(d.titulo).toBe("Marina Duarte @marina.exemplo");
    expect(d.descricao).toBe(exemplo.profile.bio);
    expect(d.url).toBe("https://bio.minhamarca.com.br/");
    expect(d.nomeDoSite).toBe("Marina Duarte");
    expect(d.imagem).toMatchObject({ width: 1200, height: 630, type: "image/jpeg" });
    expect(d.imagem.url).toMatch(/^https:\/\/bio\.minhamarca\.com\.br\/capa\.jpg\?v=[0-9a-z]+$/);
    expect(d.imagem.alt).toBe("Foto, nome e bio de Marina Duarte (@marina.exemplo)");
  });

  test("capa própria e textos próprios substituem os automáticos", () => {
    const c = com((x) => {
      x.site.share = { image: "/gallery-2.svg", title: "Mentoria Rotina Leve", description: "Vagas abertas" };
    });
    expect(capaPropria(c)).toBe("/gallery-2.svg");
    const d = dadosDeCompartilhar(c, base);
    expect(d.titulo).toBe("Mentoria Rotina Leve");
    expect(d.descricao).toBe("Vagas abertas");
    expect(d.imagem.alt).toBe("Mentoria Rotina Leve");
  });

  test("só o título próprio: a imagem continua a automática", () => {
    const c = com((x) => {
      x.site.share = { title: "Só o título" };
    });
    expect(capaPropria(c)).toBeNull();
    expect(dadosDeCompartilhar(c, base).descricao).toBe(exemplo.profile.bio);
  });

  test("a URL da imagem muda quando o que aparece na capa muda (o WhatsApp baixa de novo)", () => {
    const v = versaoDaCapa(exemplo);
    expect(versaoDaCapa(structuredClone(exemplo))).toBe(v);
    expect(versaoDaCapa(com((x) => (x.profile.bio = "Outra bio")))).not.toBe(v);
    expect(versaoDaCapa(com((x) => (x.theme.preset = "noite")))).not.toBe(v);
    expect(versaoDaCapa(com((x) => (x.site.share = { image: "/gallery-2.svg" })))).not.toBe(v);
    // O que não aparece na capa não muda a URL.
    expect(versaoDaCapa(com((x) => (x.features.leads = true)))).toBe(v);
  });
});

describe("modoDaCapa", () => {
  test("segue o modo que a página mostra primeiro", () => {
    expect(modoDaCapa(resolverTema({ preset: "neutro" }))).toBe("claro");
    expect(modoDaCapa(resolverTema({ preset: "neutro", mode: "escuro" }))).toBe("escuro");
    expect(modoDaCapa(resolverTema({ preset: "noite" }))).toBe("escuro");
    expect(modoDaCapa(resolverTema({ preset: "editorial" }))).toBe("claro");
  });
});

describe("podeBaixar", () => {
  const storage = "https://abc.supabase.co/storage/v1/object/public/linkbio/2026-09-30/x.jpg";
  test("só o Storage do Supabase do projeto", () => {
    expect(podeBaixar(storage, "https://abc.supabase.co")).toBe(true);
    expect(podeBaixar(storage, "https://outro.supabase.co")).toBe(false);
    expect(podeBaixar(storage)).toBe(true);
    expect(podeBaixar("https://abc.supabase.co/rest/v1/site_config", "https://abc.supabase.co")).toBe(false);
    expect(podeBaixar("https://site.com/storage/v1/object/public/x.jpg")).toBe(false);
    expect(podeBaixar("http://abc.supabase.co/storage/v1/object/public/x.jpg")).toBe(false);
    expect(podeBaixar("não é url")).toBe(false);
  });
  test("o Supabase local (http) vale só quando é o do SUPABASE_URL", () => {
    expect(podeBaixar("http://127.0.0.1:54321/storage/v1/object/public/linkbio/x.jpg", "http://127.0.0.1:54321")).toBe(true);
  });
});

describe("schema de site.share", () => {
  test("aceita vazio, imagem local ou https, e recusa texto grande demais ou campo desconhecido", async () => {
    const { ConfigSchema } = await import("../config/schema");
    const valida = (share: unknown) => ConfigSchema.safeParse({ ...exemplo, site: { ...exemplo.site, share } }).success;
    expect(valida(undefined)).toBe(true);
    expect(valida({})).toBe(true);
    expect(valida({ image: "/capa.jpg", title: "Título", description: "Texto" })).toBe(true);
    expect(valida({ image: "https://abc.supabase.co/storage/v1/object/public/linkbio/x.jpg" })).toBe(true);
    expect(valida({ image: "capa.jpg" })).toBe(false);
    expect(valida({ title: "x".repeat(71) })).toBe(false);
    expect(valida({ description: "x".repeat(201) })).toBe(false);
    expect(valida({ imagem: "/capa.jpg" })).toBe(false);
  });
});

describe("encaixeDaCapa (capa própria: recortar ou encaixar inteira)", () => {
  test("1200 x 630 e proporção até ~10% longe da 1,91:1: recorta (cobre tudo)", () => {
    expect(encaixeDaCapa(1200, 630)).toBe("cobrir");
    expect(encaixeDaCapa(2400, 1260)).toBe("cobrir");
    expect(encaixeDaCapa(1200, 628)).toBe("cobrir");
    expect(encaixeDaCapa(1200, 700)).toBe("cobrir"); // 1,71:1, no limite de baixo
    expect(encaixeDaCapa(1250, 600)).toBe("cobrir"); // 2,08:1, perto do limite de cima
    expect(encaixeDaCapa(1600, 900)).toBe("cobrir"); // 16:9 (1,78:1): perde ~3% de cada lado
  });

  test("banner largo (o do cliente, 2940 x 1010), quadrada e vertical: entra inteira", () => {
    expect(encaixeDaCapa(2940, 1010)).toBe("encaixar");
    expect(encaixeDaCapa(1080, 1080)).toBe("encaixar");
    expect(encaixeDaCapa(1080, 1920)).toBe("encaixar");
    expect(encaixeDaCapa(1200, 720)).toBe("encaixar"); // 1,67:1, passa dos 10%
    expect(encaixeDaCapa(1400, 600)).toBe("encaixar"); // 2,33:1
  });

  test("tamanho desconhecido: recorta (o comportamento de antes)", () => {
    expect(encaixeDaCapa(0, 0)).toBe("cobrir");
    expect(encaixeDaCapa(Number.NaN, 630)).toBe("cobrir");
  });
});

describe("textos e link do cartão (usados também na prévia do painel)", () => {
  const perfil = { name: "Marina Duarte", handle: "@marina", bio: "Bio" };

  test("sem textos próprios (ou vazios, enquanto digita no painel): nome + @ e a bio", () => {
    expect(textosDoLink(perfil)).toEqual({ titulo: "Marina Duarte @marina", descricao: "Bio" });
    expect(textosDoLink(perfil, { title: "", description: "" })).toEqual({ titulo: "Marina Duarte @marina", descricao: "Bio" });
    expect(textosDoLink(perfil, { title: "T", description: "D" })).toEqual({ titulo: "T", descricao: "D" });
  });

  test("link com prévia nova: a raiz do site com ?v=, sem caminho nem barra a mais", () => {
    expect(linkComPreviaNova("https://bio.minhamarca.com.br", "abc1")).toBe("https://bio.minhamarca.com.br/?v=abc1");
    expect(linkComPreviaNova("https://bio.minhamarca.com.br/", "abc1")).toBe("https://bio.minhamarca.com.br/?v=abc1");
    expect(linkComPreviaNova("https://minha-bio.vercel.app/admin", "x")).toBe("https://minha-bio.vercel.app/?v=x");
  });
});
