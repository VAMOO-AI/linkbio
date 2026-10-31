import { describe, expect, test } from "vitest";
import { ConfigSchema } from "../config/schema";
import { cssDeOrigem, lerOrigemDoEnvio, origemDaBusca, origemDoReferrer, scriptDaOrigem, semColunaDeOrigem } from "../lib/origem";
import configExemplo from "./fixtures/config-exemplo";

/** Conteúdo por origem (v0.9.0): de onde a pessoa veio decide quais blocos aparecem. */

describe("origem da URL", () => {
  test("src ganha de utm_source; os dois passam pela mesma normalização dos cliques", () => {
    expect(origemDaBusca("?src=Stories&utm_source=ig")).toBe("stories");
    expect(origemDaBusca("?utm_source=Instagram")).toBe("instagram");
    expect(origemDaBusca("?src=  reels ")).toBe("reels");
  });

  test("sem origem, origem inválida ou \"direto\" é null", () => {
    expect(origemDaBusca("")).toBeNull();
    expect(origemDaBusca("?src=com espaço")).toBeNull();
    expect(origemDaBusca(`?src=${"a".repeat(21)}`)).toBeNull();
    expect(origemDaBusca("?src=direto")).toBeNull();
    expect(origemDaBusca("?src=&utm_source=bio")).toBe("bio");
  });
});

describe("campo origem nos blocos", () => {
  function comBloco(origem: unknown) {
    const cfg = structuredClone(configExemplo) as Record<string, any>;
    cfg.blocks = [{ type: "profile" }, { type: "text", body: "Oi", origem }];
    return cfg;
  }

  test("aceita mostrar e esconder com origens curtas, em minúsculas", () => {
    const cfg = ConfigSchema.parse(comBloco({ mostrar: ["Stories", "reels"], esconder: [] }));
    expect(cfg.blocks[1]).toMatchObject({ origem: { mostrar: ["stories", "reels"], esconder: [] } });
  });

  test("recusa origem inválida, \"direto\" e a mesma origem nas duas listas", () => {
    for (const origem of [{ mostrar: ["com espaço"] }, { esconder: ["direto"] }, { mostrar: ["bio"], esconder: ["bio"] }]) {
      const r = ConfigSchema.safeParse(comBloco(origem));
      expect(r.success, JSON.stringify(origem)).toBe(false);
      expect(JSON.stringify(r.error?.issues)).toMatch(/bloco text: origem/);
    }
  });
});

describe("CSS por origem", () => {
  test("sem regra de origem, nenhum CSS", () => {
    expect(cssDeOrigem([{ type: "profile" }, { type: "text" }])).toBe("");
  });

  test("mostrar: escondido por padrão e visível só nas origens da lista; esconder: some só nelas", () => {
    const css = cssDeOrigem([
      { type: "profile" },
      { type: "cta", origem: { mostrar: ["stories", "reels"] } },
      { type: "cards", origem: { esconder: ["bio"] } },
    ]);
    expect(css).toContain('[data-bloco-origem="1"]{display:none}');
    expect(css).toContain('html[data-origem="stories"] [data-bloco-origem="1"]{display:contents}');
    expect(css).toContain('html[data-origem="reels"] [data-bloco-origem="1"]{display:contents}');
    expect(css).toContain('html[data-origem="bio"] [data-bloco-origem="2"]{display:none}');
    expect(css).not.toContain('[data-bloco-origem="0"]');
  });
});

describe("script da origem", () => {
  test("é JavaScript válido, com e sem contagem de visitas", () => {
    for (const contarVisita of [true, false]) {
      const js = scriptDaOrigem({ contarVisita });
      expect(() => new Function(js)).not.toThrow();
      expect(js.includes("/api/visita")).toBe(contarVisita);
    }
  });
});

