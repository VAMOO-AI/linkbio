import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { MSG_BLOQUEIO, MSG_CODIGO_RUIM, MSG_ENVIO } from "../lib/admin/codigo";
import { CHAVE_FALSA, EMAIL_TESTE, SENHA_TESTE, URL_FALSA } from "./painel-ambiente";

test.describe.configure({ mode: "serial" });

const cabecalho = { apikey: CHAVE_FALSA };

async function limpar(request: APIRequestContext) {
  expect((await request.post(`${URL_FALSA}/__controle/limpar`, { headers: cabecalho })).status()).toBe(204);
}

async function codigoEnviado(request: APIRequestContext, email: string): Promise<string | null> {
  const resposta = await request.get(`${URL_FALSA}/__controle/codigo?email=${encodeURIComponent(email)}`, { headers: cabecalho });
  if (resposta.status() === 404) return null;
  expect(resposta.ok()).toBe(true);
  return ((await resposta.json()) as { codigo: string }).codigo;
}

async function pedir(page: Page, email: string) {
  await page.getByLabel("E-mail").fill(email);
  // A frase de sucesso é a mesma nas duas vezes: sem esperar o POST, a segunda leitura
  // passa na frase da primeira e o código ainda não chegou na caixa.
  const concluido = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/admin/login"));
  await page.getByRole("button", { name: "Receber código no e-mail" }).click();
  await concluido;
}

function aviso(page: Page) {
  return page.locator(".adm-aviso-erro");
}

async function confirmar(page: Page) {
  const concluido = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/admin/login"));
  await page.getByRole("button", { name: "Confirmar código" }).click();
  await concluido;
}

test.beforeEach(async ({ request }) => {
  await limpar(request);
});

test("código certo entra e o mesmo código não entra de novo", async ({ page, request }) => {
  await page.goto("/admin/login");
  await pedir(page, EMAIL_TESTE);
  await expect(page.getByRole("status")).toHaveText(MSG_ENVIO);
  const codigo = await codigoEnviado(request, EMAIL_TESTE);
  expect(codigo).toMatch(/^\d{6}$/);

  await page.getByLabel("Código").fill(codigo!);
  await confirmar(page);
  await expect(page.getByRole("navigation", { name: "Seções" })).toBeVisible();

  await page.context().clearCookies();
  await page.goto("/admin/login");
  await page.getByLabel("E-mail").fill(EMAIL_TESTE);
  await page.getByLabel("Código").fill(codigo!);
  await confirmar(page);
  await expect(aviso(page)).toHaveText(MSG_CODIGO_RUIM);
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("e-mail desconhecido recebe a mesma frase e não ganha código", async ({ page, request }) => {
  await page.goto("/admin/login");
  await pedir(page, "ninguem@exemplo.com");
  await expect(page.getByRole("status")).toHaveText(MSG_ENVIO);
  expect(await codigoEnviado(request, "ninguem@exemplo.com")).toBeNull();

  await pedir(page, EMAIL_TESTE);
  await expect(page.getByRole("status")).toHaveText(MSG_ENVIO);
  expect(await codigoEnviado(request, EMAIL_TESTE)).toMatch(/^\d{6}$/);
});

test("código errado cinco vezes bloqueia a sexta", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("E-mail").fill(EMAIL_TESTE);
  for (let i = 0; i < 5; i++) {
    await page.getByLabel("Código").fill("000000");
    await confirmar(page);
    await expect(aviso(page)).toHaveText(MSG_CODIGO_RUIM);
  }
  await page.getByLabel("Código").fill("000000");
  await confirmar(page);
  await expect(aviso(page)).toHaveText(MSG_BLOQUEIO);
});

test("a senha antiga continua entrando", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("E-mail").fill(EMAIL_TESTE);
  await page.getByLabel("Senha").fill(SENHA_TESTE);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Seções" })).toBeVisible();
});
