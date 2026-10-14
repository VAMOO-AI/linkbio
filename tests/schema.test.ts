import { describe, expect, test } from "vitest";
import { ConfigSchema, defineConfig } from "../config/schema";

/**
 * F1 — schema da config (config/schema.ts).
 * Contrato: ids estáveis (slug), price_cents inteiro,
 * WhatsApp só dígitos com DDI, URL externa https, blocos validam os
 * offer_id que referenciam. Erro de config quebra o build em PT-BR.
 */

function baseBruta(): any {
  return {
    site: {
      url: "https://link.exemplo.com",
      locale: "pt-BR",
      tz: "America/Sao_Paulo",
    },
    theme: { preset: "neutro-claro", accent: "#007dff", font: "Plus Jakarta Sans", radius: 6 },
    profile: {
      name: "Nome Sobrenome",
      handle: "@perfil",
      avatar: "/avatar.jpg",
      bio: "Uma frase sobre o que você faz.",
      tags: ["Tag 1"],
    },
    contact: { whatsapp: "5511987654321" },
    offers: [
      { id: "mentoria", title: "Mentoria", why: "Por que a mentoria.", url: "https://exemplo.com/mentoria" },
    ],
    blocks: [
      { type: "profile" },
      { type: "cta", label: "Falar no WhatsApp", action: { wa: "Oi! Vim pela bio." } },
      {
        type: "concierge",
        mode: "roteiro",
        flow: [
          {
            id: "perfil",
            question: "Você é?",
            options: [
              { id: "dono", label: "Dono(a)", offer: "mentoria", reason: "Motivo." },
              { id: "gestor", label: "Gestor(a)", offer: "mentoria", reason: "Motivo." },
            ],
          },
        ],
      },
      { type: "cards", eyebrow: "Caminhos", items: ["mentoria"] },
      { type: "link", title: "@perfil", url: "https://instagram.com/perfil" },
    ],
    features: { leads: false, analytics: false },
  };
}

/** safeParse que falha o teste se a entrada for válida; devolve "path: mensagem". */
function mensagens(input: unknown): string[] {
  const r = ConfigSchema.safeParse(input);
  expect(r.success, "esperava que o schema rejeitasse a entrada").toBe(false);
  if (r.success) return [];
  return r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
}

function com(caminho: (string | number)[], valor: unknown): any {
  const cfg = baseBruta();
  let alvo: any = cfg;
  for (let i = 0; i < caminho.length - 1; i++) alvo = alvo[caminho[i] as any];
  alvo[caminho[caminho.length - 1] as any] = valor;
  return cfg;
}

describe("schema da config — casos válidos", () => {
  test("aceita config mínima válida", () => {
    expect(ConfigSchema.safeParse(baseBruta()).success).toBe(true);
  });

  test("aceita offer com price_cents zero", () => {
    const cfg = com(["offers"], [
      { id: "gratis", title: "Grátis", why: "Por quê.", url: "https://exemplo.com/g", price_cents: 0 },
    ]);
    cfg.blocks = [{ type: "profile" }];
    expect(ConfigSchema.safeParse(cfg).success).toBe(true);
  });

  test("defineConfig devolve a config (com defaults aplicados)", () => {
    const cfg = defineConfig(baseBruta());
    expect(cfg.features.pixel).toEqual({ meta: null, ga4: null });
  });

  test("aceita offer com cta e link secundário (more_label/more_url)", () => {
    const cfg = com(["offers"], [
      {
        id: "mentoria",
        title: "Mentoria",
        why: "Por que a mentoria.",
        url: "https://exemplo.com/mentoria",
        cta: "Aplicar",
        more_label: "Conhecer",
        more_url: "https://exemplo.com/sobre-mentoria",
      },
    ]);
    cfg.blocks = [{ type: "profile" }];
    const r = ConfigSchema.safeParse(cfg);
    expect(r.success).toBe(true);
  });
});

