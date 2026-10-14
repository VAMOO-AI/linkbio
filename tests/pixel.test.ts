import { describe, expect, test } from "vitest";
import { scriptDeCookies } from "../lib/aviso-cookies";
import { avisosDePixel, idsEfetivos } from "../lib/pixel";

describe("ids do pixel", () => {
  test("a config manda; a variável de ambiente só entra se o campo estiver vazio", () => {
    expect(
      idsEfetivos(
        { meta: "123456789012345", ga4: null },
        { META_PIXEL_ID: "999999999999", GA4_MEASUREMENT_ID: "G-DOAMBIENTE" },
      ),
    ).toEqual({ meta: "123456789012345", ga4: "G-DOAMBIENTE" });
  });

  test("ID inválido na variável de ambiente não liga o script", () => {
    expect(idsEfetivos({ meta: null, ga4: null }, { META_PIXEL_ID: "nao-e-id", GA4_MEASUREMENT_ID: "UA-1" })).toEqual({
      meta: null,
      ga4: null,
    });
  });

  test("sem config e sem ambiente, nada é ligado", () => {
    expect(idsEfetivos(undefined, {})).toEqual({ meta: null, ga4: null });
  });
});

describe("script do aviso", () => {
  test("sem ID válido não há script; com ID, o texto só entra nessa string", () => {
    expect(scriptDeCookies(null, null)).toBeNull();
    expect(scriptDeCookies("abc", "UA-1")).toBeNull();
    const js = scriptDeCookies("123456789012345", "G-AB12CD34");
    expect(js).toContain("linkbio-cookies");
    expect(js).toContain("123456789012345");
    expect(js).toContain("G-AB12CD34");
    expect(js).not.toContain("<script");
  });
});

describe("avisos do check", () => {
  test("avisa quando a variável de ambiente não parece um ID, e não cobra a variável se a config já tem o ID", () => {
    const soConfig = avisosDePixel({ meta: "123456789012345", ga4: "G-AB12CD34" }, {});
    expect(soConfig).toEqual([]);
    const ambiente = avisosDePixel({ meta: null, ga4: null }, { META_PIXEL_ID: "pixel", GA4_MEASUREMENT_ID: "G-OK123" });
    expect(ambiente.join("\n")).toMatch(/META_PIXEL_ID/);
    expect(ambiente.join("\n")).not.toMatch(/GA4_MEASUREMENT_ID/);
  });
});
