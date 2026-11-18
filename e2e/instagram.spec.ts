import { expect, test } from "@playwright/test";
import config from "../linkbio.config";
import { blocosAtivos } from "../lib/blocos";
import { postsDo } from "../lib/instagram";

/** Bloco instagram: grade dos últimos posts. Lê a config e o posts.json: vale no template e na instância. */
const bloco = blocosAtivos(config.blocks).find((b) => b.type === "instagram");
const esperados = bloco?.type === "instagram" ? postsDo(bloco.handle ?? config.profile.handle, bloco.limit ?? 6) : [];

test("mostra os posts do posts.json, cada um levando ao post no Instagram", async ({ page }) => {
  test.skip(esperados.length === 0, "sem bloco instagram ou sem posts coletados");
  await page.goto("/");
  const posts = page.locator(".bloco-instagram .insta-post");
  await expect(posts).toHaveCount(esperados.length);
  for (let i = 0; i < esperados.length; i++) {
    await expect(posts.nth(i)).toHaveAttribute("href", esperados[i]!.url);
    await expect(posts.nth(i).locator("img")).toHaveAttribute("alt", /\S/);
  }
});

test("em 375px a grade cabe na tela e o botão Seguir tem alvo de toque >= 44px", async ({ page }) => {
  test.skip(esperados.length === 0, "sem bloco instagram ou sem posts coletados");
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(sw).toBeLessThanOrEqual(cw);
  const grade = await page.locator(".insta-grade").boundingBox();
  expect(grade && grade.x + grade.width).toBeLessThanOrEqual(375);
  const seguir = await page.locator(".insta-seguir").boundingBox();
  expect(Math.round(seguir!.height)).toBeGreaterThanOrEqual(44);
});
