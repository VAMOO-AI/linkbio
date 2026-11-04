import { describe, expect, it } from "vitest";
import { ConfigSchema } from "@/config/schema";
import {
  lerEnvioEngajamento,
  nomesDasSecoes,
  resumirEngajamento,
  type LinhaEngajamento,
} from "@/lib/engajamento";
import type { LinhaVisita } from "@/lib/cliques";
import configExemplo from "./fixtures/config-exemplo";

const HOJE = "2026-11-04";
const CHAVES = ["profile-0", "cupom", "cta-0", "faq-0"];
const SECOES = [
  { chave: "profile-0", nome: "Perfil" },
  { chave: "cupom", nome: "Cupom: 15% OFF" },
  { chave: "cta-0", nome: "Botão: Falar no WhatsApp" },
  { chave: "faq-0", nome: "Perguntas" },
];

const visita = (origem: string, total: number, dia = HOJE): LinhaVisita => ({ dia, origem, total });
const linha = (tipo: LinhaEngajamento["tipo"], chave: string, total: number, origem = "bio", dia = HOJE): LinhaEngajamento => ({
  dia,
  tipo,
  chave,
  origem,
  total,
});

describe("lerEnvioEngajamento", () => {
  it("aceita só chaves que existem na bio, sem repetir", () => {
    const e = lerEnvioEngajamento(
      { origem: "Stories", secoes: ["cupom", "cupom", "inventada", 3, "cta-0"], toques: ["faq-0", "../x"], rapida: true },
      CHAVES,
    );
    expect(e).toEqual({ origem: "stories", secoes: ["cupom", "cta-0"], toques: ["faq-0"], rapida: true });
  });

  it("corpo estranho vira envio vazio de origem direto", () => {
    expect(lerEnvioEngajamento(null, CHAVES)).toEqual({ origem: "direto", secoes: [], toques: [], rapida: false });
    expect(lerEnvioEngajamento({ secoes: "cupom", rapida: "sim" }, CHAVES)).toEqual({
      origem: "direto",
      secoes: [],
      toques: [],
      rapida: false,
    });
  });

  it("lista maior que a bio é cortada no número de blocos", () => {
    const muitas = Array.from({ length: 500 }, () => "cupom");
    expect(lerEnvioEngajamento({ secoes: muitas }, CHAVES).secoes).toEqual(["cupom"]);
  });
});

describe("resumirEngajamento", () => {
  it("rolagem: % das visitas de 30 dias que chegaram em cada seção, na ordem da bio", () => {
    const r = resumirEngajamento(
      [linha("secao", "cupom", 91), linha("secao", "profile-0", 100), linha("secao", "faq-0", 31), linha("secao", "fora", 9)],
      [visita("bio", 60), visita("stories", 40)],
      SECOES,
      [],
      HOJE,
    );
    expect(r.visitas30).toBe(100);
    expect(r.secoes.map((s) => [s.chave, s.pct])).toEqual([
      ["profile-0", 100],
      ["cupom", 91],
      ["cta-0", 0],
      ["faq-0", 31],
    ]);
  });

  it("fora da janela de 30 dias não conta e o % não passa de 100", () => {
    const r = resumirEngajamento(
      [linha("secao", "profile-0", 50), linha("secao", "profile-0", 500, "bio", "2026-09-01")],
      [visita("bio", 40)],
      SECOES,
      [],
      HOJE,
    );
    expect(r.secoes[0]!.vistas30).toBe(50);
    expect(r.secoes[0]!.pct).toBe(100);
  });

  it("sem visita, o % fica vazio", () => {
    const r = resumirEngajamento([linha("secao", "cupom", 3)], [], SECOES, [], HOJE);
    expect(r.secoes[1]!.pct).toBeNull();
  });

  it("só divide pelas visitas desde o primeiro dia com rolagem medida (antes não havia como contar)", () => {
    // Bio com contagem há semanas, rolagem medida só a partir de ontem.
    const r = resumirEngajamento(
      [linha("secao", "profile-0", 10, "bio", "2026-11-03"), linha("secao", "profile-0", 10), linha("saida_rapida", "", 5, "bio")],
      [visita("bio", 300, "2026-10-15"), visita("bio", 10, "2026-11-03"), visita("bio", 10)],
      SECOES,
      [],
      HOJE,
    );
    expect(r.visitas30).toBe(20);
    expect(r.secoes[0]!.pct).toBe(100);
    expect(r.saidas[0]!.pct).toBe(25);
    expect(r.poucasVisitas).toBe(true);
  });

  it("sem nenhuma rolagem medida ainda, não há visita para dividir", () => {
    const r = resumirEngajamento([], [visita("bio", 80)], SECOES, [], HOJE);
    expect(r.visitas30).toBe(0);
    expect(r.secoes[0]!.pct).toBeNull();
  });

  it("saída rápida por origem: saídas ÷ visitas daquela origem", () => {
    const r = resumirEngajamento(
      [linha("saida_rapida", "", 30, "stories"), linha("saida_rapida", "", 5, "bio")],
      [visita("stories", 50), visita("bio", 100)],
      SECOES,
      [],
      HOJE,
    );
    expect(r.saidas.map((s) => [s.origem, s.pct])).toEqual([
      ["stories", 60],
      ["bio", 5],
    ]);
  });
});

