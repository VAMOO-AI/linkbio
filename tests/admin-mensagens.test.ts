import { describe, expect, test } from "vitest";
import { mensagemParaLeigo } from "../lib/admin/mensagens";
import { ConfigSchema } from "../config/schema";
import arquivo from "./fixtures/config-exemplo";

/** lib/admin/mensagens.ts: o painel mostra o erro sem o caminho técnico do campo. */
type Obj = Record<string, unknown>;
const base = (): Obj => JSON.parse(JSON.stringify(arquivo));
const mensagens = (cfg: Obj) => (ConfigSchema.safeParse(cfg).error?.issues ?? []).map((i) => mensagemParaLeigo(i.message));

/** Nome técnico de campo que não pode sobrar na frase: `a.b`, `a[]`, `bloco x:` e afins. */
const TECNICO = /\b[a-z_]+\[\]|\b(?:site|profile|contact|offers|catalog|theme|blocks)\.[a-z]|bloco [a-z]+:|\b(?:videoId|price_cents|reason|offer)\b/;

describe("mensagemParaLeigo", () => {
  test("tira o caminho do começo e explica o link", () => {
    expect(mensagemParaLeigo('site.url deve ser uma URL externa com https (ex.: "https://instagram.com/perfil").')).toBe(
      'Este campo deve ser um link completo, começando com https:// (ex.: "https://instagram.com/perfil").',
    );
    expect(mensagemParaLeigo("profile.name é obrigatório.")).toBe("Este campo é obrigatório.");
    expect(mensagemParaLeigo("bloco links: items[].title é obrigatório.")).toBe("Este campo é obrigatório.");
    expect(mensagemParaLeigo("concierge: opção label deve ter no máximo 40 caracteres.")).toBe("Este campo deve ter no máximo 40 caracteres.");
  });

  test("os erros que um leigo provoca no painel saem sem nome técnico", () => {
    const erros: [string, (c: Obj) => void][] = [
      ["WhatsApp com símbolos", (c) => ((c.contact as Obj).whatsapp = "(11) 98765-4321")],
      ["site sem https", (c) => ((c.site as Obj).url = "meusite.com")],
      ["nome vazio", (c) => ((c.profile as Obj).name = "")],
      ["oferta sem destino nem descrição", (c) => (c.offers as Obj[]).push({ id: "oferta-3", title: "Nova", why: "" })],
      ["oferta apagada", (c) => (c.offers = (c.offers as Obj[]).filter((o) => o.id !== "mentoria"))],
      ["sem blocos", (c) => (c.blocks = [])],
      ["vídeo sem link", (c) => (c.blocks as Obj[]).push({ type: "youtube", videoId: "https://youtube.com/watch?v=x" })],
      ["cupom minúsculo", (c) => (c.blocks as Obj[]).push({ type: "coupon", code: "bem", label: "10%", expires: "31/12/2026" })],
      ["chave Pix inválida", (c) => (c.blocks as Obj[]).push({ type: "pix", chave: "123", nome: "Fulano", cidade: "SAO PAULO" })],
      ["aviso com botão sem destino", (c) => (c.blocks as Obj[]).push({ type: "banner", title: "Oi", label: "Ver" })],
      ["imagem inválida", (c) => ((c.profile as Obj).avatar = "foto.jpg")],
      [
        'concierge "ultima" com oferta sem explicação na 2ª pergunta',
        (c) => {
          const b = (c.blocks as Obj[]).find((x) => x.type === "concierge")!;
          b.decide = "ultima";
          delete ((b.flow as Obj[])[1]!.options as Obj[])[0]!.reason;
        },
      ],
      ["concierge com quem decide inválido", (c) => ((c.blocks as Obj[]).find((x) => x.type === "concierge")!.decide = "meio")],
      ["concierge com modo inválido", (c) => ((c.blocks as Obj[]).find((x) => x.type === "concierge")!.mode = "chat")],
    ];
    for (const [caso, estraga] of erros) {
      const cfg = base();
      estraga(cfg);
      const ms = mensagens(cfg);
      expect(ms.length, caso).toBeGreaterThan(0);
      for (const m of ms) expect(m, `${caso}: "${m}"`).not.toMatch(TECNICO);
    }
  });

  test("mensagem que não reconhece passa como veio", () => {
    // Era "o bloco links precisa de ao menos 1 item.", que a auditoria passou a traduzir.
    expect(mensagemParaLeigo("Uma regra nova que o painel ainda não conhece.")).toBe("Uma regra nova que o painel ainda não conhece.");
  });
});

describe("auditoria: mensagens de quantidade de itens e de escolha sem nome técnico", () => {
  const casos: [string, string][] = [
    ["o bloco gallery precisa de ao menos 1 imagem.", "Adicione ao menos 1 imagem."],
    ["o bloco social precisa de ao menos 1 item.", "Adicione ao menos 1 rede."],
    ["o bloco links precisa de ao menos 1 item.", "Adicione ao menos 1 link."],
    ["o bloco links aceita no máximo 12 itens.", "Cabem no máximo 12 links: apague um."],
    ["o bloco testimonials precisa de ao menos 1 depoimento.", "Adicione ao menos 1 depoimento."],
    ["o bloco testimonials aceita no máximo 10 depoimentos.", "Cabem no máximo 10 depoimentos: apague um."],
    ["o bloco faq precisa de ao menos 1 pergunta.", "Adicione ao menos 1 pergunta."],
    ["o bloco faq aceita no máximo 12 perguntas.", "Cabem no máximo 12 perguntas: apague uma."],
    ["o bloco agenda precisa de ao menos 1 evento.", "Adicione ao menos 1 evento."],
    ["o bloco agenda aceita no máximo 20 eventos.", "Cabem no máximo 20 eventos: apague um."],
    ["o bloco concierge precisa de ao menos 1 passo em flow.", "O concierge precisa de ao menos 1 pergunta."],
    ["concierge: cada passo precisa de ao menos 2 opções.", "Cada pergunta precisa de ao menos 2 respostas."],
    ["concierge: cada passo aceita no máximo 4 opções.", "Cabem no máximo 4 respostas por pergunta: apague uma."],
    ["ícone social inválido. Use: instagram, tiktok, youtube, whatsapp, linkedin, facebook, x ou site.", "Escolha uma das opções."],
    ["bloco cta: action precisa ser { wa } ou { url }.", 'Escolha para onde o botão leva: "WhatsApp" ou "Link".'],
    [
      "o filtro da vitrine aceita até 6 categorias; este bloco tem 7 (a, b, c, d, e, f, g). Junte categorias ou divida em dois blocos products.",
      "O filtro da vitrine aceita até 6 categorias; esta vitrine tem 7 (a, b, c, d, e, f, g). Junte categorias ou divida em duas vitrines.",
    ],
  ];
  test.each(casos)("%s", (original, leigo) => {
    expect(mensagemParaLeigo(original)).toBe(leigo);
    expect(mensagemParaLeigo(original)).not.toMatch(TECNICO);
  });

  test("galeria nova (sem imagem) dá a frase em português pelo schema de verdade", () => {
    const cfg = base();
    (cfg.blocks as Obj[]).push({ type: "gallery", title: "Galeria", images: [] });
    expect(mensagens(cfg)).toContain("Adicione ao menos 1 imagem.");
  });
});
