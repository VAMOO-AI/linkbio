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

type Estado = {
  cliques: { dia: string; alvo: string; origem: string; total: number }[];
  visitas: { dia: string; origem: string; total: number }[];
  engajamento: { dia: string; tipo: string; chave: string; origem: string; total: number }[];
};

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

test("com a contagem no ar, a visita conta uma vez por sessão e por origem, e Resultados mostra a taxa", async ({ page, request }) => {
  await entrar(page);
  await page.getByRole("navigation", { name: "Seções" }).getByRole("button", { name: "Resultados" }).click();
  const sw = page.getByRole("switch", { name: "Contar cliques" });
  if ((await sw.getAttribute("aria-checked")) !== "true") await sw.click();
  await page.getByRole("button", { name: "Publicar" }).click();
  await expect(page.locator(".a-estado")).toHaveText("Tudo publicado");

  await page.goto("/?src=stories");
  await expect.poll(async () => (await estado(request)).visitas).toEqual([expect.objectContaining({ origem: "stories", total: 1 })]);
  await page.reload();
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  // Mesma sessão: a origem guardada é stories e já contou.
  expect((await estado(request)).visitas).toEqual([expect.objectContaining({ origem: "stories", total: 1 })]);

  const robo = await request.post("/api/visita", { data: { origem: "bio" }, headers: { "user-agent": "facebookexternalhit/1.1" } });
  expect(robo.status()).toBe(204);
  const ruim = await request.post("/api/visita", { data: { origem: "<script>" }, headers: { "user-agent": NAVEGADOR } });
  expect(ruim.status()).toBe(204);
  const v = (await estado(request)).visitas;
  expect(v.find((l) => l.origem === "bio")).toBeUndefined();
  expect(v.find((l) => l.origem === "direto")?.total).toBe(1);

  const clique = await request.get("/r/cta.falar-whatsapp", {
    maxRedirects: 0,
    headers: { referer: `${URL_APP}/?src=stories`, "user-agent": NAVEGADOR },
  });
  expect(clique.status()).toBe(302);

  await page.goto("/admin");
  await page.getByRole("navigation", { name: "Seções" }).getByRole("button", { name: "Resultados" }).click();
  const origens = page.locator(".r-tabela").nth(1);
  await expect(origens).toContainText("Toques por visita");
  await expect(origens.locator("tr", { hasText: "Stories" })).toContainText("100%");
});

