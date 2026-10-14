import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { CHAVE_FALSA, EMAIL_TESTE, SENHA_TESTE, URL_APP, URL_FALSA } from "./painel-ambiente";

/**
 * Contagem de cliques contra o Supabase falso. A bio de exemplo sai com a contagem desligada:
 * o HTML continua com o link direto. Ligar e publicar (pelo painel) faz o atalho /r/ contar.
 */

// A publicação da contagem muda a bio no ar. Na mesma execução estes casos vão em ordem:
// primeiro o HTML direto, depois o atalho sem contar, e só então ligar e publicar.
test.describe.configure({ mode: "serial" });

const cabecalho = { apikey: CHAVE_FALSA };
const NAVEGADOR = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";

type Estado = { cliques: { dia: string; alvo: string; origem: string; total: number }[] };

async function limpar(request: APIRequestContext) {
  expect((await request.post(`${URL_FALSA}/__controle/limpar`, { headers: cabecalho })).status()).toBe(204);
}

async function estado(request: APIRequestContext): Promise<Estado> {
  const resposta = await request.get(`${URL_FALSA}/__controle/estado`, { headers: cabecalho });
  expect(resposta.ok()).toBe(true);
  const corpo = (await resposta.json()) as Estado;
  expect(Array.isArray(corpo.cliques)).toBe(true);
  return corpo;
}

const total = (e: Estado) => e.cliques.reduce((s, l) => s + Number(l.total), 0);

async function entrar(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("E-mail").fill(EMAIL_TESTE);
  await page.getByLabel("Senha").fill(SENHA_TESTE);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("navigation", { name: "Seções" })).toBeVisible();
}

test.beforeEach(async ({ request }) => {
  await limpar(request);
});

test("com a contagem desligada, os botões continuam indo direto", async ({ page }) => {
  await page.goto("/");
  const cta = page.getByRole("link", { name: "Falar no WhatsApp" });
  await expect(cta).toHaveAttribute("href", "https://wa.me/5511987654321?text=Oi!%20Vim%20pela%20sua%20bio.");
  const hrefs = await page.locator("a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
  expect(hrefs.some((h) => h.startsWith("/r/"))).toBe(false);
});

test("atalho desconhecido não manda para outro site; o da config redireciona sem contar", async ({ request }) => {
  const ruim = await request.get("/r/https%3A%2F%2Fevil.example", { maxRedirects: 0 });
  expect(ruim.status()).toBe(404);
  expect(ruim.headers().location ?? "").not.toContain("evil.example");

  const aberto = await request.get("/r/oferta.mentoria.url?url=https://evil.example", { maxRedirects: 0 });
  expect(aberto.status()).toBe(302);
  expect(aberto.headers().location).toBe("https://exemplo.com/mentoria");

  const cta = await request.get("/r/cta.falar-whatsapp", {
    maxRedirects: 0,
    headers: { referer: `${URL_APP}/?src=stories`, "user-agent": NAVEGADOR },
  });
  expect(cta.status()).toBe(302);
  expect(cta.headers().location).toContain("wa.me/5511987654321");
  expect(total(await estado(request))).toBe(0);
});

test("Resultados explica como ligar e, depois de publicar, mostra o clique", async ({ page, request }) => {
  await entrar(page);
  await page.getByRole("navigation", { name: "Seções" }).getByRole("button", { name: "Resultados" }).click();
  await expect(page.locator(".a-cabecalho h1")).toHaveText("Resultados");
  const painel = page.locator(".a-conteudo");
  await expect(painel).toContainText("A contagem está desligada. Ligue Contar cliques e toque em Publicar");
  await expect(painel).toContainText("?src=bio");
  await expect(painel).toContainText("?src=stories");
  await expect(painel).toContainText("?src=reels");

  const sw = page.getByRole("switch", { name: "Contar cliques" });
  await sw.click();
  await expect(sw).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Publicar" }).click();
  await expect(page.locator(".a-estado")).toHaveText("Tudo publicado");

  const clique = await request.get("/r/cta.falar-whatsapp", {
    maxRedirects: 0,
    headers: { referer: `${URL_APP}/?src=stories`, "user-agent": NAVEGADOR },
  });
  expect(clique.status()).toBe(302);
  expect(clique.headers().location).toContain("wa.me/5511987654321");
  await expect.poll(async () => total(await estado(request))).toBe(1);

  const robo = await request.get("/r/cta.falar-whatsapp", {
    maxRedirects: 0,
    headers: { referer: `${URL_APP}/?src=bio`, "user-agent": "facebookexternalhit/1.1" },
  });
  expect(robo.status()).toBe(302);
  expect(total(await estado(request))).toBe(1);

  await page.reload();
  await page.getByRole("navigation", { name: "Seções" }).getByRole("button", { name: "Resultados" }).click();
  await expect(page.locator(".r-tabela").first()).toContainText("Falar no WhatsApp");
  await expect(page.locator(".r-tabela").nth(1)).toContainText("Stories");
  await expect(page.getByRole("switch", { name: "Contar cliques" })).toHaveAttribute("aria-checked", "true");
});
