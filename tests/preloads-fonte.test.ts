import { describe, expect, test } from "vitest";
import { chavesUsadas, hrefsParaPreload, urlsPublicas } from "../lib/preloads-fonte";

const CSS = `
@font-face { font-family: Plus Jakarta Sans; src: url("../media/jakarta-latim.woff2") format("woff2"); unicode-range: U+0000-00FF, U+20AC; }
@font-face { font-family: Plus Jakarta Sans; src: url("../media/jakarta-cirilico.woff2") format("woff2"); unicode-range: U+0460-052F; }
@font-face { font-family: Space Grotesk; src: url("../media/grotesk-latim.woff2") format("woff2"); unicode-range: U+0000-00FF, U+20AC; }
@font-face { font-family: Instrument Serif; src: url("../media/serif-latim.woff2") format("woff2"); unicode-range: U+??, U+20AC; }
.fontes {
  --lb-f-jakarta: "Plus Jakarta Sans", "Plus Jakarta Sans Fallback";
  --lb-f-grotesk: "Space Grotesk", "Space Grotesk Fallback";
  --lb-f-serif: "Instrument Serif", "Instrument Serif Fallback";
}
`;

describe("pré-carga da fonte usada", () => {
  test("título e texto iguais geram uma chave só; serifada mantém a Jakarta no texto", () => {
    expect(chavesUsadas({ display: "jakarta", body: "jakarta" })).toEqual(["jakarta"]);
    expect(chavesUsadas({ display: "grotesk", body: "grotesk" })).toEqual(["grotesk"]);
    expect(chavesUsadas({ display: "serif", body: "jakarta" })).toEqual(["serif", "jakarta"]);
  });

  test("só pré-carrega o arquivo latino da família usada", () => {
    expect(hrefsParaPreload({ display: "grotesk", body: "grotesk" }, CSS)).toEqual(["/_next/static/media/grotesk-latim.woff2"]);
    expect(hrefsParaPreload({ display: "jakarta", body: "jakarta" }, CSS)).toEqual(["/_next/static/media/jakarta-latim.woff2"]);
    expect(hrefsParaPreload({ display: "serif", body: "jakarta" }, CSS)).toEqual([
      "/_next/static/media/serif-latim.woff2",
      "/_next/static/media/jakarta-latim.woff2",
    ]);
  });
});

describe("caminho público da fonte", () => {
  test("resolve url relativa a partir de onde o CSS é servido (Next 16.4: immutable)", () => {
    const css = urlsPublicas(CSS, "/_next/static/immutable/chunks/abc.css");
    expect(hrefsParaPreload({ display: "grotesk", body: "grotesk" }, css)).toEqual([
      "/_next/static/immutable/media/grotesk-latim.woff2",
    ]);
  });

  test("layout antigo continua em /_next/static/media", () => {
    const css = urlsPublicas(CSS, "/_next/static/chunks/abc.css");
    expect(hrefsParaPreload({ display: "jakarta", body: "jakarta" }, css)).toEqual(["/_next/static/media/jakarta-latim.woff2"]);
  });

  test("url absoluta, data: e sem aspas", () => {
    expect(urlsPublicas('src:url(/x/a.woff2) url("data:font/woff2;base64,AA") url(../media/b.woff2)format("woff2")', "/_next/static/immutable/chunks/c.css"))
      .toBe('src:url(/x/a.woff2) url("data:font/woff2;base64,AA") url(/_next/static/immutable/media/b.woff2)format("woff2")');
  });
});