describe("schema da config — casos inválidos (mensagem em PT-BR)", () => {
  test("offer id instável (maiúscula/espaço) é rejeitado", () => {
    const cfg = com(["offers"], [
      { id: "Mentoria Top", title: "X", why: "Y.", url: "https://exemplo.com" },
    ]);
    expect(mensagens(cfg).join("\n")).toMatch(/slug estável/i);
  });

  test("price_cents fracionado é rejeitado", () => {
    const cfg = com(["offers"], [
      { id: "a", title: "A", why: "Y.", url: "https://exemplo.com", price_cents: 19.9 },
    ]);
    expect(mensagens(cfg).join("\n")).toMatch(/inteiro/);
  });

  test("price_cents negativo é rejeitado", () => {
    const cfg = com(["offers"], [
      { id: "a", title: "A", why: "Y.", url: "https://exemplo.com", price_cents: -100 },
    ]);
    expect(mensagens(cfg).join("\n")).toMatch(/negativo/);
  });

  test("whatsapp formatado (+55, espaços, hífen) é rejeitado", () => {
    expect(mensagens(com(["contact", "whatsapp"], "+55 11 98765-4321")).join("\n")).toMatch(
      /só dígitos, com DDI/i,
    );
  });

  test("whatsapp curto demais é rejeitado", () => {
    expect(mensagens(com(["contact", "whatsapp"], "9999999")).join("\n")).toMatch(
      /só dígitos, com DDI/i,
    );
  });

  test("URL externa http é rejeitada (precisa https)", () => {
    const cfg = com(["offers"], [
      { id: "a", title: "A", why: "Y.", url: "http://exemplo.com" },
    ]);
    expect(mensagens(cfg).join("\n")).toMatch(/https/);
  });

  test("cards que referencia offer_id inexistente é rejeitado", () => {
    const cfg = baseBruta();
    cfg.blocks = [{ type: "cards", items: ["oferta-fantasma"] }];
    expect(mensagens(cfg).join("\n")).toMatch(/oferta-fantasma/);
  });

  test("concierge que referencia offer_id inexistente é rejeitado", () => {
    const cfg = baseBruta();
    cfg.blocks = [
      {
        type: "concierge",
        mode: "roteiro",
        flow: [
          {
            id: "perfil",
            question: "Você é?",
            options: [
              { id: "a", label: "A", offer: "oferta-fantasma", reason: "R." },
              { id: "b", label: "B", offer: "mentoria", reason: "R." },
            ],
          },
        ],
      },
    ];
    expect(mensagens(cfg).join("\n")).toMatch(/oferta-fantasma/);
  });

  test("concierge aceita resposta sem oferta (vai direto à conversa)", () => {
    const cfg = baseBruta();
    cfg.blocks = [
      {
        type: "concierge",
        mode: "roteiro",
        flow: [
          {
            id: "momento",
            question: "Qual é o seu momento?",
            options: [
              { id: "a", label: "A", offer: "mentoria", reason: "R." },
              { id: "nao-sei", label: "Ainda não sei", reason: "Conversando eu indico.", title: "Vamos descobrir juntos", wa: "Oi! Não sei qual é o ideal." },
            ],
          },
        ],
      },
    ];
    expect(ConfigSchema.safeParse(cfg).success).toBe(true);
  });

  test("concierge: explicação (reason) só é obrigatória na 1ª pergunta", () => {
    const cfg = baseBruta();
    const passo = (id: string, options: object[]) => ({ id, question: "Pergunta?", options });
    cfg.blocks = [
      {
        type: "concierge",
        mode: "roteiro",
        flow: [
          passo("decide", [
            { id: "a", label: "A", offer: "mentoria" },
            { id: "b", label: "B", offer: "mentoria", reason: "R." },
          ]),
          passo("contexto", [
            { id: "x", label: "X" },
            { id: "y", label: "Y" },
          ]),
        ],
      },
    ];
    const msgs = mensagens(cfg).join("\n");
    expect(msgs).toMatch(/flow\.0\.options\.0\.reason: concierge: a resposta "A" da 1ª pergunta precisa de reason/);
    expect(msgs).not.toMatch(/flow\.1/);
  });

  test("concierge com offer vazio é rejeitado com a saída explicada", () => {
    const cfg = baseBruta();
    cfg.blocks = [
      {
        type: "concierge",
        mode: "roteiro",
        flow: [
          {
            id: "momento",
            question: "Qual é o seu momento?",
            options: [
              { id: "a", label: "A", offer: "", reason: "R." },
              { id: "b", label: "B", offer: "mentoria", reason: "R." },
            ],
          },
        ],
      },
    ];
    expect(mensagens(cfg).join("\n")).toMatch(/offer não pode ser vazio/);
  });

  test("defineConfig lança erro em PT-BR apontando o campo", () => {
    const cfg = com(["contact", "whatsapp"], "sem-numero");
    expect(() => defineConfig(cfg)).toThrow(/linkbio\.config\.ts[\s\S]*contact\.whatsapp/);
  });

  test("more_url http é rejeitado (precisa https)", () => {
    const cfg = com(["offers"], [
      { id: "a", title: "A", why: "Y.", url: "https://exemplo.com", more_url: "http://exemplo.com/sobre" },
    ]);
    expect(mensagens(cfg).join("\n")).toMatch(/https/);
  });

  describe("tema (Fase V)", () => {
    test("preset some com default neutro", () => {
      const cfg = baseBruta();
      cfg.theme = {} as never;
      const r = ConfigSchema.safeParse(cfg);
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.theme.preset).toBe("neutro");
    });

    test("preset fora do catálogo dá erro listando as opções", () => {
      const cfg = baseBruta();
      cfg.theme = { preset: "inexistente" } as never;
      const r = ConfigSchema.safeParse(cfg);
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0]!.message).toMatch(/"neutro".*"vibrante"/);
    });

    test("mode ou paleta que o modelo não tem não trava (o motor ignora; o check avisa)", () => {
      for (const theme of [{ preset: "noite", mode: "claro" }, { preset: "editorial", palette: { escuro: { bg: "#0b1120" } } }, { preset: "vitrine", mode: "auto" }]) {
        const cfg = baseBruta();
        cfg.theme = theme as never;
        expect(ConfigSchema.safeParse(cfg).success, JSON.stringify(theme)).toBe(true);
      }
    });

    test("fonte por chave, por par display/body e pelo nome antigo", () => {
      for (const font of ["serif", { display: "serif", body: "jakarta" }, "Plus Jakarta Sans"]) {
        const cfg = baseBruta();
        cfg.theme = { preset: "editorial", font } as never;
        expect(ConfigSchema.safeParse(cfg).success).toBe(true);
      }
    });

    test("palette aceita só cor hex", () => {
      const cfg = baseBruta();
      cfg.theme = { preset: "neutro", palette: { claro: { bg: "azul" } } } as never;
      expect(ConfigSchema.safeParse(cfg).success).toBe(false);
    });
  });

  describe("cta (Fase V · L3)", () => {
    test("aceita variant, note e pulse", () => {
      const cfg = baseBruta();
      const i = cfg.blocks.findIndex((b: { type: string }) => b.type === "cta");
      cfg.blocks[i] = { ...cfg.blocks[i], variant: "secundario", note: "Resposta no mesmo dia", pulse: true };
      expect(ConfigSchema.safeParse(cfg).success).toBe(true);
    });

    test("variant fora da lista dá erro em PT-BR", () => {
      const cfg = baseBruta();
      const i = cfg.blocks.findIndex((b: { type: string }) => b.type === "cta");
      cfg.blocks[i] = { ...cfg.blocks[i], variant: "gigante" };
      const r = ConfigSchema.safeParse(cfg);
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues.map((x) => x.message).join(" ")).toMatch(/primario.*secundario/);
    });
  });

  describe("perfil e rodapé (Fase V · L4)", () => {
    test("bloco profile aceita header, socials e cover; profile aceita socials", () => {
      const cfg = baseBruta();
      cfg.profile.socials = [{ icone: "instagram", rotulo: "Instagram", url: "https://instagram.com/x" }];
      cfg.blocks[0] = { type: "profile", header: "capa", socials: "nomes", cover: "/capa.jpg" };
      expect(ConfigSchema.safeParse(cfg).success).toBe(true);
    });

    test("header fora da lista dá erro listando as opções", () => {
      const cfg = baseBruta();
      cfg.blocks[0] = { type: "profile", header: "diagonal" };
      const r = ConfigSchema.safeParse(cfg);
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0]!.message).toMatch(/"centro".*"capa".*"lado"/);
    });

    test("imagem aceita arquivo em public/ ou URL https (enviada pelo /admin); recusa http e caminho sem barra", () => {
      const comCapa = (cover: string) => {
        const cfg = baseBruta();
        cfg.blocks[0] = { type: "profile", cover };
        return ConfigSchema.safeParse(cfg).success;
      };
      expect(comCapa("/capa.jpg")).toBe(true);
      expect(comCapa("https://exemplo.supabase.co/storage/v1/object/public/linkbio/capa.jpg")).toBe(true);
      expect(comCapa("http://x.com/capa.jpg")).toBe(false);
      expect(comCapa("capa.jpg")).toBe(false);
    });

    test("profile.socials aceita no máximo 8", () => {
      const cfg = baseBruta();
      cfg.profile.socials = Array.from({ length: 9 }, () => ({ icone: "site", rotulo: "Site", url: "https://x.com" }));
      expect(ConfigSchema.safeParse(cfg).success).toBe(false);
    });

    test("text aceita variant rodape", () => {
      const cfg = baseBruta();
      cfg.blocks.push({ type: "text", variant: "rodape", body: "Fim." });
      expect(ConfigSchema.safeParse(cfg).success).toBe(true);
    });
  });

  describe("ofertas (Fase V · L5)", () => {
    test("cards aceita layout; oferta aceita cover", () => {
      const cfg = baseBruta();
      cfg.offers[0].cover = { headline: "Olá", tag: "Novo", tone: "claro", image: "/capa.jpg" };
      cfg.blocks.push({ type: "cards", items: ["mentoria"], layout: "grade" });
      expect(ConfigSchema.safeParse(cfg).success).toBe(true);
    });

    test("layout e tone fora da lista dão erro", () => {
      const a = baseBruta();
      a.blocks.push({ type: "cards", items: ["mentoria"], layout: "mosaico" });
      expect(ConfigSchema.safeParse(a).success).toBe(false);
      const b = baseBruta();
      b.offers[0].cover = { tone: "neon" };
      expect(ConfigSchema.safeParse(b).success).toBe(false);
    });

    test("cover não aceita campo desconhecido", () => {
      const cfg = baseBruta();
      cfg.offers[0].cover = { titulo: "x" };
      expect(ConfigSchema.safeParse(cfg).success).toBe(false);
    });
  });

  describe("links (Fase V · L6)", () => {
    test("link aceita subtitle e image; bloco links aceita layout e itens", () => {
      const cfg = baseBruta();
      cfg.blocks.push({ type: "link", title: "Livro", url: "https://x.com", subtitle: "Na Amazon", image: "/capa.jpg" });
      cfg.blocks.push({ type: "links", layout: "icones", items: [{ title: "Blog", url: "https://x.com", icon: "site" }] });
      expect(ConfigSchema.safeParse(cfg).success).toBe(true);
    });

    test("bloco links exige de 1 a 12 itens e layout do catálogo", () => {
      const vazio = baseBruta();
      vazio.blocks.push({ type: "links", items: [] });
      expect(ConfigSchema.safeParse(vazio).success).toBe(false);
      const muitos = baseBruta();
      muitos.blocks.push({ type: "links", items: Array.from({ length: 13 }, () => ({ title: "x", url: "https://x.com" })) });
      expect(ConfigSchema.safeParse(muitos).success).toBe(false);
      const layout = baseBruta();
      layout.blocks.push({ type: "links", layout: "carrossel", items: [{ title: "x", url: "https://x.com" }] });
      expect(ConfigSchema.safeParse(layout).success).toBe(false);
    });

    test("item de links não aceita http nem campo desconhecido", () => {
      const http = baseBruta();
      http.blocks.push({ type: "links", items: [{ title: "x", url: "http://x.com" }] });
      expect(ConfigSchema.safeParse(http).success).toBe(false);
      const extra = baseBruta();
      extra.blocks.push({ type: "links", items: [{ title: "x", url: "https://x.com", cor: "azul" }] });
      expect(ConfigSchema.safeParse(extra).success).toBe(false);
    });
  });

  describe("concierge (Fase V · L7)", () => {
    const comConcierge = (extra: object) => {
      const cfg = baseBruta();
      const i = cfg.blocks.findIndex((b: { type: string }) => b.type === "concierge");
      cfg.blocks[i] = { ...cfg.blocks[i], ...extra };
      return cfg;
    };

    test("aceita variant e collapsed", () => {
      expect(ConfigSchema.safeParse(comConcierge({ variant: "leve", collapsed: true })).success).toBe(true);
    });

    test("variant fora do catálogo dá erro listando as opções", () => {
      const r = ConfigSchema.safeParse(comConcierge({ variant: "flutuante" }));
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues.map((x) => x.message).join(" ")).toMatch(/"destaque".*"leve"/);
    });
  });

  describe("blocos de conteúdo (Fase V · L8)", () => {
    test("aceita banner, testimonials e faq válidos", () => {
      const cfg = baseBruta();
      cfg.blocks.push(
        { type: "banner", title: "Aviso", label: "Ver", action: { url: "https://x.com" } },
        { type: "testimonials", items: [{ quote: "Muito bom.", name: "Ana" }] },
        { type: "faq", items: [{ q: "Pergunta?", a: "Resposta." }] },
      );
      expect(ConfigSchema.safeParse(cfg).success).toBe(true);
    });

    test("banner com label sem action dá erro em PT-BR", () => {
      const cfg = baseBruta();
      cfg.blocks.push({ type: "banner", title: "Aviso", label: "Ver" });
      const r = ConfigSchema.safeParse(cfg);
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues.map((x) => x.message).join(" ")).toMatch(/label exige action/);
    });

    test("testimonials e faq exigem ao menos 1 item e rejeitam campo desconhecido", () => {
      for (const bloco of [
        { type: "testimonials", items: [] },
        { type: "faq", items: [] },
        { type: "faq", items: [{ q: "x", a: "y", link: "z" }] },
      ]) {
        const cfg = baseBruta();
        cfg.blocks.push(bloco);
        expect(ConfigSchema.safeParse(cfg).success).toBe(false);
      }
    });
  });

  describe("catálogo e vitrine (Fase V · L9)", () => {
    const catalogo = [
      { id: "curso", title: "Curso", url: "https://exemplo.com/curso", price_cents: 9700, category: "Cursos" },
      { id: "livro", title: "Livro", url: "https://exemplo.com/livro", price_label: "Sob consulta", category: "Livros" },
    ];
    const comVitrine = (bloco: Record<string, unknown>, catalog: unknown[] = catalogo) => {
      const cfg = baseBruta();
      cfg.catalog = catalog;
      cfg.blocks.push({ type: "products", ...bloco });
      return cfg;
    };

    test("config sem catalog continua válida (default [])", () => {
      const r = ConfigSchema.safeParse(baseBruta());
      expect(r.success && r.data.catalog).toEqual([]);
    });

    test("aceita vitrine com filtro, layout e items do catálogo", () => {
      expect(ConfigSchema.safeParse(comVitrine({ filter: true, layout: "grade", items: ["livro", "curso"] })).success).toBe(true);
    });

    test("bloco products sem catalog dá erro em PT-BR", () => {
      expect(mensagens(comVitrine({}, [])).join("\n")).toMatch(/precisa de produtos em catalog/);
    });

    test("items com produto inexistente lista os ids disponíveis", () => {
      expect(mensagens(comVitrine({ items: ["curso", "fantasma"] })).join("\n")).toMatch(
        /produto "fantasma".*Ids disponíveis: curso, livro/,
      );
    });

    test("id repetido no catalog e nas offers é rejeitado", () => {
      expect(mensagens(comVitrine({}, [catalogo[0], catalogo[0]])).join("\n")).toMatch(/catalog tem o id "curso" repetido/);
      const cfg = baseBruta();
      cfg.offers.push(cfg.offers[0]);
      expect(mensagens(cfg).join("\n")).toMatch(/offers tem o id "mentoria" repetido/);
    });

    test("filtro com mais de 6 categorias dá erro; sem filtro, pode", () => {
      const muitos = Array.from({ length: 7 }, (_, i) => ({
        id: `p${i}`,
        title: `P${i}`,
        url: "https://exemplo.com/p",
        category: `Cat ${i}`,
      }));
      expect(mensagens(comVitrine({ filter: true }, muitos)).join("\n")).toMatch(/até 6 categorias; este bloco tem 7/);
      expect(ConfigSchema.safeParse(comVitrine({}, muitos)).success).toBe(true);
    });

    test("preço em texto e campo desconhecido são rejeitados", () => {
      expect(ConfigSchema.safeParse(comVitrine({}, [{ ...catalogo[0], price_cents: "97" }])).success).toBe(false);
      expect(ConfigSchema.safeParse(comVitrine({}, [{ ...catalogo[0], preco: 97 }])).success).toBe(false);
    });

    test("layout fora do catálogo lista as opções", () => {
      expect(mensagens(comVitrine({ layout: "lista" })).join("\n")).toMatch(/"carrossel".*"grade"/);
    });
  });

  describe("cupom (Fase V · L10)", () => {
    const comCupom = (bloco: Record<string, unknown>) => {
      const cfg = baseBruta();
      cfg.blocks.push({ type: "coupon", code: "BEMVINDA10", label: "10% na primeira compra", ...bloco });
      return cfg;
    };

    test("aceita cupom mínimo e completo", () => {
      expect(ConfigSchema.safeParse(comCupom({})).success).toBe(true);
      expect(
        ConfigSchema.safeParse(
          comCupom({ expires: "2026-12-31", cta: "Comprar", copy: true, action: { wa: "Oi! Quero usar o cupom BEMVINDA10." } }),
        ).success,
      ).toBe(true);
    });

    test("código em minúsculas, com espaço ou curto demais é rejeitado", () => {
      for (const code of ["bemvinda10", "BEM VINDA", "X"]) {
        expect(mensagens(comCupom({ code })).join("\n")).toMatch(/só letras maiúsculas/);
      }
    });

    test("data fora do formato ou inexistente é rejeitada", () => {
      expect(mensagens(comCupom({ expires: "31/12/2026" })).join("\n")).toMatch(/AAAA-MM-DD/);
      expect(mensagens(comCupom({ expires: "2026-02-30" })).join("\n")).toMatch(/não é uma data que existe/);
    });

    test("cta sem action dá erro em PT-BR", () => {
      expect(mensagens(comCupom({ cta: "Usar" })).join("\n")).toMatch(/cta exige action/);
    });
  });

  describe("liga e desliga de blocos", () => {
    test("todo tipo de bloco aceita enabled true ou false", () => {
      const cfg = baseBruta();
      cfg.blocks = cfg.blocks.map((b: Record<string, unknown>, i: number) => ({ ...b, enabled: i % 2 === 0 }));
      expect(ConfigSchema.safeParse(cfg).success).toBe(true);
    });

    test("enabled que não é booleano dá erro em PT-BR", () => {
      const cfg = baseBruta();
      cfg.blocks[1].enabled = "nao";
      expect(mensagens(cfg).join("\n")).toMatch(/enabled deve ser true ou false/);
    });
  });

  describe("achados da auditoria de 25/09", () => {
    test("id de bloco repetido dá erro", () => {
      const cfg = baseBruta();
      cfg.blocks.push({ type: "text", id: "sobre", body: "A." }, { type: "faq", id: "sobre", items: [{ q: "Q?", a: "R." }] });
      expect(mensagens(cfg).join("\n")).toMatch(/blocks tem o id "sobre" repetido/);
    });

    test("campo com erro de digitação em bloco é rejeitado (strict)", () => {
      const cfg = baseBruta();
      cfg.blocks.push({ type: "faq", open_first: true, items: [{ q: "Q?", a: "R." }] });
      expect(ConfigSchema.safeParse(cfg).success).toBe(false);
    });

    test("banner com action sem label dá erro em PT-BR", () => {
      const cfg = baseBruta();
      cfg.blocks.push({ type: "banner", title: "Aviso", action: { url: "https://exemplo.com" } });
      expect(mensagens(cfg).join("\n")).toMatch(/action exige label/);
    });

    test("paleta de um modo que o modelo não tem não é erro do schema", () => {
      const cfg = com(["theme"], { preset: "noite", palette: { claro: { bg: "#ffffff" } } });
      expect(ConfigSchema.safeParse(cfg).success).toBe(true);
    });

    test("categoria vazia, só espaços ou 'Todos' dá erro em PT-BR; espaço sobrando é aparado", () => {
      const comCat = (category: string) => {
        const cfg = baseBruta();
        cfg.catalog = [{ id: "p", title: "P", url: "https://exemplo.com/p", category }];
        return cfg;
      };
      expect(mensagens(comCat("   ")).join("\n")).toMatch(/category não pode ser vazia/);
      expect(mensagens(comCat("todos")).join("\n")).toMatch(/não pode ser "Todos"/);
      const r = ConfigSchema.safeParse(comCat("Cursos "));
      expect(r.success && r.data.catalog[0]!.category).toBe("Cursos");
    });

    test("nenhuma mensagem de campo vazio sai em inglês", () => {
      const cfg = baseBruta();
      cfg.catalog = [{ id: "p", title: "P", url: "https://exemplo.com/p", price_label: "", cta: "" }];
      cfg.blocks.push({ type: "products", items: [] }, { type: "banner", title: "T", label: "", action: { url: "https://x.com" } });
      const msgs = mensagens(cfg).join("\n");
      expect(msgs).not.toMatch(/Too small|expected/);
      expect(msgs).toMatch(/price_label não pode ser vazio/);
      expect(msgs).toMatch(/items precisa de ao menos 1 produto/);
    });
  });
});


