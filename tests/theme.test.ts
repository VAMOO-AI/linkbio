import { describe, expect, test } from "vitest";
import { problemasDeContraste, themeParaCss } from "../lib/theme";
import { modoExibido, resolverTema } from "../lib/resolver";
import { ThemeSchema, type Theme } from "../config/schema";

/**
 * lib/theme.ts. Contrato: tema resolvido -> CSS custom properties com especificidade zero,
 * em até 4 blocos: :where(:root), @media dark, :where([data-theme="light"]), :where([data-theme="dark"]).
 * O componente nunca lê o tema direto, só as variáveis.
 */
const tema = (t: Partial<Theme> = {}) => resolverTema(ThemeSchema.parse({ preset: "neutro", accent: "#007dff", ...t }));

const bloco = (css: string, seletor: RegExp) => css.match(seletor)?.[1] ?? "";
const token = (trecho: string, nome: string) => trecho.match(new RegExp(`${nome}: (#[0-9a-f]{6});`))?.[1];

describe("theme.ts", () => {
  test("emite :where(:root) com as custom properties do tema", () => {
    const css = themeParaCss(tema());
    expect(css).toMatch(/:where\(:root\)\s*\{[^}]*--/s);
    expect(css).toContain("--accent: #007dff;");
  });

  test("modelo com claro e escuro em mode auto emite o bloco dark via prefers-color-scheme", () => {
    expect(themeParaCss(tema())).toMatch(/@media\s*\(prefers-color-scheme:\s*dark\)/);
  });

  test("emite blocos [data-theme] light e dark quando o modelo tem as duas paletas", () => {
    const css = themeParaCss(tema());
    expect(css).toMatch(/:where\(\[data-theme="light"\]\)/);
    expect(css).toMatch(/:where\(\[data-theme="dark"\]\)/);
  });

  test("modelo só escuro não emite media query nem bloco light", () => {
    const css = themeParaCss(tema({ preset: "noite", accent: undefined }));
    expect(css).not.toMatch(/prefers-color-scheme/);
    expect(css).not.toMatch(/data-theme="light"/);
    expect(css).toContain("--bg: #05070a;");
  });

  test("mode forçado sem media query", () => {
    expect(themeParaCss(tema({ mode: "claro" }))).not.toMatch(/prefers-color-scheme/);
  });

  test("radius legado sobrescreve o raio dos cantos", () => {
    expect(themeParaCss(tema({ radius: 12 }))).toMatch(/--radius:\s*12px/);
    expect(themeParaCss(tema({ corners: "redondo" }))).toMatch(/--radius:\s*22px/);
  });

  test("accent gera rgb e hover derivados", () => {
    const css = themeParaCss(tema());
    expect(css).toContain("--accent-rgb: 0, 125, 255;");
    expect(css).toMatch(/--accent-hover:\s*#[0-9a-f]{6}/);
  });

  // Branco sobre #007dff dá 3,9:1 (reprova AA); #111 dá 4,8:1.
  test.each([
    ["#007dff", "#111"],
    ["#4da3ff", "#111"],
    ["#ffd400", "#111"],
    ["#0b3d91", "#fff"],
    ["#c2185b", "#fff"],
  ])("--on-accent sobre %s é %s (maior contraste)", (accent, esperado) => {
    expect(themeParaCss(tema({ accent }))).toContain(`--on-accent: ${esperado};`);
  });

  // Accent como texto precisa de 4,5:1 contra bg e surface da paleta de cada modo.
  const amostra = ["#007dff", "#4da3ff", "#ffd400", "#0b3d91", "#c2185b", "#2d6a4f", "#b4532a", "#ff4d00", "#ff5ca8", "#7c3aed", "#0f172a"];
  test.each(amostra)("--accent-texto de %s passa AA no claro e no escuro do modelo neutro", (accent) => {
    const t = tema({ accent });
    const css = themeParaCss(t);
    const claro = token(bloco(css, /:where\(\[data-theme="light"\]\) \{([^}]*)\}/), "--accent-texto")!;
    const escuro = token(bloco(css, /:where\(\[data-theme="dark"\]\) \{([^}]*)\}/), "--accent-texto")!;
    for (const fundo of [t.paletas.claro!.bg, t.paletas.claro!.surface]) expect(contraste(claro, fundo)).toBeGreaterThanOrEqual(4.5);
    for (const fundo of [t.paletas.escuro!.bg, t.paletas.escuro!.surface]) expect(contraste(escuro, fundo)).toBeGreaterThanOrEqual(4.5);
  });

  test.each(amostra)("--accent-fill de %s aguenta texto branco (4,5:1)", (accent) => {
    const fill = token(themeParaCss(tema({ accent })), "--accent-fill")!;
    expect(contraste(fill, "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });
});

function contraste(a: string, b: string): number {
  const lum = (hex: string) => {
    const c = (i: number) => {
      const v = parseInt(hex.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * c(1) + 0.7152 * c(3) + 0.0722 * c(5);
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

describe("contraste de theme.palette (dívida da Fase V)", () => {
  test("modelos prontos sem sobrescrita passam", () => {
    for (const preset of ["neutro", "noite", "editorial", "vitrine", "brutal", "vibrante"] as const) {
      expect(problemasDeContraste(tema({ preset }))).toEqual([]);
    }
  });

  test("cor sobrescrita ilegível é apontada com o par, a razão e o mínimo", () => {
    const p = problemasDeContraste(tema({ palette: { claro: { dim: "#cccccc" } } }));
    expect(p.join("\n")).toMatch(/paleta claro: texto de apoio sobre o fundo \(dim #cccccc sobre bg #[0-9a-f]{6}\) tem contraste 1,\d\d:1; o mínimo é 4,5:1/);
  });

  test("faint usa o mínimo decorativo de 3:1", () => {
    const p = problemasDeContraste(tema({ palette: { claro: { faint: "#eeeeee" } } }));
    expect(p.join("\n")).toMatch(/linhas e setas.*o mínimo é 3:1/);
  });
});

test("modoExibido deixa o olho do painel vencer o tema, e volta ao tema no auto", () => {
  // neutro tem claro e escuro e mode auto: sozinho, o <html> não fixa nada e segue o aparelho.
  const neutro = tema();
  expect(modoExibido(neutro)).toBeNull();
  expect(modoExibido(neutro, "claro")).toBe("light");
  expect(modoExibido(neutro, "escuro")).toBe("dark");
  expect(modoExibido(neutro, "")).toBeNull();
  // forçar claro num modelo escuro inverte o que o tema pedia.
  expect(modoExibido(tema({ mode: "escuro" }), "claro")).toBe("light");
});

test("serifada e bricolage mudam só os títulos; o texto corrido fica na Jakarta", () => {
  expect(tema({ font: "serif" }).font).toEqual({ display: "serif", body: "jakarta" });
  expect(tema({ font: "bricolage" }).font).toEqual({ display: "bricolage", body: "jakarta" });
  expect(tema({ font: "Instrument Serif" }).font).toEqual({ display: "serif", body: "jakarta" });
  expect(tema({ font: "grotesk" }).font).toEqual({ display: "grotesk", body: "grotesk" });
});


describe("modo que o modelo não tem", () => {
  test("é ignorado e vale o modo do modelo (sem quebrar)", async () => {
    expect(modoExibido).toBeTypeOf("function");
    const { semEfeitoNoTema } = await import("../lib/resolver");
    const t = resolverTema({ preset: "editorial", mode: "escuro", palette: { escuro: { bg: "#000000" } } } as never);
    expect(t.mode).not.toBe("escuro");
    expect(t.paletas.escuro).toBeUndefined();
    expect(semEfeitoNoTema({ preset: "editorial", mode: "escuro", palette: { escuro: {} } })).toEqual({ modo: "escuro", paletas: ["escuro"] });
    expect(semEfeitoNoTema({ preset: "neutro", mode: "auto", palette: { claro: {}, escuro: {} } })).toEqual({ modo: undefined, paletas: [] });
  });
});

describe("assinaturas de marca (v0.5.1)", () => {
  const css = (t: Record<string, unknown>) => themeParaCss(resolverTema({ preset: "noite", ...t } as never));

  test("peso dos títulos: fino, normal e forte por cima do peso da fonte", () => {
    expect(css({ font: "grotesk" })).toContain("--display-weight: 700;");
    expect(css({ font: "grotesk", titulo: "fino" })).toContain("--display-weight: 300;");
    expect(css({ titulo: "forte" })).toContain("--display-weight: 800;");
  });

  test("botão em degradê só com ctaBg2; sem ela, a 2ª cor é a mesma", () => {
    expect(css({})).toMatch(/--cta-bg-2: (#[0-9a-f]{6});[\s\S]*/i);
    const sem = css({ palette: { escuro: { ctaBg: "#f59e0b" } } });
    expect(sem).toContain("--cta-bg-2: #f59e0b;");
    const com = css({ palette: { escuro: { ctaBg: "#f59e0b", ctaBg2: "#d97706", ctaText: "#0b1120" } } });
    expect(com).toContain("--cta-bg-2: #d97706;");
  });

  test("2ª cor da marca vai para os botões vazados; sem ela, a cor do texto", () => {
    expect(css({ accent2: "#3b82f6" })).toMatch(/--botao-vazado: #[0-9a-f]{6};/i);
    expect(css({ accent2: "#3b82f6" })).not.toMatch(/--botao-vazado: #f1f5f9/i);
    const semCor = resolverTema({ preset: "noite" } as never);
    expect(css({})).toContain(`--botao-vazado: ${semCor.paletas.escuro!.text};`);
  });

  test("imagem de fundo vira variável só quando existe", () => {
    expect(css({ fundoImagem: "/fundo.jpg" })).toContain('--fundo-imagem: url("/fundo.jpg");');
    expect(css({})).not.toContain("--fundo-imagem");
  });

  test("contraste confere também a 2ª cor do degradê", () => {
    const p = problemasDeContraste(resolverTema({ preset: "noite", palette: { escuro: { ctaBg: "#f59e0b", ctaBg2: "#111111", ctaText: "#0b1120" } } } as never));
    expect(p.join(" ")).toMatch(/2ª cor do degradê/);
  });
});
