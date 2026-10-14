import { expect, test } from "@playwright/test";

/**
 * Fase V · L2: o modelo do exemplo (neutro) usa só a Jakarta.
 * As outras famílias têm preload: false e não podem ser baixadas.
 */
test("exemplo carrega a Jakarta e nenhuma fonte que não usa", async ({ page }) => {
  await page.goto("/");
  const carregadas = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family);
  });
  expect(carregadas.some((f) => /jakarta/i.test(f))).toBe(true);
  expect(carregadas.filter((f) => /serif|grotesk|bricolage/i.test(f))).toEqual([]);
});

async function preloads(page: import("@playwright/test").Page, caminho: string) {
  await page.goto(caminho);
  return page.locator('link[rel="preload"][as="font"]').evaluateAll((els) =>
    [...new Set(els.map((el) => el.getAttribute("href")).filter((h): h is string => Boolean(h)))].sort(),
  );
}

test("pré-carrega a fonte do modelo, e dois modelos diferentes não baixam a mesma lista", async ({ page }) => {
  const neutro = await preloads(page, "/e2e/fonte/neutro");
  const brutal = await preloads(page, "/e2e/fonte/brutal");
  const editorial = await preloads(page, "/e2e/fonte/editorial");
  const home = await preloads(page, "/");
  expect(neutro.length).toBeGreaterThan(0);
  expect(brutal.length).toBeGreaterThan(0);
  expect(editorial.length).toBeGreaterThan(brutal.length);
  expect(brutal).not.toEqual(editorial);
  expect(home).toEqual(neutro);
});

test("a foto do perfil pede prioridade e não é lazy", async ({ page }) => {
  await page.goto("/");
  const foto = page.locator(".perfil-avatar");
  await expect(foto).toHaveAttribute("fetchpriority", "high");
  await expect(foto).not.toHaveAttribute("loading", "lazy");
});

test("título usa --font-display e texto usa --font", async ({ page }) => {
  await page.goto("/");
  const [corpo, titulo] = await page.evaluate(() => [
    getComputedStyle(document.body).fontFamily,
    getComputedStyle(document.querySelector("h1, h2")!).fontFamily,
  ]);
  expect(corpo).toMatch(/jakarta/i);
  expect(titulo).toMatch(/jakarta/i);
});
