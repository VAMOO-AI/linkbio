import type { Preset } from "./tipos";

/** Amarelo, bordas grossas, sombra dura. */
export const brutal: Preset = {
  mode: "claro",
  paletas: {
    claro: {
      bg: "#fffbe6", surface: "#ffffff", surface2: "#fff3b0", text: "#111111", dim: "#3d3d3d",
      faint: "#6b6b6b", line: "#111111", ctaBg: "#111111", ctaText: "#fffbe6", shellBg: "#111111", shellText: "#fffbe6",
    },
  },
  accent: { claro: "#ff4d00" },
  font: "grotesk",
  background: "pontos",
  buttons: "brutal",
  corners: "reto",
  blocos: {
    profile: { header: "centro", socials: "icones" },
    cards: { layout: "grade" },
    links: { layout: "botoes" },
    concierge: { variant: "destaque" },
    products: { layout: "grade" },
  },
};