describe("origem pelo site de onde a pessoa veio", () => {
  test("rede conhecida vira origem; o próprio site, site desconhecido e lixo não", () => {
    const aqui = "bio.exemplo.com";
    expect(origemDoReferrer("https://l.instagram.com/?u=x", aqui)).toBe("instagram");
    expect(origemDoReferrer("https://www.instagram.com/", aqui)).toBe("instagram");
    expect(origemDoReferrer("https://m.facebook.com/", aqui)).toBe("facebook");
    expect(origemDoReferrer("https://t.co/abc", aqui)).toBe("x");
    expect(origemDoReferrer("https://www.youtube.com/", aqui)).toBe("youtube");
    expect(origemDoReferrer("https://www.google.com.br/", aqui)).toBe("google");
    expect(origemDoReferrer("https://www.linkedin.com/", aqui)).toBe("linkedin");
    expect(origemDoReferrer("https://notinstagram.com/", aqui)).toBeNull();
    expect(origemDoReferrer("https://bio.exemplo.com/agenda", aqui)).toBeNull();
    expect(origemDoReferrer("https://blog.qualquer.com/", aqui)).toBeNull();
    expect(origemDoReferrer("", aqui)).toBeNull();
    expect(origemDoReferrer("lixo", aqui)).toBeNull();
  });

  /** Roda o script do <head> num navegador de mentira e devolve a origem marcada e a guardada. */
  function rodar(busca: string, referrer: string, guardada: string | null = null) {
    const sessao = new Map<string, string>(guardada ? [["linkbio-origem", guardada]] : []);
    const attrs: Record<string, string> = {};
    const ouvintes: Record<string, (e: unknown) => void> = {};
    const env = {
      location: { search: busca, hostname: "bio.exemplo.com", pathname: "/", href: `https://bio.exemplo.com/${busca}` },
      document: {
        referrer,
        documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) },
        addEventListener: (tipo: string, f: (e: unknown) => void) => (ouvintes[tipo] = f),
      },
      window: { sessionStorage: { getItem: (k: string) => sessao.get(k) ?? null, setItem: (k: string, v: string) => sessao.set(k, v) } },
      navigator: {},
    };
    new Function("location", "document", "window", "navigator", scriptDaOrigem({ contarVisita: false }))(
      env.location, env.document, env.window, env.navigator,
    );
    /** Toque num link: devolve o href depois do script (a origem vai junto no atalho /r/). */
    function tocar(href: string): string {
      const a = { href, closest: (sel: string) => (sel.includes("/r/") && href.startsWith("/r/") ? a : null) };
      ouvintes.click?.({ target: { closest: (sel: string) => a.closest(sel) } });
      return a.href;
    }
    return { marcada: attrs["data-origem"] ?? null, guardada: sessao.get("linkbio-origem") ?? null, tocar };
  }

  test("sem ?src=, o script usa o referrer; ?src= e a origem já guardada vencem", () => {
    const so = (r: ReturnType<typeof rodar>) => ({ marcada: r.marcada, guardada: r.guardada });
    expect(so(rodar("", "https://l.instagram.com/"))).toEqual({ marcada: "instagram", guardada: "instagram" });
    expect(so(rodar("?src=bio", "https://l.instagram.com/"))).toEqual({ marcada: "bio", guardada: "bio" });
    expect(so(rodar("", "https://l.instagram.com/", "stories"))).toEqual({ marcada: "stories", guardada: "stories" });
    expect(so(rodar("", "https://blog.qualquer.com/"))).toEqual({ marcada: null, guardada: null });
    expect(so(rodar("", ""))).toEqual({ marcada: null, guardada: null });
  });

  test("o toque no atalho /r/ leva a origem que não está na URL, sem mexer em quem já tem", () => {
    expect(rodar("", "https://l.instagram.com/").tocar("/r/cta.falar?wa=1")).toBe("/r/cta.falar?wa=1&src=instagram");
    expect(rodar("", "", "stories").tocar("/r/link.curso")).toBe("/r/link.curso?src=stories");
    expect(rodar("", "https://l.instagram.com/").tocar("/r/link.curso?src=bio")).toBe("/r/link.curso?src=bio");
    expect(rodar("", "https://l.instagram.com/").tocar("https://fora.com/x")).toBe("https://fora.com/x");
    expect(rodar("", "").tocar("/r/link.curso")).toBe("/r/link.curso");
  });
});

describe("banco sem a migration 0010", () => {
  test("reconhece a recusa do PostgREST por coluna de origem que não existe, e só ela", () => {
    expect(semColunaDeOrigem(new Error(`Supabase 400 em leads: {"code":"PGRST204","message":"Could not find the 'origem' column of 'leads' in the schema cache"}`))).toBe(true);
    expect(semColunaDeOrigem(new Error(`Supabase 400 em leads: {"code":"PGRST204","message":"Could not find the 'nome' column"}`))).toBe(false);
    expect(semColunaDeOrigem(new Error("Supabase 500 em leads: caiu"))).toBe(false);
    expect(semColunaDeOrigem("texto")).toBe(false);
  });
});

describe("origem no envio do lead e da agenda", () => {
  test("guarda a origem válida e só as chaves de campanha conhecidas, cortadas em 200", () => {
    const r = lerOrigemDoEnvio({
      origem: "Stories",
      utm: JSON.stringify({ utm_source: "ig", utm_campaign: "x".repeat(300), fbclid: "abc", outra: "fora" }),
    });
    expect(r.origem).toBe("stories");
    expect(r.utm).toEqual({ utm_source: "ig", utm_campaign: "x".repeat(200), fbclid: "abc" });
  });

  test("sem nada, origem do Referer; lixo vira null", () => {
    expect(lerOrigemDoEnvio({}, "https://bio.exemplo.com/?src=reels")).toEqual({ origem: "reels", utm: null });
    expect(lerOrigemDoEnvio({ origem: "<script>", utm: "{quebrado" })).toEqual({ origem: null, utm: null });
    expect(lerOrigemDoEnvio({ utm: { utm_source: 5 } })).toEqual({ origem: null, utm: null });
  });
});
