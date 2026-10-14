import { expect, test } from "@playwright/test";
import { esperarFoco } from "./foco";

/** Fase V · L7: variante, foco e contraste do concierge. */
test("concierge traz data-variant resolvido do bloco ou do modelo", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("concierge").first()).toHaveAttribute("data-variant", /^(destaque|leve)$/);
});

test("depois de responder, o foco vai para a próxima pergunta e depois para a recomendação", async ({ page }) => {
  await page.goto("/");
  const cc = page.getByTestId("concierge").first();
  await expect(cc.locator(".concierge-corpo")).toHaveAttribute("aria-live", "polite");
  for (let i = 0; i < 10; i++) {
    const chips = cc.getByTestId(/cc-chip-/);
    if ((await chips.count()) === 0) break;
    await chips.first().click();
    const pergunta = cc.locator(".concierge-pergunta");
    if (await pergunta.count()) await esperarFoco(pergunta);
  }
  await esperarFoco(cc.locator(".concierge-oferta"));
});

test("card de recomendação se destaca do fundo do concierge", async ({ page }) => {
  await page.goto("/");
  const cc = page.getByTestId("concierge").first();
  for (let i = 0; i < 10; i++) {
    const chips = cc.getByTestId(/cc-chip-/);
    if ((await chips.count()) === 0) break;
    await chips.first().click();
  }
  const [fundoBloco, fundoCard] = await Promise.all([
    cc.evaluate((el) => getComputedStyle(el).backgroundColor),
    cc.getByTestId("cc-recomendacao").evaluate((el) => getComputedStyle(el).backgroundColor),
  ]);
  expect(fundoCard).not.toBe(fundoBloco);
});

test("título do concierge legível sobre o fundo do bloco (herda a cor, não a da página)", async ({ page }) => {
  await page.goto("/");
  const titulo = page.locator(".bloco-concierge h2").first();
  test.skip((await titulo.count()) === 0, "concierge sem título h2");
  const [cor, fundo] = await page.locator(".bloco-concierge").first().evaluate((el) => {
    const h = el.querySelector("h2")!;
    return [getComputedStyle(h).color, getComputedStyle(el).backgroundColor];
  });
  expect(contrasteRgb(cor, fundo)).toBeGreaterThanOrEqual(4.5);
});

function contrasteRgb(a: string, b: string): number {
  const lum = (c: string) => {
    const [r, g, bl] = c.match(/\d+(\.\d+)?/g)!.slice(0, 3).map((v) => {
      const x = Number(v) / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x! + 0.05) / (y! + 0.05);
}