describe("bio sem oferta (só links é válida)", () => {
  const soWhatsapp = {
    type: "concierge",
    mode: "roteiro",
    flow: [
      {
        id: "momento",
        question: "Qual é o seu momento?",
        options: [
          { id: "a", label: "Começando", reason: "Conversando eu indico o caminho." },
          { id: "b", label: "Já faço", reason: "Me conta onde travou." },
        ],
      },
    ],
  };

  test("aceita offers vazio, com concierge só de WhatsApp", () => {
    const cfg = com(["offers"], []);
    cfg.blocks = [{ type: "profile" }, soWhatsapp, { type: "link", title: "@perfil", url: "https://instagram.com/perfil" }];
    expect(ConfigSchema.safeParse(cfg).success).toBe(true);
  });

  test("offers pode faltar no arquivo: vira lista vazia", () => {
    const cfg = baseBruta();
    delete cfg.offers;
    cfg.blocks = [{ type: "profile" }];
    const r = ConfigSchema.safeParse(cfg);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.offers).toEqual([]);
  });

  describe("pix e agenda", () => {
    const comPix = (bloco: Record<string, unknown>) => {
      const cfg = baseBruta();
      cfg.blocks.push({
        type: "pix",
        chave: "123e4567-e12b-12d1-a456-426655440000",
        nome: "Fulano de Tal",
        cidade: "BRASILIA",
        ...bloco,
      });
      return cfg;
    };

    test("aceita Pix mínimo e com valor", () => {
      expect(ConfigSchema.safeParse(comPix({})).success).toBe(true);
      expect(ConfigSchema.safeParse(comPix({ valor_cents: 4990, txid: "consulta", copy: true })).success).toBe(true);
    });

    test("chave, nome, cidade e txid inválidos explicam em português", () => {
      expect(mensagens(comPix({ chave: "111.444.777-35" })).join("\n")).toMatch(/CPF|telefone|e-mail|aleatória/);
      expect(mensagens(comPix({ nome: "Este nome passa de vinte e cinco" })).join("\n")).toMatch(/25 caracteres/);
      expect(mensagens(comPix({ cidade: "Cidade comprida demais" })).join("\n")).toMatch(/15 caracteres/);
      expect(mensagens(comPix({ txid: "tem espaço" })).join("\n")).toMatch(/sem espaço nem acento/);
      expect(mensagens(comPix({ valor_cents: 0 })).join("\n")).toMatch(/maior que zero/);
    });

    test("aceita agenda e recusa evento com id repetido, hora impossível ou link http", () => {
      const cfg = baseBruta();
      cfg.blocks.push({
        type: "agenda",
        items: [{ id: "encontro", title: "Aula", date: "2099-06-15", time: "19:00", duration: 60 }],
      });
      expect(ConfigSchema.safeParse(cfg).success).toBe(true);
      cfg.blocks.push({
        type: "agenda",
        items: [{ id: "encontro", title: "Outra", date: "2099-07-01" }],
      });
      expect(mensagens(cfg).join("\n")).toMatch(/agenda tem o id "encontro" repetido/);
      const hora = baseBruta();
      hora.blocks.push({ type: "agenda", items: [{ id: "a", title: "A", date: "2099-06-15", time: "25:00" }] });
      expect(mensagens(hora).join("\n")).toMatch(/HH:MM/);
      const http = baseBruta();
      http.blocks.push({ type: "agenda", items: [{ id: "a", title: "A", date: "2026-02-30", place: "http://sala.test" }] });
      expect(mensagens(http).join("\n")).toMatch(/não é uma data que existe/);
      expect(mensagens(http).join("\n")).toMatch(/https/);
    });

    test("tipo desconhecido lista pix e agenda", () => {
      const cfg = baseBruta();
      cfg.blocks.push({ type: "mapa" });
      expect(mensagens(cfg).join("\n")).toMatch(/pix, agenda/);
    });
  });

  test("bloco cards sem itens é aceito (some da página)", () => {
    const cfg = com(["offers"], []);
    cfg.blocks = [{ type: "profile" }, { type: "cards", items: [] }];
    expect(ConfigSchema.safeParse(cfg).success).toBe(true);
  });
});

