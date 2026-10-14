import { expect, test } from "@playwright/test";

/** Fase V · L3: fundo, botões e cantos do modelo chegam ao <html> e ao CSS computado. */
test("html traz data-fundo e data-botoes do modelo", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-fundo", "onda");
  await expect(html).toHaveAttribute("data-botoes", "pilula");
});

test("CTA principal: pílula com as cores de CTA do modelo", async ({ page }) => {
  await page.goto("/");
  const cta = page.locator(".bloco-cta").first();
  const [raio, fundo, esperado] = await cta.evaluate((el) => {
    const s = getComputedStyle(el);
    const probe = document.createElement("div");
    probe.style.background = "var(--cta-bg)";
    document.body.append(probe);
    const cor = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return [s.borderTopLeftRadius, s.backgroundColor, cor];
  });
  expect(raio).toBe("100px");
  expect(fundo).toBe(esperado);
});

test.describe("movimento reduzido", () => {
  test.use({ reducedMotion: "reduce" });
  test("nenhum bloco anima", async ({ page }) => {
    await page.goto("/");
    const nomes = await page.locator(".pagina > *").evaluateAll((els) =>
      els.map((el) => getComputedStyle(el).animationName),
    );
    expect(nomes.every((n) => n === "none")).toBe(true);
  });
});

test("sem reduced-motion, blocos a partir do 3º entram com animação", async ({ page }) => {
  await page.goto("/");
  const nome = await page.locator(".pagina > :nth-child(3)").evaluate((el) => getComputedStyle(el).animationName);
  expect(nome).toBe("lb-sobe");
});
