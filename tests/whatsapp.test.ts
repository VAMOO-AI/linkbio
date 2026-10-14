import { describe, expect, test } from "vitest";
import { linkWhatsApp } from "../lib/whatsapp";

/** F1 — lib/whatsapp.ts. Contrato: `https://wa.me/<dígitos>?text=<encode>`. */
describe("whatsapp.ts", () => {
  test("monta wa.me com número e texto codificado", () => {
    expect(linkWhatsApp("5511987654321", "Oi! Vim pela bio.")).toBe(
      "https://wa.me/5511987654321?text=Oi!%20Vim%20pela%20bio.",
    );
  });

  test("codifica acentos, emojis e quebras de linha sem perda", () => {
    const url = linkWhatsApp(
      "5511987654321",
      "Vim pelo concierge: quero receber pronto · sou dono(a) 🎉\nSegunda linha",
    );
    expect(url.startsWith("https://wa.me/5511987654321?text=")).toBe(true);
    expect(decodeURIComponent(url.split("?text=")[1])).toBe(
      "Vim pelo concierge: quero receber pronto · sou dono(a) 🎉\nSegunda linha",
    );
    expect(url).not.toMatch(/[\s\n]/);
  });

  test("texto vazio gera parâmetro text vazio (link ainda válido)", () => {
    expect(linkWhatsApp("5511987654321", "")).toBe(
      "https://wa.me/5511987654321?text=",
    );
  });

  test("nunca emite http:// (sempre https)", () => {
    expect(linkWhatsApp("5511987654321", "oi")).toMatch(/^https:\/\//);
  });
});
