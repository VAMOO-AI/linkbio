/**
 * Onboarding: leitura do site da própria pessoa (HTML + CSS), sem navegador.
 * Tira cores, fontes, logo, títulos e textos para a bio sair com a cara e as palavras do site.
 * Site que só monta o conteúdo no navegador (React, Vite...) devolve pouco texto: aí
 * `precisaNavegador` vem true e o script tenta a leitura renderizada.
 */

export type Contagem = { valor: string; vezes: number };

export type LeituraCss = {
  /** Cores em hex (#rrggbb), da mais usada para a menos usada. */
  cores: Contagem[];
  /** Variáveis de cor com nome (ex.: --primary), já em hex. Sem as internas do Tailwind. */
  variaveis: Record<string, string>;
  fontes: Contagem[];
};

export type LeituraHtml = {
  titulo: string;
  descricao: string;
  ogTitulo: string;
  ogDescricao: string;
  ogImagem: string | null;
  corTema: string | null;
  icones: string[];
  logos: string[];
  titulos: string[];
  textos: string[];
  links: { texto: string; url: string }[];
  folhas: string[];
  estilosInternos: string;
  fontesGoogle: string[];
  precisaNavegador: boolean;
};

// ---------- cores ----------

const dois = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");
const hex = (r: number, g: number, b: number) => `#${dois(r)}${dois(g)}${dois(b)}`;

function hslParaRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

function oklchParaRgb(L: number, C: number, H: number): [number, number, number] {
  const hr = (H * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const gama = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.max(x, 0) ** (1 / 2.4) - 0.055);
  return [gama(lin[0]!) * 255, gama(lin[1]!) * 255, gama(lin[2]!) * 255];
}

const num = (t: string, escala = 1) => (t.endsWith("%") ? (parseFloat(t) / 100) * escala : parseFloat(t));

/** Converte uma cor CSS (hex, rgb, hsl, oklch) para #rrggbb. Transparente ou desconhecida: null. */
export function corParaHex(bruta: string): string | null {
  const c = bruta.trim().toLowerCase();
  let m = c.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let h = m[1]!;
    if (h.length === 3 || h.length === 4) {
      if (h.length === 4 && h[3] === "0") return null;
      h = h.slice(0, 3).split("").map((x) => x + x).join("");
    } else if (h.length === 8) {
      if (h.slice(6) === "00") return null;
      h = h.slice(0, 6);
    } else if (h.length !== 6) return null;
    return `#${h}`;
  }
  m = c.match(/^(rgba?|hsla?|oklch)\(([^)]*)\)$/);
  if (!m) return null;
  const partes = m[2]!.replace(/,/g, " ").replace("/", " / ").split(/\s+/).filter(Boolean);
  const barra = partes.indexOf("/");
  const alfa = barra >= 0 ? partes[barra + 1] : partes.length === 4 ? partes[3] : undefined;
  if (alfa !== undefined && num(alfa, 1) === 0) return null;
  const [p0, p1, p2] = partes;
  if (!p0 || !p1 || !p2) return null;
  // "none" e afins não viram número: sem cor, em vez de "#NaN...".
  if ([p0, p1, p2].some((p) => !Number.isFinite(parseFloat(p)))) return null;
  if (m[1]!.startsWith("rgb")) return hex(num(p0, 255), num(p1, 255), num(p2, 255));
  if (m[1]!.startsWith("hsl")) return hex(...hslParaRgb(parseFloat(p0), num(p1, 1) / (p1.endsWith("%") ? 1 : 100), num(p2, 1) / (p2.endsWith("%") ? 1 : 100)));
  return hex(...oklchParaRgb(num(p0, 1), num(p1, 0.4), parseFloat(p2) || 0));
}

/** Tripla HSL solta, sem hsl(): o padrão do shadcn/ui em variáveis ("222 47% 11%"). */
const HSL_SOLTO = /^(-?[\d.]+)(deg)?\s+([\d.]+%)\s+([\d.]+%)$/;

function corDeVariavel(valor: string): string | null {
  const v = valor.trim();
  const solto = v.match(HSL_SOLTO);
  return solto ? corParaHex(`hsl(${solto[1]} ${solto[3]} ${solto[4]})`) : corParaHex(v);
}

/**
 * Paletas padrão que vêm em todo site de uma ferramenta e não dizem nada da marca: a do Tailwind
 * (--color-blue-500...), as internas dele (--tw-*) e a do editor do WordPress (--wp--preset--*).
 */
const PALETA_PADRAO = /^(--tw-|--wp--preset--|--color-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone|black|white)(-\d+)?$)/;

const PAD_COR = /#[0-9a-fA-F]{3,8}\b|(?:rgba?|hsla?|oklch)\([^)]*\)/g;

// ---------- fontes ----------

const GENERICAS = new Set([
  "serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-sans-serif", "ui-serif",
  "ui-monospace", "ui-rounded", "-apple-system", "blinkmacsystemfont", "segoe ui",
  "noto sans", "sans", "inherit", "initial", "unset", "emoji", "math",
  "apple color emoji", "segoe ui emoji", "segoe ui symbol", "noto color emoji", "menlo", "monaco",
  "consolas", "liberation mono", "courier new", "sfmono-regular",
]);

