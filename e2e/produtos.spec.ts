import { expect, test } from "@playwright/test";
import config from "../linkbio.config";
import { blocosAtivos } from "../lib/blocos";

/** Fase V · L9: vitrine do catálogo. O filtro por categoria funciona sem JavaScript (só CSS). */
const bloco = blocosAtivos(config.blocks).find((b) => b.type === "products");
const produtos =
  bloco?.type === "products" && bloco.items
    ? config.catalog.filter((p) => bloco.items!.includes(p.id))
    : config.catalog;
const categorias = [...new Set(produtos.map((p) => p.category).filter(Boolean))] as string[];

test.describe("filtro da vitrine sem JavaScript", () => {
  test.use({ javaScriptEnabled: false, reducedMotion: "reduce" });

  test("cada categoria mostra só os seus produtos e Todos volta a lista inteira", async ({ page }) => {
    test.skip(!bloco || bloco.type !== "products" || !bloco.filter || categorias.length < 2, "config sem vitrine com filtro");
    await page.goto("/");
    const itens = page.locator(".bloco-produtos .produtos-lista > li");
    await expect(itens.locator("visible=true")).toHaveCount(produtos.length);

    for (const cat of categorias) {
      await page.locator(".filtro-chips label", { hasText: cat }).click();
      await expect(itens.locator("visible=true")).toHaveCount(produtos.filter((p) => p.category === cat).length);
    }
    await page.locator(".filtro-chips label", { hasText: "Todos" }).click();
    await expect(itens.locator("visible=true")).toHaveCount(produtos.length);
  });
});

test("filtro acessível por teclado: rádios com nome, um por categoria mais Todos", async ({ page }) => {
  test.skip(!bloco || bloco.type !== "products" || !bloco.filter || categorias.length < 2, "config sem vitrine com filtro");
  await page.goto("/");
  const radios = page.getByRole("radio");
  await expect(radios).toHaveCount(categorias.length + 1);
  await expect(page.getByRole("radio", { name: /Todos/ })).toBeChecked();
  await page.getByRole("radio", { name: /Todos/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("radio", { name: new RegExp(categorias[0]!) })).toBeChecked();
});

test("cada produto é um link https com nome e ação", async ({ page }) => {
  test.skip(!bloco, "config sem vitrine");
  await page.goto("/");
  const links = page.locator(".bloco-produtos a.produto");
  await expect(links).toHaveCount(produtos.length);
  for (const [i, p] of produtos.entries()) {
    await expect(links.nth(i)).toHaveAttribute("href", p.url);
    await expect(links.nth(i).locator(".produto-nome")).toHaveText(p.title);
  }
});