describe("alertas", () => {
  const visitas = [visita("bio", 70), visita("stories", 50)];

  it("com poucas visitas não aponta nada", () => {
    const r = resumirEngajamento([linha("toque_sem_link", "cupom", 20)], [visita("bio", 29)], SECOES, [], HOJE);
    expect(r.poucasVisitas).toBe(true);
    expect(r.alertas).toEqual([]);
  });

  it("botão mais tocado aparece como sinal bom", () => {
    const r = resumirEngajamento(
      [linha("secao", "profile-0", 120)],
      visitas,
      SECOES,
      [{ nome: "Ativar cupom", dias7: 10, dias30: 40 }, { nome: "Loja", dias7: 1, dias30: 10 }],
      HOJE,
    );
    const a = r.alertas.find((x) => x.tipo === "campeao");
    expect(a?.nivel).toBe("bom");
    expect(a?.titulo).toContain("Ativar cupom");
    expect(a?.texto).toContain("80%");
  });

  it("toque sem link na seção com mais toques perdidos", () => {
    const r = resumirEngajamento(
      [linha("toque_sem_link", "profile-0", 12), linha("toque_sem_link", "faq-0", 3)],
      visitas,
      SECOES,
      [],
      HOJE,
    );
    const a = r.alertas.find((x) => x.tipo === "toque_sem_link");
    expect(a?.nivel).toBe("atencao");
    expect(a?.titulo).toContain("Perfil");
    expect(a?.numero).toBe(12);
  });

  it("queda grande de uma seção para a seguinte", () => {
    const r = resumirEngajamento(
      [linha("secao", "profile-0", 120), linha("secao", "cupom", 110), linha("secao", "cta-0", 50), linha("secao", "faq-0", 40)],
      visitas,
      SECOES,
      [],
      HOJE,
    );
    const a = r.alertas.find((x) => x.tipo === "queda");
    expect(a?.titulo).toContain("Botão: Falar no WhatsApp");
    expect(a?.texto).toContain("92%");
    expect(a?.texto).toContain("42%");
  });

  it("origem com muita saída rápida vira alerta vermelho", () => {
    const r = resumirEngajamento([linha("saida_rapida", "", 25, "stories"), linha("saida_rapida", "", 3, "bio")], visitas, SECOES, [], HOJE);
    const a = r.alertas.find((x) => x.tipo === "saida_rapida");
    expect(a?.nivel).toBe("ruim");
    expect(a?.titulo).toContain("Stories");
    expect(a?.numero).toBe(25);
  });

  it("números pequenos ou normais não geram alerta", () => {
    const r = resumirEngajamento(
      [linha("toque_sem_link", "cupom", 2), linha("saida_rapida", "", 5, "stories"), linha("secao", "profile-0", 120), linha("secao", "cupom", 100)],
      visitas,
      SECOES.slice(0, 2),
      [{ nome: "Loja", dias7: 1, dias30: 3 }],
      HOJE,
    );
    expect(r.poucasVisitas).toBe(false);
    expect(r.alertas).toEqual([]);
  });
});

describe("nomesDasSecoes", () => {
  it("usa a mesma chave da contagem de cliques e o nome do bloco com o título", () => {
    const cfg = structuredClone(configExemplo) as Record<string, unknown>;
    cfg.blocks = [
      { type: "profile" },
      { type: "cta", id: "falar", label: "Falar comigo", action: { wa: "Oi!" } },
      { type: "text", body: "Oi" },
      { type: "text", body: "Escondido", enabled: false },
      { type: "divider" },
    ];
    const config = ConfigSchema.parse(cfg);
    expect(nomesDasSecoes(config, new Date("2026-11-04T12:00:00Z"))).toEqual([
      { chave: "profile-0", nome: "Perfil" },
      { chave: "falar", nome: "Botão principal: Falar comigo" },
      { chave: "text-0", nome: "Texto: Oi" },
    ]);
  });
});