describe("pixel e tipo de perfil", () => {
  test("sem tipo, o padrão é pessoa; empresa é aceito", () => {
    const cfg = defineConfig(baseBruta());
    expect(cfg.profile.tipo).toBe("pessoa");
    const empresa = ConfigSchema.parse(com(["profile", "tipo"], "empresa"));
    expect(empresa.profile.tipo).toBe("empresa");
  });

  test("tipo fora de pessoa ou empresa é rejeitado", () => {
    expect(mensagens(com(["profile", "tipo"], "ong")).join("\n")).toMatch(/pessoa/);
  });

  test("aceita IDs de pixel no formato certo e trata vazio como desligado", () => {
    const ok = ConfigSchema.parse(com(["features"], { pixel: { meta: "123456789012345", ga4: "G-AB12CD34" } }));
    expect(ok.features.pixel).toEqual({ meta: "123456789012345", ga4: "G-AB12CD34" });
    const vazio = ConfigSchema.parse(com(["features"], { pixel: { meta: "  ", ga4: "" } }));
    expect(vazio.features.pixel).toEqual({ meta: null, ga4: null });
    const curto = ConfigSchema.parse(com(["features"], { pixel: { meta: "1234567890", ga4: null } }));
    expect(curto.features.pixel.meta).toBe("1234567890");
    const longo = ConfigSchema.parse(com(["features"], { pixel: { meta: "12345678901234567890", ga4: null } }));
    expect(longo.features.pixel.meta).toBe("12345678901234567890");
  });

  test("rejeita ID da Meta com letra, curto ou longo demais", () => {
    for (const meta of ["abc1234567890", "123456789", "123456789012345678901"]) {
      expect(mensagens(com(["features"], { pixel: { meta, ga4: null } })).join("\n"), meta).toMatch(/Pixel da Meta/);
    }
  });

  test("rejeita ID do Google Analytics fora do formato G-", () => {
    for (const ga4 of ["UA-123456", "g-AB12CD34", "G-", "AB12CD34"]) {
      expect(mensagens(com(["features"], { pixel: { meta: null, ga4 } })).join("\n"), ga4).toMatch(/Google Analytics/);
    }
  });
});

