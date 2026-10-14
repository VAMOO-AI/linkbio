import { expect, test } from "@playwright/test";
import config from "../linkbio.config";

const futura = config.blocks.find((b) => b.type === "text" && b.id === "turma-futura");
const passada = config.blocks.find((b) => b.type === "text" && b.id === "turma-encerrada");

test("bloco com janela futura não aparece e o passado some", async ({ page }) => {
  if (futura?.type !== "text" || passada?.type !== "text") {
    test.skip(true, "config sem as janelas de exemplo");
    return;
  }
  await page.goto("/");
  await expect(page.getByText("Sou uma pessoa fictícia criada só para demonstrar este template.")).toBeVisible();
  await expect(page.getByText(futura.body)).toHaveCount(0);
  await expect(page.getByText(passada.body)).toHaveCount(0);
});
