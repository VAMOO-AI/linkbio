import sharp from "sharp";
import { describe, expect, test, vi } from "vitest";
import exemplo from "./fixtures/config-exemplo";
import { PRESETS } from "../config/presets";
import type { LinkbioConfig } from "../config/schema";
import { LIMITE_CAPA_BYTES } from "../lib/compartilhar";

vi.mock("server-only", () => ({}));
const { capaDeImagem, gerarCapa } = await import("../lib/capa");

/** lib/capa.tsx: a imagem da capa sai em JPG 1200 x 630, abaixo de 300 KB, em qualquer modelo. */
async function conferir(config: LinkbioConfig, modo?: "claro" | "escuro") {
  const capa = await gerarCapa(config, { modo });
  const meta = await sharp(capa.corpo).metadata();
  expect(capa.tipo).toBe("image/jpeg");
  expect(meta.format).toBe("jpeg");
  expect([meta.width, meta.height]).toEqual([1200, 630]);
  expect(capa.corpo.length).toBeLessThan(LIMITE_CAPA_BYTES);
  return capa;
}

const com = (mudar: (c: LinkbioConfig) => void): LinkbioConfig => {
  const c = structuredClone(exemplo);
  mudar(c);
  return c;
};

describe("gerarCapa", () => {
  for (const preset of Object.keys(PRESETS) as (keyof typeof PRESETS)[]) {
    for (const modo of Object.keys(PRESETS[preset].paletas) as ("claro" | "escuro")[]) {
      test(`modelo ${preset} (${modo}), com foto`, async () => {
        await conferir(com((c) => ((c.theme = { preset }), (c.profile.avatar = "/gallery-1.svg"))), modo);
      }, 30_000);
    }
  }

  test("sem foto (a padrão) e com foto que não abre: iniciais, sem erro", async () => {
    await conferir(exemplo);
    await conferir(com((c) => (c.profile.avatar = "/nao-existe.jpg")));
    await conferir(com((c) => (c.profile.avatar = "https://outro-site.com/foto.jpg")));
  }, 30_000);

  test("nome e bio enormes cabem (cortados)", async () => {
    await conferir(
      com((c) => {
        c.profile.name = "Maria Eduarda Albuquerque de Vasconcelos Pereira";
        c.profile.bio = "Palavra ".repeat(35);
      }),
    );
  }, 30_000);

  test("capa própria é recortada em 1200 x 630 e sai diferente da automática", async () => {
    const automatica = await conferir(exemplo);
    const propria = await conferir(com((c) => (c.site.share = { image: "/gallery-2.svg" })));
    expect(propria.corpo.equals(automatica.corpo)).toBe(false);
  }, 30_000);

  test("capa própria que não abre cai na automática", async () => {
    const automatica = await conferir(exemplo);
    const quebrada = await conferir(com((c) => (c.site.share = { image: "/sumiu.jpg" })));
    expect(quebrada.corpo.equals(automatica.corpo)).toBe(true);
  }, 30_000);
});

/**
 * Imagem de teste com uma faixa colorida em cada borda (vermelha à esquerda, verde à direita, azul em
 * cima, laranja embaixo), como o texto que o banner do cliente tinha na lateral: se a capa recortar a
 * borda, a faixa some.
 */
