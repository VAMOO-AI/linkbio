import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, test } from "vitest";
import { FaqBlock } from "@/blocks/faq";
import { GalleryBlock } from "@/blocks/gallery";
import { LinksBlock } from "@/blocks/links";
import { ProfileBlock } from "@/blocks/profile";
import { SocialBlock } from "@/blocks/social";
import { TestimonialsBlock } from "@/blocks/testimonials";

/**
 * Item repetido na config (dois links para o mesmo endereço, a mesma foto duas vezes) não pode
 * gerar chave repetida: o React duplica ou some com o item. O render de servidor não avisa,
 * então o teste confere as chaves direto na árvore que o bloco devolve.
 */
function chavesRepetidas(no: ReactNode): string[] {
  const repetidas: string[] = [];
  const visitar = (n: ReactNode) => {
    if (Array.isArray(n)) {
      const vistas = new Set<string>();
      for (const filho of n) {
        if (isValidElement(filho) && filho.key !== null) {
          if (vistas.has(filho.key)) repetidas.push(filho.key);
          vistas.add(filho.key);
        }
        visitar(filho);
      }
      return;
    }
    if (isValidElement(n)) visitar((n as ReactElement<{ children?: ReactNode }>).props.children);
  };
  visitar(no);
  return repetidas;
}

const MESMA_URL = "https://exemplo.com/";

describe("chaves das listas com itens repetidos", () => {
  test("links: dois itens com a mesma URL", () => {
    const arvore = LinksBlock({
      layout: "lista",
      items: [
        { title: "Curso", url: MESMA_URL },
        { title: "Artigos", url: MESMA_URL },
      ],
    });
    expect(chavesRepetidas(arvore)).toEqual([]);
  });

  test("galeria: a mesma foto duas vezes", () => {
    const arvore = GalleryBlock({
      images: [
        { src: "/foto.jpg", alt: "Um" },
        { src: "/foto.jpg", alt: "Dois" },
      ],
    });
    expect(chavesRepetidas(arvore)).toEqual([]);
  });

  test("perguntas frequentes: a mesma pergunta duas vezes", () => {
    const arvore = FaqBlock({
      items: [
        { q: "Como funciona?", a: "Assim." },
        { q: "Como funciona?", a: "Assado." },
      ],
    });
    expect(chavesRepetidas(arvore)).toEqual([]);
  });

  test("depoimentos: o mesmo depoimento duas vezes", () => {
    const d = { quote: "Mudou a minha semana.", name: "Ana", role: "Cliente" };
    expect(chavesRepetidas(TestimonialsBlock({ items: [d, d] }))).toEqual([]);
  });

  test("redes: a mesma rede duas vezes", () => {
    const rede = { icone: "site" as const, rotulo: "Site", url: MESMA_URL };
    expect(chavesRepetidas(SocialBlock({ items: [rede, rede] }))).toEqual([]);
  });

  test("perfil: a mesma tag e a mesma rede duas vezes", () => {
    const rede = { icone: "site" as const, rotulo: "Site", url: MESMA_URL };
    for (const socials of ["icones", "nomes"] as const) {
      const arvore = ProfileBlock({
        header: "centro",
        socials,
        profile: {
          name: "Pessoa",
          handle: "@pessoa",
          avatar: "/avatar.jpg",
          bio: "Bio.",
          tags: ["Tema", "Tema"],
          socials: [rede, rede],
        },
      });
      expect(chavesRepetidas(arvore)).toEqual([]);
    }
  });
});
