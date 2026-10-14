import { describe, expect, test } from "vitest";
import { formatarPreco, idDoYoutube, idLivre, lerPreco, normalizarArroba, normalizarChavePix, normalizarCupom, normalizarTxid, normalizarUrl, normalizarWhatsapp } from "../lib/admin/normalizar";
import { ConfigSchema } from "../config/schema";
import arquivo from "../linkbio.config";

/** lib/admin/normalizar.ts: o que o leigo digita no painel vira o que o schema aceita. */
describe("idDoYoutube", () => {
  test.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PL123",
    "https://youtube.com/watch?feature=share&v=dQw4w9WgXcQ",
    "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ?si=abcDEF123",
    "youtu.be/dQw4w9WgXcQ",
    "www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "https://www.youtube.com/live/dQw4w9WgXcQ?feature=share",
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    "  dQw4w9WgXcQ  ",
  ])("%s vira o id", (link) => {
    expect(idDoYoutube(link)).toBe("dQw4w9WgXcQ");
  });

  test.each(["https://vimeo.com/123456", "https://www.youtube.com/@canal", "não é link", ""])(
    "%s volta como veio (o schema explica)",
    (texto) => {
      expect(idDoYoutube(texto)).toBe(texto.trim());
    },
  );
});

describe("normalizarWhatsapp", () => {
  test.each([
    ["(11) 98765-4321", "5511987654321"], // ficticio
    ["11 98765-4321", "5511987654321"], // ficticio
    ["+55 (11) 98765-4321", "5511987654321"], // ficticio
    ["0055 11 98765-4321", "5511987654321"], // ficticio
    ["5511987654321", "5511987654321"], // ficticio
    ["(47) 3333-4444", "554733334444"], // ficticio
    ["(55) 99999-8888", "5555999998888"], // ficticio
    ["+1 415 555 2671", "14155552671"], // ficticio
  ])("%s → %s", (entrada, saida) => {
    expect(normalizarWhatsapp(entrada)).toBe(saida);
  });
});

describe("lerPreco", () => {
  test.each([
    ["R$ 1.290,50", 129050],
    ["r$1290,50", 129050],
    ["1290,50", 129050],
    ["1290.50", 129050],
    ["1.290", 129000],
    ["1.290.000", 129000000],
    ["1,290.50", 129050],
    ["49,9", 4990],
    ["49.9", 4990],
    ["490", 49000],
    ["0", 0],
    ["Grátis", 0],
  ] as const)("%s → %i centavos", (entrada, centavos) => {
    expect(lerPreco(entrada)).toBe(centavos);
  });

  test("vazio é sem preço", () => {
    expect(lerPreco("   ")).toBeUndefined();
  });

  test.each(["abc", "12,345", "1,2,3", "-10", "R$", "10 reais"])("%s não é preço", (entrada) => {
    expect(lerPreco(entrada === "R$" ? "R$ x" : entrada)).toBeNull();
  });

  test("formatarPreco volta no formato brasileiro e lerPreco entende o próprio formato", () => {
    for (const c of [0, 990, 4990, 129050, 129000000]) expect(lerPreco(formatarPreco(c))).toBe(c);
    expect(formatarPreco(129050)).toBe("1.290,50");
  });
});

describe("normalizarUrl", () => {
  test.each([
    ["instagram.com/perfil", "https://instagram.com/perfil"],
    ["www.meusite.com.br", "https://www.meusite.com.br"],
    ["http://exemplo.com/a?b=1", "https://exemplo.com/a?b=1"],
    ["https://exemplo.com", "https://exemplo.com"],
    ["  meusite.com.br  ", "https://meusite.com.br"],
    ["", ""],
    ["mailto:a@b.com", "mailto:a@b.com"],
    ["meu site", "meu site"],
    ["/pagina", "/pagina"],
  ])("%s → %s", (entrada, saida) => {
    expect(normalizarUrl(entrada)).toBe(saida);
  });
});

describe("normalizarCupom e idLivre", () => {
  test("cupom: maiúsculo, sem espaço e sem acento", () => {
    expect(normalizarCupom("bem vinda10")).toBe("BEMVINDA10");
    expect(normalizarCupom("promoção_5")).toBe("PROMOCAO_5");
  });

  test("idLivre não repete e passa no schema", () => {
    expect(idLivre("oferta", ["oferta-1", "guia", "oferta-2"])).toBe("oferta-3");
    const id = idLivre("oferta", arquivo.offers.map((o) => o.id));
    const cfg = { ...arquivo, offers: [...arquivo.offers, { id, title: "Nova", why: "Texto", wa: "Oi" }] };
    expect(ConfigSchema.safeParse(cfg).success).toBe(true);
  });
});

describe("normalizarChavePix e txid", () => {
  test.each([
    ["111.444.777-35", "11144477735"],
    ["11.222.333/0001-81", "11222333000181"],
    ["(11) 98888-7777", "+5511988887777"], // ficticio
    ["+55 11 98888-7777", "+5511988887777"], // ficticio
    ["Fulano@Example.com", "fulano@example.com"],
    ["123E4567-E12B-12D1-A456-426655440000", "123e4567-e12b-12d1-a456-426655440000"],
    ["11144477735", "11144477735"],
  ])("%s → %s", (entrada, saida) => {
    expect(normalizarChavePix(entrada)).toBe(saida);
  });

  test("txid tira acento e espaço e corta em 25", () => {
    expect(normalizarTxid("Consulta de março")).toBe("Consultademarco");
    expect(normalizarTxid("***")).toBe("");
    expect(normalizarTxid("a".repeat(40))).toHaveLength(25);
  });
});

describe("normalizarArroba", () => {
  test.each([
    ["ana.leiga", "@ana.leiga"],
    ["@ana.leiga", "@ana.leiga"],
    ["https://www.instagram.com/ana.leiga/", "@ana.leiga"],
    ["instagram.com/ana_leiga?igsh=abc", "@ana_leiga"],
    ["https://www.tiktok.com/@ana.leiga", "@ana.leiga"],
    ["", ""],
    ["Ana Leiga", "Ana Leiga"],
  ])("%s → %s", (entrada, saida) => {
    expect(normalizarArroba(entrada)).toBe(saida);
  });
});