async function comFaixas(w: number, h: number, formato: "png" | "jpeg" = "png"): Promise<Buffer> {
  const f = (n: number) => Math.round(n * 0.08);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#808080"/>
    <rect x="0" y="0" width="${f(w)}" height="${h}" fill="#ff0000"/><rect x="${w - f(w)}" y="0" width="${f(w)}" height="${h}" fill="#00ff00"/>
    <rect x="${f(w)}" y="0" width="${w - 2 * f(w)}" height="${f(h)}" fill="#0000ff"/><rect x="${f(w)}" y="${h - f(h)}" width="${w - 2 * f(w)}" height="${f(h)}" fill="#ff8000"/></svg>`;
  const s = sharp(Buffer.from(svg));
  return formato === "png" ? s.png().toBuffer() : s.jpeg({ quality: 95 }).toBuffer();
}

/** Cor do pixel (x, y) da capa. */
async function cor(jpg: Buffer, x: number, y: number): Promise<[number, number, number]> {
  const { data, info } = await sharp(jpg).raw().toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * info.channels;
  return [data[i]!, data[i + 1]!, data[i + 2]!];
}
const perto = (a: [number, number, number], b: [number, number, number]) => a.every((v, i) => Math.abs(v - b[i]!) < 40);
const VERMELHO: [number, number, number] = [255, 0, 0];
const VERDE: [number, number, number] = [0, 255, 0];
const AZUL: [number, number, number] = [0, 0, 255];
const LARANJA: [number, number, number] = [255, 128, 0];

describe("capaDeImagem (capa própria sem perder conteúdo)", () => {
  async function conferirJpg(corpo: Buffer) {
    const meta = await sharp(corpo).metadata();
    expect(meta.format).toBe("jpeg");
    expect([meta.width, meta.height]).toEqual([1200, 630]);
    expect(corpo.length).toBeLessThan(LIMITE_CAPA_BYTES);
  }

  test("banner 2,9:1 (o do cliente): entra inteiro, com as duas laterais, sobre fundo desfocado", async () => {
    const c = await capaDeImagem(await comFaixas(2940, 1010));
    await conferirJpg(c.corpo);
    expect(c).toMatchObject({ encaixe: "encaixar", largura: 2940, altura: 1010 });
    // Ocupa a largura toda (1200 x 412, no meio): a faixa da direita, que o recorte cortava, está lá.
    expect(perto(await cor(c.corpo, 1195, 315), VERDE)).toBe(true);
    expect(perto(await cor(c.corpo, 4, 315), VERMELHO)).toBe(true);
    expect(perto(await cor(c.corpo, 600, 115), AZUL)).toBe(true);
    expect(perto(await cor(c.corpo, 600, 515), LARANJA)).toBe(true);
    // Sobra em cima e embaixo: fundo, não a imagem (nem branco, nem preto chapado).
    const sobra = await cor(c.corpo, 600, 20);
    expect(perto(sobra, AZUL)).toBe(false);
  }, 30_000);

  test("quadrada e vertical 9:16: inteiras no meio, com as quatro faixas", async () => {
    for (const [w, h, formato] of [
      [1080, 1080, "png"],
      [1080, 1920, "jpeg"],
    ] as const) {
      const c = await capaDeImagem(await comFaixas(w, h, formato));
      await conferirJpg(c.corpo);
      expect(c.encaixe).toBe("encaixar");
      const largura = Math.round((630 * w) / h);
      const esquerda = Math.round((1200 - largura) / 2);
      expect(perto(await cor(c.corpo, esquerda + 6, 315), VERMELHO)).toBe(true);
      expect(perto(await cor(c.corpo, esquerda + largura - 6, 315), VERDE)).toBe(true);
      expect(perto(await cor(c.corpo, 600, 6), AZUL)).toBe(true);
      expect(perto(await cor(c.corpo, 600, 624), LARANJA)).toBe(true);
    }
  }, 30_000);

  test("1200 x 630 exata: cobre tudo, sem fundo (as faixas ficam nas bordas da capa)", async () => {
    const c = await capaDeImagem(await comFaixas(1200, 630));
    await conferirJpg(c.corpo);
    expect(c.encaixe).toBe("cobrir");
    expect(perto(await cor(c.corpo, 4, 315), VERMELHO)).toBe(true);
    expect(perto(await cor(c.corpo, 1195, 315), VERDE)).toBe(true);
    expect(perto(await cor(c.corpo, 600, 4), AZUL)).toBe(true);
  }, 30_000);

  test("foto vertical do celular (EXIF girado): mede e encaixa já em pé", async () => {
    // 1920 x 1080 gravada deitada, com a marca de girar 90 graus: em pé, é 1080 x 1920.
    const deitada = await sharp(await comFaixas(1920, 1080)).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const c = await capaDeImagem(deitada);
    expect(c).toMatchObject({ encaixe: "encaixar", largura: 1080, altura: 1920 });
  }, 30_000);

  test("gerarCapa diz de onde veio a capa e como a própria entrou", async () => {
    expect((await gerarCapa(exemplo)).origem).toBe("automatica");
    const propria = await gerarCapa(com((c) => (c.site.share = { image: "/gallery-2.svg" })));
    expect(propria.origem).toBe("propria");
    expect(propria.encaixe).toBeDefined();
    expect((await gerarCapa(com((c) => (c.site.share = { image: "/sumiu.jpg" })))).origem).toBe("automatica");
  }, 30_000);
});
