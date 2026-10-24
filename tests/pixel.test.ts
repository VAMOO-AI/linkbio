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
    ).toEqual({ meta: "123456789012345", ga4: "G-DOAMBIENTE", clarity: null });
  });

  test("ID inválido na variável de ambiente não liga o script", () => {
    expect(
      idsEfetivos({ meta: null, ga4: null }, { META_PIXEL_ID: "nao-e-id", GA4_MEASUREMENT_ID: "UA-1", CLARITY_PROJECT_ID: "Com Espaço" }),
    ).toEqual({ meta: null, ga4: null, clarity: null });
  });

  test("sem config e sem ambiente, nada é ligado", () => {
    expect(idsEfetivos(undefined, {})).toEqual({ meta: null, ga4: null, clarity: null });
  });

  test("Clarity segue a mesma regra: config primeiro, depois CLARITY_PROJECT_ID", () => {
    expect(idsEfetivos({ clarity: "abc123defg" }, { CLARITY_PROJECT_ID: "zzz999zzzz" }).clarity).toBe("abc123defg");
    expect(idsEfetivos({ clarity: null }, { CLARITY_PROJECT_ID: "zzz999zzzz" }).clarity).toBe("zzz999zzzz");
  });
});

describe("script do aviso", () => {
  test("sem ID válido não há script; com ID, o texto só entra nessa string", () => {
    expect(scriptDeCookies({ meta: null, ga4: null, clarity: null })).toBeNull();
    expect(scriptDeCookies({ meta: "abc", ga4: "UA-1", clarity: "tem espaço" })).toBeNull();
    const js = scriptDeCookies({ meta: "123456789012345", ga4: "G-AB12CD34", clarity: null });
    expect(js).toContain("linkbio-cookies");
    expect(js).toContain("123456789012345");
    expect(js).toContain("G-AB12CD34");
    expect(js).toContain("wa=1");
    expect(js).not.toContain("<script");
    expect(js).not.toContain("clarity.ms");
  });

  test("só com Clarity também há aviso, e o script do Clarity só entra nessa string", () => {
    const js = scriptDeCookies({ meta: null, ga4: null, clarity: "abc123defg" });
    expect(js).toContain("linkbio-cookies");
    expect(js).toContain("https://www.clarity.ms/tag/");
    expect(js).toContain("abc123defg");
    expect(js).toContain('"set","origem"');
    expect(js).not.toContain("fbevents");
    expect(js).not.toContain("googletagmanager");
  });

  test("o script gerado é JavaScript válido em toda combinação de serviços", () => {
    const opcoes = [null, "x"];
    for (const m of opcoes) for (const g of opcoes) for (const c of opcoes) {
      const js = scriptDeCookies({ meta: m && "123456789012345", ga4: g && "G-AB12CD34", clarity: c && "abc123defg" });
      if (js === null) continue;
      expect(() => new Function(js), `${m}/${g}/${c}`).not.toThrow();
      // As regexes do script dependem do escape dentro da template string.
      expect(js).toContain("/^\\/r\\/([a-z0-9.-]+)/");
      expect(js).toContain("wa\\.me|api\\.whatsapp\\.com");
    }
  });

  test("o script escuta os eventos da bio: lead, agendamento e toques contados", () => {
    const js = scriptDeCookies({ meta: "123456789012345", ga4: "G-AB12CD34", clarity: "abc123defg" }) ?? "";
    expect(js).toContain("linkbio:evento");
    expect(js).toContain("data-linkbio-evento");
    expect(js).toContain('"Lead"');
    expect(js).toContain("eventID");
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
