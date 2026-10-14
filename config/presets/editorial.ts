import type { Preset } from "./tipos";

/** Papel bege, título serifado. */
export const editorial: Preset = {
  mode: "claro",
  paletas: {
    claro: {
      bg: "#f3efe6", surface: "#fbf8f1", surface2: "#ece6d8", text: "#1c1a17", dim: "#6b645a",
      faint: "#8a8176", line: "#ddd5c5", ctaBg: "#1c1a17", ctaText: "#fbf8f1", shellBg: "#1c1a17", shellText: "#fbf8f1",
    },
  },
  accent: { claro: "#b4532a" },
  font: { display: "serif", body: "jakarta" },
  background: "liso",
  buttons: "contorno",
  corners: "reto",
  blocos: {
    profile: { header: "lado", socials: "nomes" },
    cards: { layout: "lista" },
    links: { layout: "lista" },
    concierge: { variant: "leve" },
    products: { layout: "grade" },
  },
};
