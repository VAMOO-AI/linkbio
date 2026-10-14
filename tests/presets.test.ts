import { describe, expect, test } from "vitest";
import { PRESETS } from "../config/presets";
import { OPCOES } from "../config/opcoes";
import { contraste } from "../lib/theme";

/**
 * Fase V: todo modelo pronto passa AA (WCAG) nos pares de texto.
 * Texto e texto secundário (dim) >= 4,5:1 sobre bg e surface; faint é decorativo (>= 3:1).
 */
const paletas = Object.entries(PRESETS).flatMap(([id, p]) =>
  (["claro", "escuro"] as const).filter((m) => p.paletas[m]).map((m) => [`${id}.${m}`, p.paletas[m]!] as const),
);

describe("presets", () => {
  test("todo preset do catálogo existe e vice-versa", () => {
    expect(Object.keys(PRESETS).sort()).toEqual(Object.keys(OPCOES.preset).sort());
  });

  test.each(paletas)("%s: texto e dim >= 4,5:1 sobre bg e surface", (_, p) => {
    for (const cor of [p.text, p.dim]) {
      expect(contraste(cor, p.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(cor, p.surface)).toBeGreaterThanOrEqual(4.5);
    }
  });

  test.each(paletas)("%s: CTA e bloco de destaque >= 4,5:1", (_, p) => {
    expect(contraste(p.ctaText, p.ctaBg)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(p.shellText, p.shellBg)).toBeGreaterThanOrEqual(4.5);
  });

  test.each(paletas)("%s: faint (decorativo) >= 3:1 sobre bg", (_, p) => {
    expect(contraste(p.faint, p.bg)).toBeGreaterThanOrEqual(3);
  });

  test("todo preset tem accent para cada paleta que declara", () => {
    for (const p of Object.values(PRESETS)) {
      if (p.paletas.claro) expect(p.accent.claro ?? p.accent.escuro).toBeTruthy();
      if (p.paletas.escuro) expect(p.accent.escuro ?? p.accent.claro).toBeTruthy();
    }
  });
});
