/**
 * Janela de data no painel: a linha diz Programado/Expirado, o bloco aberto tem o calendário
 * e a prévia mostra o selo em vez de esconder o bloco. Só no chromium (banco falso, como o painel).
 */

import { expect, test, type Frame, type Page } from "@playwright/test";
import { EMAIL_TESTE, SENHA_TESTE } from "./painel-ambiente";

async function entrar(page: Page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/admin/login");
  await page.getByLabel("E-mail").fill(EMAIL_TESTE);
  await page.getByLabel("Senha").fill(SENHA_TESTE);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("navigation", { name: "Seções" })).toBeVisible();
}

async function quadroPronto(page: Page): Promise<Frame> {
  await expect(page.locator(".a-previa iframe.p-visivel")).toBeVisible({ timeout: 20000 });
  const quadro = page.frames().find((f) => f.url().includes("/admin-previa"));
  if (!quadro) throw new Error("prévia sem quadro");
  await expect(quadro.locator("main.pagina").first()).toBeVisible();
  return quadro;
}

test("selo na prévia e editor de datas no bloco", async ({ page }) => {
  await entrar(page);
  await page.getByRole("navigation", { name: "Seções" }).getByRole("button", { name: "Blocos" }).click();

  const futura = page.locator(".s-lista > li").filter({ hasText: "Turma que ainda não começou" });
  const passada = page.locator(".s-lista > li").filter({ hasText: "Turma que já acabou" });
  await expect(futura.locator(".s-janela")).toHaveText("Programado");
  await expect(passada.locator(".s-janela")).toHaveText("Expirado");

  await futura.locator(".s-bloco-nome").click();
  const datas = page.getByRole("group", { name: "Mostrar só entre datas" });
  await expect(datas).toBeVisible();
  await expect(page.getByLabel("Mostrar a partir de")).toHaveValue("2099-01-01");

  const quadro = await quadroPronto(page);
  await expect(quadro.getByText("Fora do ar até 01/01")).toBeVisible();
  await expect(quadro.getByText("Saiu do ar em 31/01")).toBeVisible();
  await expect(quadro.getByText("Exemplo de bloco programado: fica fora da página até a data marcada.")).toBeVisible();

  await page.getByLabel("Mostrar a partir de").fill("");
  await page.getByLabel("Mostrar até").fill("2020-06-15");
  await expect(futura.locator(".s-janela")).toHaveText("Expirado");
  await expect(quadro.getByText("Saiu do ar em 15/06")).toBeVisible();
});
