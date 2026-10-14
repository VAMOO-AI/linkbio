import { expect, test } from "@playwright/test";
import config from "../linkbio.config";
import { blocosAtivos } from "../lib/blocos";

/** Fase V · L5: layouts de cards e capas. Lê a config: vale no template e na instância. */
test("bloco cards traz data-layout do bloco ou do modelo", async ({ page }) => {
  await page.goto("/");
  const blocos = page.locator(".bloco-cards");
  const total = blocosAtivos(config.blocks).filter((b) => b.type === "cards").length;
  await expect(blocos).toHaveCount(total);
  for (let i = 0; i < total; i++) {
    await expect(blocos.nth(i)).toHaveAttribute("data-layout", /^(carrossel|lista|grade|destaque)$/);
  }
});

test("carrossel rola dentro do bloco, com snap, sem estourar a página", async ({ page }) => {
  await page.goto("/");
  const carrossel = page.locator('.bloco-cards[data-layout="carrossel"] .cards-lista').first();
  test.skip((await carrossel.count()) === 0, "exemplo sem carrossel");
  const [snap, scroll, largura] = await carrossel.evaluate((el) => [
    getComputedStyle(el).scrollSnapType,
    el.scrollWidth,
    el.clientWidth,
  ]);
  expect(snap).toContain("x");
  expect(scroll).toBeGreaterThan(largura);
  const doc = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(doc[0]).toBeLessThanOrEqual(doc[1]!);
});

test("oferta com cover renderiza a capa com o tom da config", async ({ page }) => {
  const comCapa = config.offers.filter((o) => o.cover);
  test.skip(comCapa.length === 0, "nenhuma oferta com cover");
  await page.goto("/");
  const capas = page.locator(".card-capa");
  await expect(capas.first()).toBeVisible();
  const tons = await capas.evaluateAll((els) => els.map((el) => el.getAttribute("data-tone")));
  for (const t of tons) expect(["escuro", "claro", "gradiente"]).toContain(t);
});

test("ações do card têm alvo de toque >= 44px", async ({ page }) => {
  await page.goto("/");
  for (const alvo of await page.locator(".card-acao, .card-mais").all()) {
    const caixa = await alvo.boundingBox();
    if (caixa) expect(Math.round(caixa.height)).toBeGreaterThanOrEqual(44);
  }
});

test.describe("responsivo (pedido do Nicolas: sem cortes no desktop e no mobile)", () => {
  for (const largura of [320, 1280]) {
    test(`sem rolagem lateral em ${largura}px`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/");
      const [sw, cw] = await page.evaluate(() => [
        document.documentElement.scrollWidth,
        document.documentElement.clientWidth,
      ]);
      expect(sw).toBeLessThanOrEqual(cw);
    });
  }

  test("no desktop o carrossel vira grade, sem rolagem nem corte", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    const lista = page.locator('.bloco-cards[data-layout="carrossel"] .cards-lista').first();
    test.skip((await lista.count()) === 0, "exemplo sem carrossel");
    const [display, sw, cw] = await lista.evaluate((el) => [getComputedStyle(el).display, el.scrollWidth, el.clientWidth]);
    expect(display).toBe("grid");
    expect(sw).toBeLessThanOrEqual(cw);
  });
});
