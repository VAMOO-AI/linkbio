import { describe, expect, test } from "vitest";
import { lerFeed, postsDo, textoAlternativo, type PostDoFeed } from "../lib/instagram";
import { lerCodigo } from "../scripts/instagram";

const post = (codigo: string, extra: Partial<PostDoFeed> = {}): PostDoFeed => ({
  codigo,
  tipo: "video",
  url: `https://www.instagram.com/reel/${codigo}/`,
  imagem: `/instagram/${codigo}.webp`,
  legenda: "",
  ...extra,
});

describe("feed do Instagram (public/instagram/posts.json)", () => {
  const feed = lerFeed({ usuario: "Perfil", coletadoEm: "2026-10-21", posts: [post("A1"), post("B2"), post("C3")] });

  test("devolve os posts do @ pedido, com ou sem @, até o limite", () => {
    expect(postsDo("@perfil", 2, feed).map((p) => p.codigo)).toEqual(["A1", "B2"]);
    expect(postsDo("perfil", 6, feed)).toHaveLength(3);
  });

  test("outro @ no arquivo não aparece como seu", () => {
    expect(postsDo("@outro", 6, feed)).toEqual([]);
  });

  test("descarta post malformado em vez de quebrar a página", () => {
    const sujo = lerFeed({
      usuario: "perfil",
      posts: [
        post("OK"),
        { codigo: "X", tipo: "story" },
        post("Y", { url: "https://evil.com/p/Y/" }),
        post("Z", { imagem: "https://cdn.exemplo.com/z.jpg" }),
        null,
      ],
    });
    expect(sujo.posts.map((p) => p.codigo)).toEqual(["OK"]);
    expect(lerFeed("lixo").posts).toEqual([]);
  });

  test("texto alternativo: tipo + primeira linha da legenda, curta", () => {
    expect(textoAlternativo(post("A", { legenda: "\nPrimeira linha\nsegunda" }))).toBe("Reel: Primeira linha");
    expect(textoAlternativo(post("A", { tipo: "carrossel", legenda: "x".repeat(200) }))).toMatch(/^Carrossel: x{107}…$/);
    expect(textoAlternativo(post("A", { tipo: "imagem" }))).toBe("Post do Instagram");
  });
});

describe("npm run instagram: código do post", () => {
  test("aceita reel/, p/ e o link inteiro", () => {
    expect(lerCodigo("reel/Dd6VJKavDou")).toEqual({ codigo: "Dd6VJKavDou", tipo: "video" });
    expect(lerCodigo("https://www.instagram.com/p/Ddu66k6jt6b/?img_index=1")).toEqual({ codigo: "Ddu66k6jt6b", tipo: "imagem" });
  });

  test("recusa o que não é post", () => {
    expect(() => lerCodigo("perfil.exemplo")).toThrow(/não parece um post/);
  });
});
