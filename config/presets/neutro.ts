import type { Preset } from "./tipos";

/** Claro e escuro automáticos. Botão preto em pílula, azul só como acento. */
export const neutro: Preset = {
  mode: "auto",
  paletas: {
    claro: {
      bg: "#fcfcfc", surface: "#ffffff", surface2: "#f5f7fb", text: "#000000", dim: "#677294",
      faint: "#838da1", line: "#e6e8ec", ctaBg: "#000000", ctaText: "#ffffff", shellBg: "#05070a", shellText: "#ffffff",
    },
    escuro: {
      bg: "#05070a", surface: "#111b29", surface2: "#101418", text: "#ffffff", dim: "#afb0b1",
      faint: "#737476", line: "#26282b", ctaBg: "#ffffff", ctaText: "#05070a", shellBg: "#101418", shellText: "#ffffff",
    },
  },
  accent: { claro: "#007dff", escuro: "#4da3ff" },
  font: "jakarta",
  background: "onda",
  buttons: "pilula",
  corners: "medio",
  blocos: {
    profile: { header: "centro", socials: "icones" },
    cards: { layout: "carrossel" },
    links: { layout: "lista" },
    concierge: { variant: "destaque" },
    products: { layout: "carrossel" },
  },
};
