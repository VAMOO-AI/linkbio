import { expect, test } from "@playwright/test";
import config from "../linkbio.config";
import { blocosAtivos } from "../lib/blocos";

/** Fase V · L6: link com imagem/subtítulo e grupo de links. Lê a config: vale no template e na instância. */
test("bloco links traz data-layout e um link por item, com alvo >= 44px", async ({ page }) => {
  const grupos = blocosAtivos(config.blocks).filter((b) => b.type === "links");
  test.skip(grupos.length === 0, "config sem bloco links");
  await page.goto("/");
  const blocos = page.locator(".bloco-links");
  await expect(blocos).toHaveCount(grupos.length);
  for (const [i, g] of grupos.entries()) {
    const bloco = blocos.nth(i);
    await expect(bloco).toHaveAttribute("data-layout", /^(lista|botoes|icones)$/);
    const links = bloco.locator("a");
    await expect(links).toHaveCount(g.items.length);
    for (const link of await links.all()) {
      expect(Math.round((await link.boundingBox())!.height)).toBeGreaterThanOrEqual(44);
    }
  }
});

test("link com subtítulo ou imagem vira card", async ({ page }) => {
  const card = blocosAtivos(config.blocks).find((b) => b.type === "link" && (b.subtitle || b.image));
  test.skip(!card, "config sem link em card");
  await page.goto("/");
  await expect(page.locator(".bloco-link[data-card]").first()).toBeVisible();
});
