import { describe, expect, test } from "vitest";
import { dadosEstruturados, mapaDoSite, regrasDeRobos } from "../lib/seo";

const perfil = {
  name: "Casa Verde",
  bio: "Plantas para apartamento.",
  avatar: "/logo.png",
  socials: [{ url: "https://instagram.com/casaverde" }],
};

describe("sitemap e robots", () => {
  test("usa o endereço de verdade e, no exemplo, o da Vercel", () => {
    expect(mapaDoSite("https://bio.minhamarca.com.br", { VERCEL_PROJECT_PRODUCTION_URL: "x.vercel.app" })).toEqual([
      { url: "https://bio.minhamarca.com.br" },
    ]);
    expect(mapaDoSite("https://link.exemplo.com", { VERCEL_PROJECT_PRODUCTION_URL: "minha-bio.vercel.app" })).toEqual([
      { url: "https://minha-bio.vercel.app" },
    ]);
  });

  test("o painel e a prévia ficam fora do índice", () => {
    const r = regrasDeRobos("https://bio.minhamarca.com.br", {});
    const regras = Array.isArray(r.rules) ? r.rules : [r.rules];
    const disallow = regras.flatMap((regra) => (Array.isArray(regra.disallow) ? regra.disallow : [regra.disallow]));
    expect(disallow).toEqual(expect.arrayContaining(["/admin", "/admin-previa"]));
    expect(r.sitemap).toBe("https://bio.minhamarca.com.br/sitemap.xml");
  });
});

describe("JSON-LD", () => {
  test("pessoa é Person com as redes; empresa é Organization com logo", () => {
    const base = new URL("https://bio.minhamarca.com.br");
    const pessoa = dadosEstruturados({ profile: { ...perfil, tipo: "pessoa" }, site: { url: base.origin } }, base);
    expect(pessoa["@type"]).toBe("Person");
    expect(pessoa.sameAs).toEqual(["https://instagram.com/casaverde"]);
    expect(pessoa).not.toHaveProperty("logo");

    const empresa = dadosEstruturados({ profile: { ...perfil, tipo: "empresa" }, site: { url: base.origin } }, base);
    expect(empresa["@type"]).toBe("Organization");
    expect(empresa.logo).toBe("https://bio.minhamarca.com.br/logo.png");
    expect(empresa.sameAs).toEqual(["https://instagram.com/casaverde"]);
  });

  test("sem redes, não inventa sameAs", () => {
    const base = new URL("https://bio.minhamarca.com.br");
    const json = dadosEstruturados(
      { profile: { name: "Ana", bio: "Oi.", avatar: "https://cdn.exemplo.com/a.jpg" }, site: { url: base.origin } },
      base,
    );
    expect(json["@type"]).toBe("Person");
    expect(json).not.toHaveProperty("sameAs");
    expect(json.image).toBe("https://cdn.exemplo.com/a.jpg");
  });
});
