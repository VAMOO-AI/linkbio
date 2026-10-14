import { expect, test } from "@playwright/test";
import { esperarFoco } from "./foco";
import config from "../linkbio.config";
import { blocosAtivos } from "../lib/blocos";

// Lê a config em vez de fixar texto: o mesmo spec vale no template e na instância.
const concierges = blocosAtivos(config.blocks).flatMap((b) => (b.type === "concierge" ? [b] : []));

for (const [n, bloco] of concierges.entries()) {
  const [primeiro, ...resto] = bloco.flow;
  if (!primeiro) continue;
  for (const opcao of primeiro.options) {
    test(`concierge ${n + 1}: ramo "${opcao.id}" recomenda "${opcao.offer ?? "conversa"}"`, async ({ page }) => {
      // Sem offer, o final é o convite para conversar: título da opção (ou o padrão) e WhatsApp.
      const oferta = opcao.offer === undefined ? undefined : config.offers.find((o) => o.id === opcao.offer)!;
      await page.goto("/");
      const cc = page.getByTestId("concierge").nth(n);
      // Clique antes da hidratação se perde (visto no Firefox): espera a ilha ficar pronta.
      await expect(cc).toHaveAttribute("data-pronto", "true");

      await cc.getByTestId(`cc-chip-${opcao.id}`).click();
      for (const passo of resto) {
        await cc.getByTestId(`cc-chip-${passo.options[0]!.id}`).click();
      }

      const rec = cc.getByTestId("cc-recomendacao");
      await expect(rec).toContainText(oferta ? oferta.title : (opcao.title ?? "Vamos conversar"));
      await expect(rec).toContainText(opcao.reason ?? "");

      const href = await cc.getByTestId("cc-cta").getAttribute("href");
      if (oferta?.url) {
        expect(href).toBe(oferta.url);
      } else {
        expect(href).toMatch(new RegExp(`^https://wa\\.me/${config.contact.whatsapp}\\?text=`));
        expect(decodeURIComponent(href!.split("text=")[1]!)).toContain(opcao.label);
      }

      const mais = cc.locator(".concierge-mais");
      if (oferta?.more_url) await expect(mais).toHaveAttribute("href", oferta.more_url);
      else await expect(mais).toHaveCount(0);
    });
  }
}

test("todo link externo é https e todo WhatsApp usa o número da config", async ({ page }) => {
  await page.goto("/");
  const hrefs = await page.locator("a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
  for (const href of hrefs) {
    if (href.startsWith("/") || href.startsWith("#")) continue;
    expect(href, href).toMatch(/^https:\/\//);
    if (href.includes("wa.me/")) expect(href).toContain(`wa.me/${config.contact.whatsapp}?`);
  }
});

test("navegação por teclado alcança o concierge e mostra foco visível", async ({ page, browserName }) => {
  // No Safari o Tab sozinho só para em campo de texto; botão e link pedem Option+Tab.
  const TAB = browserName === "webkit" ? "Alt+Tab" : "Tab";
  await page.goto("/");
  const chip = page.getByTestId(/cc-chip-/).first();
  for (let i = 0; i < 40 && !(await chip.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press(TAB);
  }
  await esperarFoco(chip);
  const outline = await chip.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe("none");
});
