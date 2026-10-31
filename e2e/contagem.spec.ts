import { expect, test } from "@playwright/test";

/** Bloco contagem: números andam no navegador, zerado mostra o texto, sem JavaScript fica a data. */

test("a contagem mostra dias e horas que faltam e o segundo anda", async ({ page }) => {
  await page.goto("/e2e/contagem");
  const futura = page.locator('[data-teste="futura"]');
  const numeros = futura.locator(".contagem-unidade strong");
  await expect(numeros).toHaveCount(4);
  await expect(numeros.nth(0)).toHaveText("02");
  await expect(numeros.nth(1)).toHaveText(/^0[23]$/);
  const antes = await numeros.nth(3).textContent();
  await expect(numeros.nth(3)).not.toHaveText(antes ?? "", { timeout: 3000 });
  await expect(futura.locator("time")).toHaveAttribute("datetime", /Z$/);
  const botao = futura.locator(".contagem-acao");
  await expect(botao).toHaveAttribute("href", "https://exemplo.com/grupo");
  expect(Math.round((await botao.boundingBox())!.height)).toBeGreaterThanOrEqual(44);
});

test("contagem que já passou mostra o texto de zerado no lugar dos números", async ({ page }) => {
  await page.goto("/e2e/contagem");
  const passada = page.locator('[data-teste="passada"]');
  await expect(passada.locator(".contagem-fim")).toHaveText("Está no ar.");
  await expect(passada.locator(".contagem-unidade")).toHaveCount(0);
});

test("em 375 px nada passa da largura da tela", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/e2e/contagem");
  const largura = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(largura).toBeLessThanOrEqual(375);
});

test.describe("sem JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("ficam os números da montagem e a data", async ({ page }) => {
    await page.goto("/e2e/contagem");
    const futura = page.locator('[data-teste="futura"]');
    await expect(futura.locator(".contagem-unidade strong").first()).toHaveText("02");
    await expect(futura.locator(".contagem-quando")).toHaveText(/^\d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}$/);
  });
});
