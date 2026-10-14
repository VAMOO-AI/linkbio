import { expect, test } from "@playwright/test";
import config from "../linkbio.config";
import { blocosAtivos } from "../lib/blocos";

/** Fase V · L4: cabeçalho, redes no perfil e rodapé. Lê a config: vale no template e na instância. */
test("perfil traz data-header e data-socials resolvidos do modelo", async ({ page }) => {
  await page.goto("/");
  const perfil = page.locator(".bloco-perfil");
  await expect(perfil).toHaveAttribute("data-header", /^(centro|capa|lado)$/);
  await expect(perfil).toHaveAttribute("data-socials", /^(icones|nomes|oculto)$/);
});

test("redes do perfil têm nome acessível e alvo de toque >= 44px", async ({ page }) => {
  const redes = config.profile.socials ?? [];
  test.skip(redes.length === 0, "config sem profile.socials");
  await page.goto("/");
  const links = page.locator(".perfil-redes a");
  await expect(links).toHaveCount(redes.length);
  for (const [i, rede] of redes.entries()) {
    const link = links.nth(i);
    await expect(link).toHaveAccessibleName(rede.rotulo);
    const caixa = (await link.boundingBox())!;
    expect(Math.round(caixa.width)).toBeGreaterThanOrEqual(44);
    expect(Math.round(caixa.height)).toBeGreaterThanOrEqual(44);
  }
});

test("texto com variant rodape vira <footer>", async ({ page }) => {
  const rodape = blocosAtivos(config.blocks).find((b) => b.type === "text" && b.variant === "rodape");
  test.skip(!rodape, "config sem rodapé");
  await page.goto("/");
  await expect(page.locator('footer.bloco-texto[data-variant="rodape"]')).toBeVisible();
});