describe("bloco lead", () => {
  const lead = (extra: Record<string, unknown> = {}) => {
    const cfg = baseBruta();
    cfg.blocks.push({
      type: "lead",
      id: "planner",
      title: "Planner grátis",
      label: "Quero receber",
      pedir: "whatsapp",
      sucesso: "Pronto, olhe seu WhatsApp.",
      ...extra,
    });
    return cfg;
  };

  test("aceita o mínimo e preenche um consentimento curto", () => {
    const r = ConfigSchema.safeParse(lead());
    expect(r.success).toBe(true);
    if (!r.success) return;
    const b = r.data.blocks.at(-1);
    expect(b?.type).toBe("lead");
    if (b?.type === "lead") expect(b.consentimento.length).toBeGreaterThan(20);
  });

  test("aceita e-mail, os dois campos e o link do material", () => {
    expect(ConfigSchema.safeParse(lead({ pedir: "email" })).success).toBe(true);
    expect(ConfigSchema.safeParse(lead({ pedir: "ambos", entrega: { url: "https://exemplo.com/planner.pdf" } })).success).toBe(true);
  });

  test("pedir inválido, http e campo desconhecido são rejeitados", () => {
    expect(mensagens(lead({ pedir: "telefone" })).join("\n")).toMatch(/whatsapp.*email.*ambos/);
    expect(ConfigSchema.safeParse(lead({ entrega: { url: "http://exemplo.com/a.pdf" } })).success).toBe(false);
    expect(ConfigSchema.safeParse(lead({ cor: "azul" })).success).toBe(false);
  });

  test("id que não é slug é rejeitado e o tipo entra na lista de blocos", () => {
    expect(mensagens(lead({ id: "Planner" })).join("\n")).toMatch(/slug/);
    const cfg = baseBruta();
    cfg.blocks.push({ type: "foguete" });
    expect(mensagens(cfg).join("\n")).toMatch(/lead/);
  });
});

