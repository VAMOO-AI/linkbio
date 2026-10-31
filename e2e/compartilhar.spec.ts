import { expect, test } from "@playwright/test";

/** Compartilhar do perfil: abre sem JavaScript, QR aponta para ?src=qr, Copiar e Esc com JavaScript. */

test("o painel abre com o QR, o link e o botão de baixar; Esc fecha", async ({ page }) => {
  await page.goto("/e2e/compartilhar");
  const resumo = page.locator(".perfil-compartilhar summary");
  expect(Math.round((await resumo.boundingBox())!.height)).toBeGreaterThanOrEqual(44);
  await resumo.click();
  const painel = page.locator(".compartilhar-painel");
  await expect(painel).toBeVisible();
  await expect(painel.locator(".compartilhar-qr svg")).toBeVisible();
  await expect(painel.getByRole("img", { name: /QR Code da bio/ })).toBeVisible();
  await expect(painel.locator(".compartilhar-link")).toHaveText("bio.exemplo.com");
  await expect(painel.locator(".compartilhar-baixar")).toHaveAttribute("download", "qr-code-bio.svg");
  await page.keyboard.press("Escape");
  await expect(painel).toBeHidden();
  await expect(resumo).toBeFocused();
});

test("Copiar link põe o endereço da bio na área de transferência", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "só o chromium dá ao teste permissão de ler a área de transferência");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/e2e/compartilhar");
  await page.locator(".perfil-compartilhar summary").click();
  await page.getByRole("button", { name: "Copiar link" }).click();
  await expect(page.getByRole("button", { name: "Copiado" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("https://bio.exemplo.com");
});

test.describe("sem JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("o painel abre e mostra o QR", async ({ page }) => {
    await page.goto("/e2e/compartilhar");
    await page.locator(".perfil-compartilhar summary").click();
    await expect(page.locator(".compartilhar-qr svg")).toBeVisible();
  });
});
