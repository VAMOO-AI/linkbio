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
      if (c) expect(js).toContain("/^\\/r\\/([a-z0-9.-]+)/");
      expect(js).toContain("wa\\.me|api\\.whatsapp\\.com");
    }
  });

  /** Roda o script num DOM mínimo e devolve as chamadas ao clarity e o texto do aviso. */
  function rodar(js: string, guardado: string | null, clicar?: "Aceitar" | "Recusar") {
    const chamadas: unknown[][] = [];
    const botoes: Record<string, () => void> = {};
    let aviso = "";
    const el = (): any => ({
      setAttribute() {}, appendChild() {}, remove() {}, parentNode: { insertBefore() {} },
      set textContent(v: string) { aviso = aviso || v; }, get textContent() { return aviso; },
      addEventListener(_t: string, fn: () => void) { botoes[(this as any).rotulo] = fn; },
    });
    const documento = {
      readyState: "complete", documentElement: { getAttribute: () => null },
      createElement: () => el(), getElementsByTagName: () => [el()], querySelector: () => null,
      addEventListener() {}, body: { appendChild() {} },
    };
    const janela: any = {};
    const armazenado: Record<string, string> = guardado ? { "linkbio-cookies": guardado } : {};
    const localStorage = { getItem: (k: string) => armazenado[k] ?? null, setItem: (k: string, v: string) => { armazenado[k] = v; } };
    // O botão guarda o rótulo antes do addEventListener (textContent) — aqui basta o b.textContent virar a chave.
    const criar = documento.createElement;
    documento.createElement = () => { const e = criar(); Object.defineProperty(e, "textContent", { set(v: string) { e.rotulo = v; if (!aviso) aviso = v; }, get() { return e.rotulo; } }); return e; };
    new Function("window", "document", "localStorage", js)(janela, documento, localStorage);
    const registrar = () => { for (const q of janela.clarity?.q ?? []) chamadas.push(Array.from(q)); };
    if (clicar) botoes[clicar]?.();
    registrar();
    return { chamadas, aviso, temClarity: typeof janela.clarity === "function" };
  }

  test("Clarity sem cookies (padrão): grava antes do aceite com consentimento negado e concede só no Aceitar", () => {
    const js = scriptDeCookies({ meta: null, ga4: null, clarity: "abc123defg" }) ?? "";
    expect(js).not.toMatch(/clarity\("consent"\)/);
    const antes = rodar(js, null);
    expect(antes.temClarity).toBe(true);
    expect(antes.chamadas).toContainEqual(["consentv2", { ad_Storage: "denied", analytics_Storage: "denied" }]);
    expect(antes.chamadas).not.toContainEqual(["consentv2", { ad_Storage: "denied", analytics_Storage: "granted" }]);
    expect(antes.aviso).toContain("nada fica guardado no seu aparelho");
    const aceitou = rodar(js, null, "Aceitar");
    expect(aceitou.chamadas.at(-1)).toEqual(["consentv2", { ad_Storage: "denied", analytics_Storage: "granted" }]);
    const recusou = rodar(js, "recusado");
    expect(recusou.chamadas).toContainEqual(["consentv2", { ad_Storage: "denied", analytics_Storage: "denied" }]);
    const jaAceito = rodar(js, "aceito");
    expect(jaAceito.chamadas).toContainEqual(["consentv2", { ad_Storage: "denied", analytics_Storage: "granted" }]);
    expect(jaAceito.chamadas).not.toContainEqual(["consentv2", { ad_Storage: "denied", analytics_Storage: "denied" }]);
  });

  test("com claritySemCookies desligado, o Clarity espera o aceite como o Pixel", () => {
    const js = scriptDeCookies({ meta: null, ga4: null, clarity: "abc123defg" }, { claritySemCookies: false }) ?? "";
    const antes = rodar(js, null);
    expect(antes.temClarity).toBe(false);
    expect(antes.aviso).toContain("Nada disso é carregado se você recusar.");
    expect(rodar(js, "recusado").temClarity).toBe(false);
    expect(rodar(js, null, "Aceitar").chamadas).toContainEqual(["consentv2", { ad_Storage: "denied", analytics_Storage: "granted" }]);
  });

  test("sem Clarity, o texto do aviso continua o de sempre", () => {
    const js = scriptDeCookies({ meta: "123456789012345", ga4: null, clarity: null }) ?? "";
    expect(js).toContain("Nada disso é carregado se você recusar.");
    expect(js).not.toContain("consentv2");
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
