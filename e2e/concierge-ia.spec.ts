import { expect, test } from "@playwright/test";

/**
 * Modo IA contra a API falsa (ANTHROPIC_BASE_URL). A página publicada segue o roteiro da config;
 * /concierge-ia-teste só existe nesse ambiente e força a dúvida livre.
 */

test("modo roteiro não mostra a dúvida livre", async ({ page, request }) => {
  await page.goto("/");
  const concierge = page.getByTestId("concierge").first();
  await expect(concierge).toHaveAttribute("data-pronto", "true");
  await expect(concierge.getByTestId("cc-duvida")).toHaveCount(0);
  await expect(concierge.getByTestId(/cc-chip-/).first()).toBeVisible();
  const srcs = await page
    .locator("script[src]:not([nomodule])")
    .evaluateAll((els) => els.map((el) => (el as HTMLScriptElement).src));
  for (const src of srcs) {
    const corpo = await (await request.get(src)).text();
    expect(corpo, src).not.toContain("cc-duvida");
  }
});

test("dúvida livre: pergunta, resposta e botão da oferta", async ({ page }) => {
  await page.goto("/concierge-ia-teste");
  const concierge = page.getByTestId("concierge").first();
  await expect(concierge).toHaveAttribute("data-pronto", "true");
  await concierge.getByTestId("cc-duvida").fill("Quero organizar minha semana");
  await concierge.getByTestId("cc-enviar").click();
  const recomendacao = concierge.getByTestId("cc-recomendacao");
  await expect(recomendacao).toBeVisible();
  await expect(concierge.locator(".concierge-oferta")).toHaveText("Mentoria Rotina Leve");
  await expect(concierge.locator(".concierge-motivo")).toContainText("A mentoria encaixa no que você descreveu.");
  const cta = concierge.getByTestId("cc-cta");
  await expect(cta).toHaveText("Quero a mentoria");
  await expect(cta).toHaveAttribute("href", "https://exemplo.com/mentoria");
});