function primeiraFonte(declaracao: string): string | null {
  for (const parte of declaracao.split(",")) {
    let nome = parte.trim().replace(/^["']|["']$/g, "").replace(/\s+variable$/i, "").trim();
    if (!nome || nome.startsWith("var(")) continue;
    // next/font: "__Inter_d65c78" é a Inter; "__Inter_Fallback_d65c78" é a reserva, não conta.
    const next = nome.match(/^__(.+?)_[0-9a-f]{6}$/i);
    if (next) {
      if (/_Fallback$/i.test(next[1]!)) continue;
      nome = next[1]!.replace(/_/g, " ");
    }
    if (GENERICAS.has(nome.toLowerCase())) return null;
    return nome;
  }
  return null;
}

function contar(lista: string[]): Contagem[] {
  const mapa = new Map<string, number>();
  for (const v of lista) mapa.set(v, (mapa.get(v) ?? 0) + 1);
  return [...mapa].map(([valor, vezes]) => ({ valor, vezes })).sort((a, b) => b.vezes - a.vezes);
}

export function lerCss(css: string): LeituraCss {
  const cores: string[] = [];
  const variaveis: Record<string, string> = {};
  const brutas: Record<string, string> = {};
  // Só declarações (propriedade: valor), para não contar seletor de id (#face) como cor.
  const declaracoes = [...css.matchAll(/([\w-]+)\s*:\s*([^;{}]+)/g)].map((m) => ({ prop: m[1]!, valor: m[2]!.trim() }));
  for (const { prop, valor } of declaracoes) {
    if (!prop.startsWith("--") || PALETA_PADRAO.test(prop)) continue;
    brutas[prop] = valor;
    const v = corDeVariavel(valor);
    if (v) variaveis[prop] = v;
  }
  // Variável que aponta para outra (--accent: var(--brand)): resolve um nível.
  for (const [prop, valor] of Object.entries(brutas)) {
    const ref = valor.match(/^var\(\s*(--[\w-]+)\s*\)$/);
    if (!variaveis[prop] && ref && variaveis[ref[1]!]) variaveis[prop] = variaveis[ref[1]!]!;
  }
  for (const { prop, valor } of declaracoes) {
    if (PALETA_PADRAO.test(prop)) continue;
    for (const m of valor.replace(/url\([^)]*\)/g, "").matchAll(PAD_COR)) {
      const v = corParaHex(m[0]);
      if (v) cores.push(v);
    }
  }
  const fontes: string[] = [];
  for (const m of css.matchAll(/font-family\s*:\s*([^;}]+)/g)) {
    const f = primeiraFonte(m[1]!);
    if (f) fontes.push(f);
  }
  return { cores: contar(cores).slice(0, 20), variaveis, fontes: contar(fontes).slice(0, 8) };
}

// ---------- HTML ----------

function decodificar(t: string): string {
  return t
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)));
}

const semTags = (t: string) => decodificar(t.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

function atributo(tag: string, nome: string): string {
  const m = tag.match(new RegExp(`\\b${nome}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return decodificar(m?.[2] ?? m?.[3] ?? m?.[4] ?? "");
}

function absoluta(url: string, base: string): string {
  try {
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}

function meta(html: string, chave: string): string {
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    if ((atributo(tag, "property") || atributo(tag, "name")).toLowerCase() === chave) return atributo(tag, "content").trim();
  }
  return "";
}

const unicos = <T,>(lista: T[]) => [...new Set(lista)];

export function lerHtml(html: string, base: string): LeituraHtml {
  const semScripts = html.replace(/<script\b[\s\S]*?<\/script>/gi, "").replace(/<noscript\b[\s\S]*?<\/noscript>/gi, "");
  const corpo = (semScripts.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? semScripts).replace(/<style\b[\s\S]*?<\/style>/gi, "");

  const linksTag = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
  const rel = (t: string) => atributo(t, "rel").toLowerCase();
  const icones = linksTag.filter((t) => rel(t).includes("icon")).map((t) => absoluta(atributo(t, "href"), base));
  const folhas = linksTag.filter((t) => rel(t).includes("stylesheet")).map((t) => absoluta(atributo(t, "href"), base));
  const fontesGoogle = unicos(
    [...html.matchAll(/fonts\.googleapis\.com\/css2?\?([^"'\s>]+)/gi)].flatMap((m) =>
      [...decodificar(m[1]!).matchAll(/family=([^&:]+)/g)].map((f) => decodeURIComponent(f[1]!.replace(/\+/g, " "))),
    ),
  );

  const logos = unicos(
    [...corpo.matchAll(/<img\b[^>]*>/gi)]
      .map((m) => m[0])
      .filter((t) => /logo|marca|brand/i.test(`${atributo(t, "src")} ${atributo(t, "alt")} ${atributo(t, "class")}`))
      .map((t) => absoluta(atributo(t, "src"), base)),
  ).slice(0, 5);

  const titulos = unicos([...corpo.matchAll(/<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => semTags(m[2]!)).filter(Boolean)).slice(0, 15);
  const textos = unicos(
    [...corpo.matchAll(/<(p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((m) => semTags(m[2]!)).filter((t) => t.length >= 25),
  ).slice(0, 20);
  const links = unicos(
    [...corpo.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
      .map((m) => ({ texto: semTags(m[2]!), url: atributo(m[1]!, "href") }))
      .filter((l) => l.url && !l.url.startsWith("#") && !l.url.startsWith("javascript:"))
      .map((l) => JSON.stringify({ texto: l.texto, url: absoluta(l.url, base) })),
  )
    .slice(0, 40)
    .map((j) => JSON.parse(j) as { texto: string; url: string });

  const textoVisivel = semTags(corpo);
  return {
    titulo: semTags(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ""),
    descricao: meta(html, "description"),
    ogTitulo: meta(html, "og:title"),
    ogDescricao: meta(html, "og:description"),
    ogImagem: meta(html, "og:image") ? absoluta(meta(html, "og:image"), base) : null,
    corTema: corParaHex(meta(html, "theme-color")),
    icones: unicos(icones),
    logos,
    titulos,
    textos,
    links,
    folhas: unicos(folhas),
    estilosInternos: [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n"),
    fontesGoogle,
    precisaNavegador: textoVisivel.length < 200,
  };
}
