import type { Preset } from "./tipos";

/** Escuro, capa no topo, brilho da cor de destaque. */
export const noite: Preset = {
  mode: "escuro",
  paletas: {
    escuro: {
      bg: "#05070a", surface: "#111b29", surface2: "#101418", text: "#ffffff", dim: "#afb0b1",
      faint: "#737476", line: "#26282b", ctaBg: "#ffffff", ctaText: "#05070a", shellBg: "#111b29", shellText: "#ffffff",
    },
  },
  accent: { escuro: "#4da3ff" },
  font: "jakarta",
  background: "gradiente",
  buttons: "pilula",
  corners: "redondo",
  blocos: {
    profile: { header: "capa", socials: "nomes" },
    cards: { layout: "destaque" },
    links: { layout: "botoes" },
    concierge: { variant: "destaque" },
    products: { layout: "carrossel" },
  },
};