test("rolagem e toque sem link: cada seção conta uma vez por sessão, e Resultados mostra até onde rolam", async ({ page, request }) => {
  await entrar(page);
  await page.getByRole("navigation", { name: "Seções" }).getByRole("button", { name: "Resultados" }).click();
  const sw = page.getByRole("switch", { name: "Contar cliques" });
  if ((await sw.getAttribute("aria-checked")) !== "true") await sw.click();
  await page.getByRole("button", { name: "Publicar" }).click();
  await expect(page.locator(".a-estado")).toHaveText("Tudo publicado");

  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto("/?src=reels");
  const secoes = await page.locator("[data-secao]").evaluateAll((els) => els.map((e) => e.getAttribute("data-secao")));
  expect(secoes.length).toBeGreaterThan(3);
  // O invólucro não muda o layout: não tem caixa.
  expect(await page.locator("[data-secao]").first().evaluate((e) => getComputedStyle(e).display)).toBe("contents");

  const vistas = () => estado(request).then((e) => e.engajamento.filter((l) => l.tipo === "secao"));
  await expect.poll(async () => (await vistas()).map((l) => l.chave)).toContain(secoes[0]);
  const ultima = secoes[secoes.length - 1]!;
  expect((await vistas()).map((l) => l.chave)).not.toContain(ultima);

  // Rola até o fim, aos poucos, como uma pessoa.
  for (let i = 0; i < 30; i++) {
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(50);
  }
  await expect.poll(async () => (await vistas()).map((l) => l.chave), { timeout: 10_000 }).toContain(ultima);
  expect((await vistas()).every((l) => l.origem === "reels" && l.total === 1)).toBe(true);

  // Toque num texto sem link vira "toque sem link" daquela seção; o mesmo toque de novo não soma.
  const texto = page.locator(".perfil-nome").first();
  await texto.scrollIntoViewIfNeeded();
  await texto.click();
  await texto.click();
  await expect
    .poll(async () => (await estado(request)).engajamento.filter((l) => l.tipo === "toque_sem_link"))
    .toEqual([expect.objectContaining({ chave: secoes[0], origem: "reels", total: 1 })]);

  // Mesma sessão: recarregar não conta as seções de novo.
  const antes = (await vistas()).length;
  await page.reload();
  await page.waitForTimeout(2500);
  expect((await vistas()).every((l) => l.total === 1)).toBe(true);
  expect((await vistas()).length).toBe(antes);

  // Chave inventada não entra; robô não conta.
  const ruim = await request.post("/api/engajamento", {
    data: { origem: "bio", secoes: ["inventada"], toques: [], rapida: false },
    headers: { "user-agent": NAVEGADOR },
  });
  expect(ruim.status()).toBe(204);
  const robo = await request.post("/api/engajamento", {
    data: { origem: "bio", secoes: [secoes[0]], rapida: true },
    headers: { "user-agent": "facebookexternalhit/1.1" },
  });
  expect(robo.status()).toBe(204);
  const rapida = await request.post("/api/engajamento", { data: { origem: "stories", rapida: true }, headers: { "user-agent": NAVEGADOR } });
  expect(rapida.status()).toBe(204);
  const e = (await estado(request)).engajamento;
  expect(e.find((l) => l.chave === "inventada" || l.origem === "bio")).toBeUndefined();
  expect(e.filter((l) => l.tipo === "saida_rapida")).toEqual([expect.objectContaining({ chave: "", origem: "stories", total: 1 })]);

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/admin");
  await page.getByRole("navigation", { name: "Seções" }).getByRole("button", { name: "Resultados" }).click();
  const painel = page.locator(".a-conteudo");
  await expect(painel.getByRole("heading", { name: "O que pede atenção" })).toBeVisible();
  await expect(painel).toContainText("Ainda são poucas visitas");
  await expect(painel.getByRole("heading", { name: "Até onde as pessoas rolam" })).toBeVisible();
  await expect(painel.locator(".r-rolagem li").first()).toContainText("Perfil");
  await expect(painel.locator(".r-rolagem li").first()).toContainText("100%");
  await expect(painel.locator(".r-rolagem")).toContainText("1 visita tocou fora de um link");
});

test("mapa de calor: Resultados pinta a prévia com a % de cada seção e os cliques do botão", async ({ page, request }) => {
  await entrar(page);
  await page.getByRole("navigation", { name: "Seções" }).getByRole("button", { name: "Resultados" }).click();
  const sw = page.getByRole("switch", { name: "Contar cliques" });
  if ((await sw.getAttribute("aria-checked")) !== "true") await sw.click();
  await page.getByRole("button", { name: "Publicar" }).click();
  await expect(page.locator(".a-estado")).toHaveText("Tudo publicado");

  // Duas visitas: as duas viram o perfil, só uma chegou no botão do WhatsApp (e tocou nele).
  const corpo = (secoes: string[]) => ({ data: { origem: "bio", secoes, toques: [], rapida: false }, headers: { "user-agent": NAVEGADOR } });
  for (let i = 0; i < 2; i++) expect((await request.post("/api/visita", { data: { origem: "bio" }, headers: { "user-agent": NAVEGADOR } })).status()).toBe(204);
  expect((await request.post("/api/engajamento", corpo(["profile-0", "falar-whatsapp"]))).status()).toBe(204);
  expect((await request.post("/api/engajamento", corpo(["profile-0"]))).status()).toBe(204);
  const clique = await request.get("/r/cta.falar-whatsapp", { maxRedirects: 0, headers: { referer: `${URL_APP}/?src=bio`, "user-agent": NAVEGADOR } });
  expect(clique.status()).toBe(302);

  await page.reload();
  await page.getByRole("navigation", { name: "Seções" }).getByRole("button", { name: "Resultados" }).click();
  await expect(page.locator(".r-rolagem")).toContainText("1 clique nos botões");
  // Celular (o viewport padrão do e2e): o botão de Resultados abre a prévia já com o mapa.
  await expect(page.locator(".a-previa")).not.toHaveClass(/a-previa-aberta/);
  await page.getByRole("button", { name: "Ver mapa de calor na prévia" }).click();
  await expect(page.locator(".a-previa")).toHaveClass(/a-previa-aberta/);

  const quadro = page.frameLocator('iframe[src="/admin-previa"]');
  const manchas = quadro.locator(".previa-calor");
  const quente = quadro.locator('.previa-calor[data-nivel="quente"]');
  await expect(quente).toHaveCount(1);
  await expect(quente).toContainText("100% chegam");
  await expect(quadro.locator('.previa-calor[data-nivel="morno"]')).toHaveText("50% chegam · 1 clique");
  // Onde ninguém chegou também ganha cor: é a parte que quase ninguém vê.
  await expect(quadro.locator('.previa-calor[data-nivel="frio"]').first()).toHaveText("0% chegam");
  const n = await manchas.count();
  expect(n).toBeGreaterThan(3);
  // A mancha fica por cima do bloco, sem receber o toque.
  expect(await quente.evaluate((e) => getComputedStyle(e).pointerEvents)).toBe("none");

  await page.getByRole("button", { name: "Esconder mapa de calor" }).click();
  await expect(manchas).toHaveCount(0);

  // Computador: a prévia já está ao lado; o botão só liga o mapa, sem abrir tela por cima.
  await page.getByRole("button", { name: "Fechar prévia" }).click();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole("button", { name: "Ver mapa de calor na prévia" }).click();
  await expect(page.locator(".a-previa")).not.toHaveClass(/a-previa-aberta/);
  await expect(manchas).toHaveCount(n);
  await expect(page.getByRole("button", { name: "Esconder mapa de calor" })).toHaveAttribute("aria-pressed", "true");});

