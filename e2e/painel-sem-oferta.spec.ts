/**
 * Bio sem oferta, ponta a ponta: apagar todas as ofertas no painel, publicar, a bio no ar
 * desenha sem erro e sem estourar a largura, e depois criar a primeira oferta de novo.
 *
 * Este é o único teste que PUBLICA uma bio visivelmente diferente do arquivo. Por isso roda num
 * projeto próprio (playwright.config.ts: "sem-oferta"), depois de todos os outros: os testes da bio
 * pública leem "/" e esperam o linkbio.config.ts. No fim ele volta ao arquivo original.
 */

import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { CHAVE_FALSA, EMAIL_TESTE, SENHA_TESTE, URL_FALSA } from "./painel-ambiente";

const cabecalho = { apikey: CHAVE_FALSA };

type Versao = { id: number; config: { offers?: unknown[]; blocks: { type: string; items?: string[] }[] } };

async function versoes(request: APIRequestContext): Promise<Versao[]> {
  const r = await request.get(`${URL_FALSA}/__controle/estado`, { headers: cabecalho });
  expect(r.ok()).toBe(true);
  return ((await r.json()) as { versoes: Versao[] }).versoes.sort((a, b) => b.id - a.id);
}

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

async function apagarItem(item: Locator) {
  await item.locator(".c-item-topo").first().getByRole("button", { name: "Remover", exact: true }).click();
  await item.getByRole("alertdialog", { name: "Confirmar exclusão" }).getByRole("button", { name: "Apagar" }).click();
}

async function publicar(page: Page) {
  await expect(page.locator(".a-estado")).toHaveText(/Rascunho salvo/);
  await page.getByRole("button", { name: "Publicar" }).click();
  await expect(page.locator(".a-estado")).toHaveText("Tudo publicado");
}

/** A bio no ar, no celular: sem erro de console e sem rolagem para o lado. */
async function bioNoAr(page: Page) {
  const erros: string[] = [];
  page.on("console", (m) => m.type() === "error" && erros.push(m.text()));
  page.on("pageerror", (e) => erros.push(String(e)));
  await page.goto("/");
  await expect(page.locator("main, body").first()).toBeVisible();
  const estouro = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(estouro, "a bio estoura a largura da tela").toBeLessThanOrEqual(0);
  expect(erros, `erros de console na bio:\n${erros.join("\n")}`).toEqual([]);
}

test("bio sem oferta: apaga todas, publica, a bio no ar funciona e a primeira oferta volta depois", async ({ page, request }) => {
  test.slow();
  expect((await request.post(`${URL_FALSA}/__controle/limpar`, { headers: cabecalho })).status()).toBe(204);
  await entrar(page);
  const c = page.locator(".a-conteudo");

  // Apaga todas as ofertas.
  await abrirSecao(page, "Ofertas");
  const ofertas = c.locator(".c-item");
  while ((await ofertas.count()) > 0) await apagarItem(ofertas.first());
  await expect(c.locator(".a-vazio")).toHaveText(/Nenhuma oferta ainda: crie uma aqui/);

  // O que sobra é escolha da pessoa: respostas da 1ª pergunta do concierge que levavam a uma oferta
  // passam a levar para a conversa no WhatsApp.
  await abrirSecao(page, "Blocos");
  const concierge = page.locator(".s-bloco-nome").filter({ has: page.locator("strong", { hasText: /^Concierge$/ }) });
  if (await concierge.count()) {
    await concierge.first().click();
    await expect(page.locator(".k-conc")).toContainText("Nenhuma oferta ainda: cada resposta leva para uma conversa no WhatsApp");
    for (const seletor of await page.locator(".k-passo").first().getByRole("combobox", { name: "Leva para" }).all()) {
      await seletor.selectOption({ label: "Conversa no WhatsApp (sem oferta)" });
    }
  }
  // O bloco de cards fica sem card e explica que não aparece na página.
  const cards = page.locator(".s-bloco-nome").filter({ has: page.locator("strong", { hasText: /^Ofertas$/ }) });
  if (await cards.count()) {
    await cards.first().click();
    await expect(page.locator(".k-cards .a-vazio")).toContainText("Sem card, o bloco não aparece na página.");
  }
  await expect(page.locator(".a-problemas")).toHaveCount(0);
  await publicar(page);
  const semOferta = (await versoes(request))[0]!;
  expect(semOferta.config.offers ?? []).toEqual([]);

  const painel = page.url();
  await bioNoAr(page);
  await expect(page.locator(".bloco-cards")).toHaveCount(0);

  // A primeira oferta de novo, e ela entra nos cards.
  await page.goto(painel);
  await abrirSecao(page, "Ofertas");
  await page.getByRole("button", { name: "Adicionar oferta" }).click();
  const nova = c.locator(".c-item").last();
  await nova.getByRole("textbox", { name: /^Título\s*(obrigatório)?$/ }).fill("Primeira oferta");
  await nova.getByRole("textbox", { name: /^Descrição/ }).fill("Criada depois de a bio ficar sem nenhuma.");
  await expect(c.locator(".a-vazio")).toHaveCount(0);
  await abrirSecao(page, "Blocos");
  if (!(await cards.count())) {
    await page.getByRole("button", { name: "Adicionar bloco" }).click();
    await page.getByRole("dialog", { name: "Escolher bloco" }).locator(".s-opcao").filter({ has: page.getByText("Ofertas", { exact: true }) }).click();
  } else {
    await cards.first().click();
  }
  await page.locator(".k-cards-mais").getByRole("button", { name: "Primeira oferta" }).click();
  await publicar(page);
  const comOferta = (await versoes(request))[0]!;
  expect(comOferta.config.offers).toHaveLength(1);
  expect(comOferta.config.blocks.find((b) => b.type === "cards")!.items).toHaveLength(1);

  await bioNoAr(page);
  await expect(page.locator(".bloco-cards")).toContainText("Primeira oferta");

  // Deixa a bio no ar como o arquivo de novo (e o cache da página junto).
  await page.goto(painel);
  await abrirSecao(page, "Versões");
  const doArquivo = page.locator(".s-versao-arquivo");
  await doArquivo.getByRole("button", { name: "Restaurar" }).click();
  const recarregou = page.waitForEvent("framenavigated", (quadro) => quadro === page.mainFrame());
  await doArquivo.getByRole("button", { name: "Voltar ao arquivo" }).click();
  await recarregou;
  await expect(page.locator(".a-estado")).toHaveText("Tudo publicado");
});
