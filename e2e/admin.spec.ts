import { expect, test } from "@playwright/test";

/** /admin sem banco configurado (o template roda assim no CI): nunca abre o editor, explica o que falta. */
test("/admin sem sessão vai para o login", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByRole("heading", { name: "Painel da bio" })).toBeVisible();
});

test("login mostra o formulário (painel ligado) ou explica o que falta (sem banco), nunca os dois", async ({ page }) => {
  await page.goto("/admin/login");
  const formulario = await page.getByLabel("Senha").count();
  const aviso = await page.getByText(/O painel ainda não está ligado/).count();
  expect(formulario + aviso).toBe(1);
});

test("senha errada não entra e mantém o e-mail digitado", async ({ page }) => {
  await page.goto("/admin/login");
  test.skip((await page.getByLabel("Senha").count()) === 0, "painel sem banco neste ambiente");
  await page.getByLabel("E-mail").fill("ninguem@exemplo.com");
  await page.getByLabel("Senha").fill("senha-que-nao-existe");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.locator(".adm-aviso-erro")).toHaveText("E-mail ou senha incorretos.");
  await expect(page.getByLabel("E-mail")).toHaveValue("ninguem@exemplo.com");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("/admin não é indexado e não usa o tema da bio", async ({ page }) => {
  await page.goto("/admin/login");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.locator("html")).not.toHaveAttribute("data-fundo", /.+/);
});
