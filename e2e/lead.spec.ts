/**
 * Bloco lead contra o Supabase falso: o formulário envia com e sem JavaScript,
 * o painel lista o contato e a planilha só baixa com a sessão.
 *
 * Publica uma bio diferente do arquivo e, no fim, volta ao arquivo original
 * (senão o "/" dos outros testes deixa de ser o linkbio.config.ts).
 */

import { expect, test, type Locator, type Page } from "@playwright/test";
import { ESPERA_MINIMA_MS } from "../lib/lead";
import { EMAIL_TESTE, SENHA_TESTE } from "./painel-ambiente";

test.describe.configure({ mode: "serial" });

async function entrar(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("E-mail").fill(EMAIL_TESTE);
  await page.getByLabel("Senha").fill(SENHA_TESTE);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("navigation", { name: "Seções" })).toBeVisible();
}

async function abrirSecao(page: Page, nome: string) {
  await page.getByRole("navigation", { name: "Seções" }).getByRole("button", { name: nome }).click();
  await expect(page.locator(".a-cabecalho h1")).toHaveText(nome);
}

async function adicionarBloco(page: Page, nome: string) {
  await page.getByRole("button", { name: "Adicionar bloco" }).click();
  const dialogo = page.getByRole("dialog", { name: "Escolher bloco" });
  await expect(dialogo).toBeVisible();
  await dialogo.locator(".s-opcao").filter({ has: page.getByText(nome, { exact: true }) }).click();
  await expect(dialogo).toBeHidden();
}

async function clicarERecarregar(page: Page, alvo: Locator) {
  const recarregou = page.waitForEvent("framenavigated", (quadro) => quadro === page.mainFrame());
  await alvo.click();
  await recarregou;
}

async function enviarFormulario(page: Page, semJs = false) {
  await page.goto("/");
  const form = page.locator("form[action='/api/lead']");
  await expect(form).toBeVisible();
  await form.getByLabel("Nome").fill("Ana Teste");
  await form.getByLabel("WhatsApp").fill("(11) 98765-4321");
  // Sem JavaScript o Playwright não recebe o quadro de animação e a caixa nunca "estabiliza".
  await form.getByRole("checkbox").check({ force: semJs });
  // O cookie da visita é a hora do anti-spam. Esperar aqui é o tempo mínimo de preenchimento.
  await page.waitForTimeout(ESPERA_MINIMA_MS + 500);
  await form.getByRole("button", { name: "Quero receber" }).click({ force: semJs });
  await expect(page).toHaveURL(/\/contato\/enviado\?bloco=contato/);
  await expect(page.getByRole("heading", { name: "Pronto! Em instantes você recebe." })).toBeVisible();
}

test("a planilha sem sessão responde que é preciso entrar", async ({ request }) => {
  const resposta = await request.get("/admin/contatos");
  expect(resposta.status()).toBe(401);
});

test("publicar o bloco Contato mostra o formulário na bio", async ({ page }) => {
  await entrar(page);
  await abrirSecao(page, "Blocos");
  await adicionarBloco(page, "Contato");
  await expect(page.locator(".a-estado")).toHaveText(/Rascunho salvo/, { timeout: 15_000 });
  await page.getByRole("button", { name: "Publicar" }).click();
  await expect(page.locator(".a-estado")).toHaveText("Tudo publicado");
  await page.goto("/");
  await expect(page.locator("form[action='/api/lead']")).toBeVisible();
  await expect(page.getByRole("button", { name: "Quero receber" })).toBeVisible();
});

test("com JavaScript o envio chega na mensagem de sucesso", async ({ page }) => {
  await enviarFormulario(page);
  const estouro = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(estouro, "a tela de sucesso estoura a largura").toBeLessThanOrEqual(1);
});

test.describe("sem JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("o formulário envia do mesmo jeito", async ({ page }) => {
    await enviarFormulario(page, true);
  });
});

test("a seção Contatos e a planilha mostram quem enviou", async ({ page }) => {
  await entrar(page);
  await abrirSecao(page, "Contatos");
  await expect(page.locator(".a-contatos")).toContainText("Ana Teste");
  await expect(page.locator(".a-contatos")).toContainText("11987654321");
  const csv = await page.request.get("/admin/contatos");
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"] ?? "").toContain("text/csv");
  const texto = await csv.text();
  expect(texto.charCodeAt(0)).toBe(0xfeff);
  expect(texto).toContain("nome,whatsapp,email,bloco,quando");
  expect(texto).toContain("Ana Teste");
  expect(texto).toContain("11987654321");
  expect(texto).toContain("contato");
});

test.afterAll(async ({ browser }) => {
  const contexto = await browser.newContext({ javaScriptEnabled: true });
  const page = await contexto.newPage();
  try {
    await entrar(page);
    await abrirSecao(page, "Versões");
    const arquivo = page.locator(".s-versao-arquivo");
    if ((await arquivo.count()) === 0) return;
    await arquivo.getByRole("button", { name: "Restaurar" }).click();
    await clicarERecarregar(page, arquivo.getByRole("button", { name: "Voltar ao arquivo" }));
    await expect(page.locator(".a-estado")).toHaveText("Tudo publicado");
    await page.goto("/");
    await expect(page.locator("form[action='/api/lead']")).toHaveCount(0);
  } finally {
    await contexto.close();
  }
});
