import type { ChaveDe } from "../opcoes";

/** Paleta de um modo (claro ou escuro). Só hex de 6 dígitos: o contraste é calculável. */
export type Paleta = {
  bg: string;
  surface: string;
  surface2: string;
  text: string;
  /** Texto secundário legível: >= 4,5:1 sobre bg e surface. */
  dim: string;
  /** Só decorativo (linhas, setas): >= 3:1 sobre bg. */
  faint: string;
  line: string;
  ctaBg: string;
  /** Opcional: 2ª cor do botão principal, em degradê com ctaBg. */
  ctaBg2?: string;
  ctaText: string;
  shellBg: string;
  shellText: string;
};

export type FonteKey = ChaveDe<"font">;
export type Fonte = FonteKey | { display: FonteKey; body: FonteKey };

/** Um modelo pronto: só visual. Conteúdo (blocos, textos) continua sendo da config. */
export type Preset = {
  mode: ChaveDe<"mode">;
  paletas: { claro?: Paleta; escuro?: Paleta };
  accent: { claro?: string; escuro?: string };
  font: Fonte;
  background: ChaveDe<"background">;
  buttons: ChaveDe<"buttons">;
  corners: ChaveDe<"corners">;
  blocos: {
    profile: { header: ChaveDe<"header">; socials: ChaveDe<"socials"> };
    cards: { layout: ChaveDe<"cardsLayout"> };
    links: { layout: ChaveDe<"linksLayout"> };
    concierge: { variant: ChaveDe<"concierge"> };
    products: { layout: ChaveDe<"productsLayout"> };
  };
};