describe("janela visivel", () => {
  test("cada bloco da config de exemplo aceita visivel com data e com hora", () => {
    const cfg = baseBruta();
    cfg.blocks = cfg.blocks.map((b: Record<string, unknown>) => ({
      ...b,
      visivel: { de: "2026-10-01T09:00", ate: "2026-10-31" },
    }));
    expect(ConfigSchema.safeParse(cfg).success).toBe(true);
  });

  test("rejeita data inexistente, hora impossível e de depois de ate", () => {
    const cfg = baseBruta();
    cfg.blocks[0] = { type: "profile", visivel: { de: "2026-02-30" } };
    expect(mensagens(cfg).join("\n")).toMatch(/não é uma data que existe/);
    cfg.blocks[0] = { type: "profile", visivel: { ate: "2026-10-13T24:00" } };
    expect(mensagens(cfg).join("\n")).toMatch(/horário que existe|AAAA-MM-DD/);
    cfg.blocks[0] = { type: "profile", visivel: { de: "2026-10-14", ate: "2026-10-13T18:00" } };
    expect(mensagens(cfg).join("\n")).toMatch(/não pode ser depois/);
  });

  test("de com hora no mesmo dia de um ate sem hora continua válido", () => {
    const cfg = baseBruta();
    cfg.blocks[0] = { type: "profile", visivel: { de: "2026-10-13T15:00", ate: "2026-10-13" } };
    expect(ConfigSchema.safeParse(cfg).success).toBe(true);
  });
});
