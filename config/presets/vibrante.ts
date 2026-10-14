import type { Preset } from "./tipos";

/** Roxo profundo com destaque forte. */
export const vibrante: Preset = {
  mode: "escuro",
  paletas: {
    escuro: {
      bg: "#1f1147", surface: "#2a1a5e", surface2: "#241552", text: "#ffffff", dim: "#c3bfd2",
      faint: "#8f88a3", line: "#3f3170", ctaBg: "#ff5ca8", ctaText: "#1f1147", shellBg: "#130a30", shellText: "#ffffff",
    },
  },
  accent: { escuro: "#ff5ca8" },
  font: { display: "bricolage", body: "jakarta" },
  background: "gradiente",
  buttons: "pilula",
  corners: "redondo",
  blocos: {
    profile: { header: "centro", socials: "nomes" },
    cards: { layout: "carrossel" },
    links: { layout: "icones" },
    concierge: { variant: "destaque" },
    products: { layout: "carrossel" },
  },
};
