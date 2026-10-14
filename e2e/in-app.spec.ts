import { expect, test } from "@playwright/test";

// UA real do Instagram no Android: o banner é decidido só no client.
const UA_INSTAGRAM_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 Instagram 340.0.0.22.109 Android";

test.use({ userAgent: UA_INSTAGRAM_ANDROID });

test("in-app browser: hidrata sem erro", async ({ page }) => {
  const erros: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") erros.push(m.text());
  });
  page.on("pageerror", (e) => erros.push(e.message));
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  expect(erros, erros.join("\n")).toEqual([]);
});

test("in-app browser: com Pix e agenda, o banner pede para abrir no navegador", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const banner = page.locator(".banner-inapp");
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("Algumas ações funcionam melhor no navegador.");
  await expect(banner.getByText("Abrir no navegador")).toBeVisible();
  await expect(banner.getByRole("link")).toHaveAttribute("href", /^intent:/);
});
