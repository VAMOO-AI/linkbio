import { expect, test } from "@playwright/test";
import config from "../linkbio.config";

/** enabled: false tira o bloco da página; o conteúdo continua na config. */
const desligados = config.blocks.filter((b) => b.enabled === false && b.type === "text");

test("bloco de texto desligado não aparece na página", async ({ page }) => {
  test.skip(desligados.length === 0, "config sem bloco de texto desligado");
  await page.goto("/");
  for (const b of desligados) {
    if (b.type === "text") await expect(page.getByText(b.body)).toHaveCount(0);
  }
});
