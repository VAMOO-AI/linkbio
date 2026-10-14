import type { ChaveDe } from "../config/opcoes";
import { PRESETS, type Paleta, type Preset } from "../config/presets";
import { FONTE_LEGADA, PRESET_LEGADO, type Theme } from "../config/schema";

export type FonteResolvida = { display: ChaveDe<"font">; body: ChaveDe<"font"> };

export type TemaResolvido = {
  preset: ChaveDe<"preset">;
  mode: ChaveDe<"mode">;
  paletas: { claro?: Paleta; escuro?: Paleta };
  accent: { claro: string; escuro: string };
  font: FonteResolvida;
  titulo?: ChaveDe<"titulo">;
  rotulos: ChaveDe<"rotulos">;
  fundoImagem?: string;
  /** 2ª cor da marca (botões vazados), por modo; sem theme.accent2, ausente. */
  accent2?: { claro: string; escuro: string };
  background: ChaveDe<"background">;
  buttons: ChaveDe<"buttons">;
  corners: ChaveDe<"corners">;
  /** theme.radius da v0.1.0, se presente. */
  radiusLegado?: number;
  blocos: Preset["blocos"];
};

function presetDe(id: Theme["preset"]): ChaveDe<"preset"> {
  return id in PRESET_LEGADO ? PRESET_LEGADO[id as keyof typeof PRESET_LEGADO] : (id as ChaveDe<"preset">);
}

type ModoTema = "auto" | "claro" | "escuro";
type PaletaTema = Partial<Record<"claro" | "escuro", unknown>>;

/** O modelo aceita este modo? "auto" precisa das duas versões; claro e escuro, da sua. */
export function modoAceito(preset: Theme["preset"], mode: ModoTema): boolean {
  const { claro, escuro } = PRESETS[presetDe(preset)].paletas;
  return mode === "auto" ? Boolean(claro && escuro) : Boolean(mode === "claro" ? claro : escuro);
}

/**
 * O que do tema não vale para o modelo escolhido (troca de modelo deixa sobras): o modo que ele não
 * tem e a paleta de uma versão que ele não tem. Nada disso quebra a bio: o motor ignora e o check avisa.
 */
export function semEfeitoNoTema(t: { preset: Theme["preset"]; mode?: ModoTema; palette?: PaletaTema }): { modo?: ModoTema; paletas: ("claro" | "escuro")[] } {
  const { claro, escuro } = PRESETS[presetDe(t.preset)].paletas;
  const paletas = (["claro", "escuro"] as const).filter((m) => t.palette?.[m] && !(m === "claro" ? claro : escuro));
  return { modo: t.mode && !modoAceito(t.preset, t.mode) ? t.mode : undefined, paletas };
}

/** Tema sem as sobras de semEfeitoNoTema (o painel aplica ao trocar de modelo). Função pura. */
export function limparTemaParaModelo<T extends { preset: Theme["preset"]; mode?: ModoTema; palette?: PaletaTema }>(t: T): T {
  const sobras = semEfeitoNoTema(t);
  if (!sobras.modo && sobras.paletas.length === 0) return t;
  const limpo: T = { ...t };
  if (sobras.modo) delete limpo.mode;
  if (t.palette) {
    const palette = { ...t.palette };
    for (const m of sobras.paletas) delete palette[m];
    if (Object.keys(palette).length) limpo.palette = palette;
    else delete limpo.palette;
  }
  return limpo;
}

/** Fontes feitas para título: escolhidas sozinhas, o texto corrido fica na Jakarta. */
const SO_TITULO = new Set<string>(["serif", "bricolage", "playfair", "fraunces", "syne", "mono"]);

function fonteDe(f: NonNullable<Theme["font"]> | Preset["font"]): FonteResolvida {
  if (typeof f === "object") return f;
  const chave = f in FONTE_LEGADA ? FONTE_LEGADA[f as keyof typeof FONTE_LEGADA] : (f as ChaveDe<"font">);
  // Fontes de título (config/opcoes.ts, "nos títulos"): o texto corrido fica na Jakarta.
  const body = SO_TITULO.has(chave) ? "jakarta" : chave;
  return { display: chave, body };
}

/**
 * Tema da config -> tema completo. Precedência: modelo < theme.* da config.
 * Função pura, sem zod: roda no servidor (layout, OG) e nos testes.
 */
export function resolverTema(t: Theme): TemaResolvido {
  const id = presetDe(t.preset);
  const p = PRESETS[id];
  const paleta = (m: "claro" | "escuro") =>
    p.paletas[m] ? { ...p.paletas[m], ...t.palette?.[m] } : undefined;
  const accentBase = p.accent.claro ?? p.accent.escuro!;
  return {
    preset: id,
    // Modo que o modelo não tem (sobra de troca de modelo) não quebra: vale o do modelo.
    mode: t.mode && modoAceito(t.preset, t.mode) ? t.mode : p.mode,
    paletas: { claro: paleta("claro"), escuro: paleta("escuro") },
    accent: {
      claro: t.accent ?? p.accent.claro ?? accentBase,
      escuro: t.accent ?? p.accent.escuro ?? accentBase,
    },
    titulo: t.titulo,
    rotulos: t.rotulos ?? "padrao",
    fundoImagem: t.fundoImagem,
    accent2: t.accent2 ? { claro: t.accent2, escuro: t.accent2 } : undefined,
    font: fonteDe(t.font ?? p.font),
    background: t.background ?? p.background,
    buttons: t.buttons ?? p.buttons,
    corners: t.corners ?? p.corners,
    radiusLegado: t.radius,
    blocos: p.blocos,
  };
}

/** Modo que a página fixa no <html data-theme>, ou null quando segue o aparelho. */
export function modoFixo(tema: TemaResolvido): "light" | "dark" | null {
  const { claro, escuro } = tema.paletas;
  if (tema.mode === "claro" || (claro && !escuro)) return "light";
  if (tema.mode === "escuro" || (escuro && !claro)) return "dark";
  return null;
}

/** Escolha de claro/escuro do painel da prévia; "" deixa o tema da config decidir. */
export type TemaForcado = "" | "claro" | "escuro";

/** Modo do <html data-theme> com o olho do painel por cima: o forçado manda, senão vale o tema. */
export function modoExibido(tema: TemaResolvido, forcado: TemaForcado = ""): "light" | "dark" | null {
  if (forcado === "claro") return "light";
  if (forcado === "escuro") return "dark";
  return modoFixo(tema);
}

/** Variante do bloco: campo do bloco > default do modelo. */
export function varianteDoPerfil(
  bloco: { header?: ChaveDe<"header">; socials?: ChaveDe<"socials"> },
  tema: TemaResolvido,
) {
  return {
    header: bloco.header ?? tema.blocos.profile.header,
    socials: bloco.socials ?? tema.blocos.profile.socials,
  };
}
