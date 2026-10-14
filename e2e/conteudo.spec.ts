import { expect, test } from "@playwright/test";
import config from "../linkbio.config";
import { blocosAtivos } from "../lib/blocos";

/** Fase V · L8: banner, depoimentos e perguntas frequentes. Lê a config: vale no template e na instância. */
test("banner com ação tem botão de 44px e texto branco sobre fundo que passa AA", async ({ page }) => {
  const banner = blocosAtivos(config.blocks).find((b) => b.type === "banner" && b.action);
  test.skip(!banner, "config sem banner com ação");
  await page.goto("/");
  const acao = page.locator(".banner-acao").first();
  expect(Math.round((await acao.boundingBox())!.height)).toBeGreaterThanOrEqual(44);
  const [cor, fundo] = await page.locator(".bloco-banner").first().evaluate((el) => {
    const s = getComputedStyle(el);
    return [s.color, s.backgroundColor];
  });
  expect(contraste(cor, fundo)).toBeGreaterThanOrEqual(4.5);
});

test("depoimentos renderizam um item por depoimento", async ({ page }) => {
  const bloco = blocosAtivos(config.blocks).find((b) => b.type === "testimonials");
  test.skip(!bloco || bloco.type !== "testimonials", "config sem depoimentos");
  await page.goto("/");
  await expect(page.locator(".depoimento")).toHaveCount(bloco!.type === "testimonials" ? bloco!.items.length : 0);
});

test.describe("perguntas frequentes sem JavaScript", () => {
  test.use({ javaScriptEnabled: false, reducedMotion: "reduce" });
  test("abre e fecha com details nativo", async ({ page }) => {
    const bloco = blocosAtivos(config.blocks).find((b) => b.type === "faq");
    test.skip(!bloco, "config sem faq");
    await page.goto("/");
    const segunda = page.locator(".faq-lista details").nth(1);
    await expect(segunda).not.toHaveAttribute("open");
    await segunda.locator("summary").click({ force: true });
    await expect(segunda).toHaveAttribute("open");
  });
});

function contraste(a: string, b: string): number {
  const rgb = (c: string) => c.match(/\d+(\.\d+)?/g)!.slice(0, 3).map(Number);
  const lum = (c: string) => {
    const [r, g, bl] = rgb(c).map((v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x! + 0.05) / (y! + 0.05);
}
