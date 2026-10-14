import type { Paleta } from "@/config/presets";
import type { FonteResolvida, TemaResolvido } from "./resolver";

type Modo = "claro" | "escuro";

const paraHex = (n: number) => Math.round(n).toString(16).padStart(2, "0");
const canais = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Converte cor hexadecimal de 6 dígitos em "r, g, b". */
function hexParaRgb(hex: string): string {
  return canais(hex).join(", ");
}

/** Mistura a cor com `alvo` na proporção `p` (0 = cor original, 1 = alvo). */
function mistura(hex: string, alvo: string, p: number): string {
  const a = canais(hex);
  const b = canais(alvo);
  return `#${a.map((v, i) => paraHex(v + (b[i]! - v) * p)).join("")}`;
}

/** Escurece a cor (fator 0–1) para o estado hover. */
function escurece(hex: string, fator = 0.82): string {
  return `#${canais(hex).map((v) => paraHex(v * fator)).join("")}`;
}

/** Luminância relativa (WCAG). */
function luminancia(hex: string): number {
  const [r = 0, g = 0, b = 0] = canais(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contraste(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Pares de cor que precisam passar AA. faint é decorativo (3:1, WCAG 1.4.11). */
const PARES: [keyof Paleta, keyof Paleta, number, string][] = [
  ["text", "bg", 4.5, "texto sobre o fundo"],
  ["text", "surface", 4.5, "texto sobre os cards"],
  ["dim", "bg", 4.5, "texto de apoio sobre o fundo"],
  ["dim", "surface", 4.5, "texto de apoio sobre os cards"],
  ["ctaText", "ctaBg", 4.5, "texto do botão principal"],
  ["ctaText", "ctaBg2", 4.5, "texto do botão principal (2ª cor do degradê)"],
  ["shellText", "shellBg", 4.5, "texto do bloco em destaque"],
  ["faint", "bg", 3, "linhas e setas sobre o fundo"],
];

/**
 * Confere o contraste das paletas do tema resolvido (modelo + theme.palette).
 * Devolve uma frase em PT-BR por par reprovado; lista vazia = tudo AA.
 */
export function problemasDeContraste(tema: Pick<TemaResolvido, "paletas">): string[] {
  const out: string[] = [];
  for (const modo of ["claro", "escuro"] as const) {
    const pal = tema.paletas[modo];
    if (!pal) continue;
    for (const [frente, fundo, minimo, oQue] of PARES) {
      if (!pal[frente] || !pal[fundo]) continue;
      const r = contraste(pal[frente]!, pal[fundo]!);
      if (r < minimo) {
        out.push(
          `paleta ${modo}: ${oQue} (${frente} ${pal[frente]} sobre ${fundo} ${pal[fundo]}) tem contraste ${r.toFixed(2).replace(".", ",")}:1; o mínimo é ${String(minimo).replace(".", ",")}:1.`,
        );
      }
    }
  }
  return out;
}

/** Texto sobre o accent: o que der maior contraste WCAG, #111 ou branco. */
function sobreAccent(hex: string): string {
  return contraste(hex, "#111111") > contraste(hex, "#ffffff") ? "#111" : "#fff";
}

/** Accent usado como texto: afasta do fundo até 4,5:1 contra o pior entre bg e surface. */
export function accentTexto(hex: string, pal: Paleta): string {
  const escuro = luminancia(pal.bg) < 0.2;
  const alvo = escuro ? "#ffffff" : "#000000";
  for (let p = 0; p <= 1; p += 0.05) {
    const cor = mistura(hex, alvo, p);
    if (contraste(cor, pal.bg) >= 4.5 && contraste(cor, pal.surface) >= 4.5) return cor;
  }
  return alvo;
}

/** Fundo cheio com texto branco (banner, seta): escurece o accent até 4,5:1 com branco. */
export function accentFill(hex: string): string {
  for (let p = 0; p <= 1; p += 0.05) {
    const cor = mistura(hex, "#000000", p);
    if (contraste(cor, "#ffffff") >= 4.5) return cor;
  }
  return "#000000";
}

const RAIO = { reto: [4, 6], medio: [14, 100], redondo: [22, 100] } as const;

/** Família e peso por chave. --lb-f-* vem de lib/fontes.ts, no <html> (mesmo elemento do :root). */
const FONTE = {
  jakarta: { familia: "var(--lb-f-jakarta)", peso: 700, tracking: "-0.02em" },
  serif: { familia: "var(--lb-f-serif)", peso: 400, tracking: "-0.01em" },
  grotesk: { familia: "var(--lb-f-grotesk)", peso: 700, tracking: "-0.03em" },
  bricolage: { familia: "var(--lb-f-bricolage)", peso: 800, tracking: "-0.03em" },
  inter: { familia: "var(--lb-f-inter)", peso: 700, tracking: "-0.02em" },
  manrope: { familia: "var(--lb-f-manrope)", peso: 800, tracking: "-0.02em" },
  montserrat: { familia: "var(--lb-f-montserrat)", peso: 700, tracking: "-0.02em" },
  poppins: { familia: "var(--lb-f-poppins)", peso: 700, tracking: "-0.02em" },
  dmsans: { familia: "var(--lb-f-dmsans)", peso: 700, tracking: "-0.02em" },
  outfit: { familia: "var(--lb-f-outfit)", peso: 700, tracking: "-0.02em" },
  sora: { familia: "var(--lb-f-sora)", peso: 700, tracking: "-0.02em" },
  albert: { familia: "var(--lb-f-albert)", peso: 700, tracking: "-0.02em" },
  archivo: { familia: "var(--lb-f-archivo)", peso: 800, tracking: "-0.02em" },
  lora: { familia: "var(--lb-f-lora)", peso: 700, tracking: "-0.01em" },
  playfair: { familia: "var(--lb-f-playfair)", peso: 700, tracking: "-0.01em" },
  fraunces: { familia: "var(--lb-f-fraunces)", peso: 700, tracking: "-0.02em" },
  syne: { familia: "var(--lb-f-syne)", peso: 800, tracking: "-0.03em" },
  mono: { familia: "var(--lb-f-mono)", peso: 700, tracking: "-0.03em" },
} as const;

/** theme.titulo: peso dos títulos por cima do peso da fonte. */
const PESO_TITULO = { fino: 300, normal: 500, forte: 800 } as const;

function tokensFonte(f: FonteResolvida, titulo?: keyof typeof PESO_TITULO): string[] {
  const d = FONTE[f.display];
  return [
    `--font: ${FONTE[f.body].familia}, system-ui, sans-serif;`,
    `--font-display: ${d.familia}, system-ui, sans-serif;`,
    `--display-weight: ${titulo ? PESO_TITULO[titulo] : d.peso};`,
    `--display-tracking: ${d.tracking};`,
  ];
}

function tokens(tema: TemaResolvido, modo: Modo): string {
  const pal = tema.paletas[modo]!;
  const accent = tema.accent[modo];
  const [raio, raioBtn] = RAIO[tema.corners];
  const radius = tema.radiusLegado ?? raio;
  const radiusBtn = tema.buttons === "brutal" || tema.buttons === "suave" ? Math.min(radius, 14) : raioBtn;
  return [
    `--bg: ${pal.bg};`,
    `--surface: ${pal.surface};`,
    `--surface-2: ${pal.surface2};`,
    `--text: ${pal.text};`,
    `--dim: ${pal.dim};`,
    `--faint: ${pal.faint};`,
    `--line: ${pal.line};`,
    `--cta-bg: ${pal.ctaBg};`,
    `--cta-bg-2: ${pal.ctaBg2 ?? pal.ctaBg};`,
    `--cta-text: ${pal.ctaText};`,
    `--shell-bg: ${pal.shellBg};`,
    `--shell-text: ${pal.shellText};`,
    `--accent: ${accent};`,
    `--accent-rgb: ${hexParaRgb(accent)};`,
    `--accent-hover: ${escurece(accent)};`,
    `--accent-soft: rgba(${hexParaRgb(accent)}, 0.08);`,
    `--accent-texto: ${accentTexto(accent, pal)};`,
    `--accent-fill: ${accentFill(accent)};`,
    `--on-accent: ${sobreAccent(accent)};`,
    // Botões vazados: a 2ª cor da marca (ajustada para ler sobre o fundo) ou a cor do texto.
    // Imagem de fundo (theme.fundoImagem) sob véu de 84 a 94% da cor do fundo: o texto segue legível.
    ...(tema.fundoImagem ? [`--fundo-imagem: url("${tema.fundoImagem.replace(/["\\\n]/g, "")}");`] : []),
    `--botao-vazado: ${tema.accent2 ? accentTexto(tema.accent2[modo], pal) : pal.text};`,
    ...tokensFonte(tema.font, tema.titulo),
    `--radius: ${radius}px;`,
    `--radius-btn: ${radiusBtn}px;`,
    `color-scheme: ${modo === "claro" ? "light" : "dark"};`,
  ].join("\n  ");
}

/**
 * Tema resolvido -> CSS custom properties com especificidade zero (:where),
 * para que qualquer CSS da instância (ex.: um design system) sempre vença.
 * 1. :where(:root) com a paleta padrão
 * 2. @media (prefers-color-scheme: dark), só com mode "auto" e as duas paletas
 * 3. :where([data-theme="light"]) e 4. :where([data-theme="dark"]), se a paleta existir
 */
export function themeParaCss(tema: TemaResolvido): string {
  const { claro, escuro } = tema.paletas;
  const padrao: Modo = tema.mode === "escuro" || !claro ? "escuro" : "claro";
  const blocos = [`:where(:root) {\n  ${tokens(tema, padrao)}\n}`];
  if (tema.mode === "auto" && claro && escuro) {
    blocos.push(`@media (prefers-color-scheme: dark) {\n  :where(:root) {\n    ${tokens(tema, "escuro")}\n  }\n}`);
  }
  if (claro) blocos.push(`:where([data-theme="light"]) {\n  ${tokens(tema, "claro")}\n}`);
  if (escuro) blocos.push(`:where([data-theme="dark"]) {\n  ${tokens(tema, "escuro")}\n}`);
  return blocos.join("\n");
}
