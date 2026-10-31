import { expect, test } from "@playwright/test";

/** Bloco números: a fonte aparece embaixo de cada número e nada estoura 375 px. */

test("cada número mostra a fonte visível", async ({ page }) => {
  await page.goto("/e2e/numeros");
  const itens = page.locator(".numeros-item");
  await expect(itens).toHaveCount(6);
  await expect(itens.first().locator(".numeros-valor")).toHaveText("+300");
  await expect(itens.first().locator(".numeros-fonte")).toHaveText("Fonte: plataforma, out/2026");
  await expect(itens.first().locator(".numeros-fonte")).toBeVisible();
});

test("em 375 px nada passa da largura e 4 números viram 2 por linha", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/e2e/numeros");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  const quatro = page.locator('.numeros-lista[data-qtd="4"] .numeros-item');
  const [a, b, c] = await Promise.all([0, 1, 2].map(async (i) => (await quatro.nth(i).boundingBox())!.y));
  expect(a).toBe(b);
  expect(c).toBeGreaterThan(a!);
});
