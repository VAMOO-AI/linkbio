import { expect, test } from "@playwright/test";
import config from "../linkbio.config";
import { blocosAtivos } from "../lib/blocos";

/** Fase V · L10: cupom sem JavaScript. Um toque seleciona o código inteiro. */
const cupom = blocosAtivos(config.blocks).find((b) => b.type === "coupon");

test.describe("cupom sem JavaScript", () => {
  test.use({ javaScriptEnabled: false, reducedMotion: "reduce" });

  test("um clique no código seleciona o código inteiro", async ({ page }) => {
    test.skip(!cupom || cupom.type !== "coupon", "config sem cupom");
    await page.goto("/");
    const codigo = page.locator(".cupom-codigo").first();
    await expect(codigo).toHaveText(cupom!.type === "coupon" ? cupom!.code : "");
    await expect(codigo).toHaveCSS("user-select", "all");
    await codigo.click();
    const selecionado = await page.evaluate(() => window.getSelection()?.toString().trim());
    expect(selecionado).toBe(cupom!.type === "coupon" ? cupom!.code : "");
  });
});

test("botão do cupom tem alvo de 44px e leva ao destino da config", async ({ page }) => {
  test.skip(!cupom || cupom.type !== "coupon" || !cupom.action, "config sem cupom com ação");
  await page.goto("/");
  const acao = page.locator(".cupom-acao").first();
  expect(Math.round((await acao.boundingBox())!.height)).toBeGreaterThanOrEqual(44);
  if (cupom!.type === "coupon" && cupom!.action && "url" in cupom!.action) {
    await expect(acao).toHaveAttribute("href", cupom!.action.url);
  }
});

test("texto de apoio do cupom passa AA sobre o fundo do cupom", async ({ page }) => {
  test.skip(!cupom, "config sem cupom");
  await page.goto("/");
  const [cor, fundo] = await page.locator(".bloco-cupom").first().evaluate((el) => [
    getComputedStyle(el.querySelector(".cupom-dica")!).color,
    getComputedStyle(el).backgroundColor,
  ]);
  const lum = (c: string) => {
    const [r, g, b] = c.match(/\d+(\.\d+)?/g)!.slice(0, 3).map((v) => {
      const x = Number(v) / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const [a, b] = [lum(cor), lum(fundo)].sort((m, n) => n - m);
  expect((a! + 0.05) / (b! + 0.05)).toBeGreaterThanOrEqual(4.5);
});

test("com copy: true, o botão Copiar põe o código na área de transferência", async ({ page, context, browserName }) => {
  test.skip(!cupom || cupom.type !== "coupon" || !cupom.copy, "config sem cupom com copy");
  // Só o chromium aceita dar ao teste permissão de ler a área de transferência; nos outros o clique e
  // o "Copiado" continuam afirmados.
  const leArea = browserName === "chromium";
  if (leArea) await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  const botao = page.locator(".cupom-copiar").first();
  expect(Math.round((await botao.boundingBox())!.height)).toBeGreaterThanOrEqual(44);
  await botao.click();
  await expect(botao).toHaveText("Copiado");
  if (leArea) {
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(cupom!.type === "coupon" ? cupom!.code : "");
  }
});

test("sem copy, o cupom não tem botão (nenhum JavaScript novo)", async ({ page }) => {
  test.skip(!cupom || cupom.type !== "coupon" || cupom.copy === true, "cupom com copy ligado");
  await page.goto("/");
  await expect(page.locator(".cupom-copiar")).toHaveCount(0);
});