test("saída rápida pelo script, animação preservada e cartões de alerta com amostra suficiente", async ({ page, request, browser }) => {
  await entrar(page);
  await page.getByRole("navigation", { name: "Seções" }).getByRole("button", { name: "Resultados" }).click();
  const sw = page.getByRole("switch", { name: "Contar cliques" });
  if ((await sw.getAttribute("aria-checked")) !== "true") await sw.click();
  await page.getByRole("button", { name: "Publicar" }).click();
  await expect(page.locator(".a-estado")).toHaveText("Tudo publicado");

  const esconder = (p: Page) =>
    p.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
  const saidas = () => estado(request).then((e) => e.engajamento.filter((l) => l.tipo === "saida_rapida"));

  // Some antes de 3 s sem tocar em nada: conta.
  const rapida = await browser.newPage();
  await rapida.goto("/?src=stories", { waitUntil: "domcontentloaded" });
  await esconder(rapida);
  await expect.poll(saidas).toEqual([expect.objectContaining({ origem: "stories", total: 1 })]);
  const perfil = (await rapida.locator("[data-secao]").first().getAttribute("data-secao"))!;
  // A animação de entrada continua no bloco, agora dentro da seção.
  expect(await rapida.locator(".pagina > .secao:nth-child(3) > *").first().evaluate((e) => getComputedStyle(e).animationName)).toBe("lb-sobe");
  await rapida.close();

  // Tocou num link antes de sair: não é saída rápida.
  const tocou = await browser.newPage();
  await tocou.goto("/?src=reels", { waitUntil: "domcontentloaded" });
  await tocou.evaluate(() => {
    const a = document.querySelector<HTMLElement>("main a");
    a?.addEventListener("click", (e) => e.preventDefault(), { once: true });
    a?.click();
  });
  await esconder(tocou);
  await tocou.waitForTimeout(1000);
  expect((await saidas()).find((l) => l.origem === "reels")).toBeUndefined();
  await tocou.close();

  // Amostra mínima: 30 visitas de stories, 5 toques sem link no perfil e mais 10 saídas rápidas.
  for (let i = 0; i < 30; i++) {
    await request.post("/api/visita", { data: { origem: "stories" }, headers: { "user-agent": NAVEGADOR } });
  }
  for (let i = 0; i < 10; i++) {
    await request.post("/api/engajamento", {
      data: { origem: "stories", toques: i < 5 ? [perfil] : [], rapida: true },
      headers: { "user-agent": NAVEGADOR },
    });
  }

  await page.goto("/admin");
  await page.getByRole("navigation", { name: "Seções" }).getByRole("button", { name: "Resultados" }).click();
  const alertas = page.locator(".r-alertas");
  await expect(alertas.locator('.r-alerta[data-nivel="ruim"]')).toContainText("Quem vem de Stories sai rápido");
  await expect(alertas.locator('.r-alerta[data-nivel="atencao"]')).toContainText("esperando abrir algo");
  await expect(page.locator(".a-conteudo")).not.toContainText("Ainda são poucas visitas");
  await page.setViewportSize({ width: 375, height: 812 });
  await alertas.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/resultados-alertas-375.png", fullPage: true });
});
