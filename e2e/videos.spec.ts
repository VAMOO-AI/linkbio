import { expect, test } from "@playwright/test";
import config from "../linkbio.config";
import { blocosAtivos } from "../lib/blocos";
import { videosDo } from "../lib/youtube";

/** Bloco videos: últimos vídeos do canal. Lê a config e o videos.json: vale no template e na instância. */
const bloco = blocosAtivos(config.blocks).find((b) => b.type === "videos");
const esperados = bloco?.type === "videos" ? videosDo(bloco.canal, bloco.limit ?? 6, bloco.shorts ?? false) : [];

test("mostra os vídeos do videos.json, cada um levando ao vídeo no YouTube", async ({ page }) => {
  test.skip(esperados.length === 0, "sem bloco videos ou sem vídeos coletados");
  await page.goto("/");
  const cards = page.locator(".bloco-videos .video-card");
  await expect(cards).toHaveCount(esperados.length);
  for (let i = 0; i < esperados.length; i++) {
    await expect(cards.nth(i)).toHaveAttribute("href", esperados[i]!.url);
    await expect(cards.nth(i).locator(".video-nome")).toHaveText(esperados[i]!.titulo);
  }
});

test("em 320px os vídeos não estouram a página e o Inscrever-se tem alvo de toque >= 44px", async ({ page }) => {
  test.skip(esperados.length === 0, "sem bloco videos ou sem vídeos coletados");
  // 320px com @canal longo: no WebKit o cabeçalho sem min-width: 0 empurrava o Inscrever-se para fora.
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/");
  const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(sw).toBeLessThanOrEqual(cw);
  const botao = await page.locator(".videos-inscrever").boundingBox();
  expect(Math.round(botao!.height)).toBeGreaterThanOrEqual(44);
});
