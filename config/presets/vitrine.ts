import type { Preset } from "./tipos";

/** Claro e quente, pensado para vitrine de produtos. */
export const vitrine: Preset = {
  mode: "claro",
  paletas: {
    claro: {
      bg: "#efece8", surface: "#ffffff", surface2: "#f4f1ec", text: "#161616", dim: "#5f5a55",
      faint: "#89837c", line: "#e2ddd6", ctaBg: "#161616", ctaText: "#ffffff", shellBg: "#161616", shellText: "#ffffff",
    },
  },
  accent: { claro: "#2d6a4f" },
  font: "jakarta",
  background: "liso",
  buttons: "suave",
  corners: "redondo",
  blocos: {
    profile: { header: "capa", socials: "icones" },
    cards: { layout: "grade" },
    links: { layout: "icones" },
    concierge: { variant: "destaque" },
    products: { layout: "grade" },
  },
};
