/**
 * A prévia segue a edição (computador, 1280 px): abrir um bloco, uma oferta ou um produto, ou pôr o
 * cursor num campo deles, rola a prévia até aquilo e realça por um instante.
 *
 * Contra o Supabase falso, como o `painel.spec.ts`, mas sem gravar nada (só abre e foca): pode rodar
 * ao mesmo tempo que ele. Só no chromium (ver playwright.config.ts). Os alvos vêm do
 * `linkbio.config.ts`; numa bio sem cupom, cards ou vitrine, o caso correspondente é pulado.
 */

import { expect, test, type Frame, type Locator, type Page } from "@playwright/test";
import { EMAIL_TESTE, SENHA_TESTE } from "./painel-ambiente";
import arquivo from "../linkbio.config";

type Oferta = { id: string; title: string };
type Produto = { id: string; title: string };
type Bloco = { type: string; enabled?: boolean; items?: string[] };
const blocos = arquivo.blocks as unknown as Bloco[];
const ofertas = (arquivo.offers ?? []) as Oferta[];
const catalogo = (arquivo.catalog ?? []) as Produto[];

async function entrar(page: Page) {
  await page.setViewportSize({ width: 1280, height: 800 });
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

/** O quadro da prévia, já desenhando (o editor só manda recados depois do "pronta"). */
async function quadroPronto(page: Page): Promise<Frame> {
  await expect(page.locator(".a-previa iframe.p-visivel")).toBeVisible({ timeout: 20000 });
  const quadro = page.frames().find((f) => f.url().includes("/admin-previa"))!;
  await expect(quadro.locator("main.pagina > *").first()).toBeVisible();
  return quadro;
}

const noTopo = (quadro: Frame) => quadro.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
const rolagem = (quadro: Frame) => quadro.evaluate(() => window.scrollY);

/** Inteiro (ou ao menos o começo, se for maior que a tela) dentro da janela da prévia. */
const naTela = (alvo: Locator) =>
  alvo.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.top >= -1 && r.top < innerHeight && (r.bottom <= innerHeight + 1 || r.height > innerHeight) && r.left >= -1 && r.right <= innerWidth + 1;
  });

async function esperaNaTela(alvo: Locator) {
  await expect.poll(() => naTela(alvo), { timeout: 5000 }).toBe(true);
}

/** O realce aparece sobre o elemento (não em outro lugar da página). */
async function esperaRealce(quadro: Frame, alvo: Locator) {
  const realce = quadro.locator(".previa-realce");
  await expect
    .poll(
      async () => {
        if ((await realce.count()) !== 1) return "sem realce";
        const [a, b] = [await realce.boundingBox(), await alvo.boundingBox()];
        if (!a || !b) return "sem caixa";
        const dy = Math.abs(a.y + a.height / 2 - (b.y + b.height / 2));
        const dx = Math.abs(a.x + a.width / 2 - (b.x + b.width / 2));
        return dx < 12 && dy < 12 ? "sobre o alvo" : `deslocado ${Math.round(dx)} x ${Math.round(dy)}`;
      },
      { timeout: 3000 },
    )
    .toBe("sobre o alvo");
}

function vigiarConsole(page: Page) {
  const erros: string[] = [];
  page.on("console", (m) => m.type() === "error" && erros.push(m.text()));
  page.on("pageerror", (e) => erros.push(String(e)));
  return () => expect(erros, `erros de console:\n${erros.join("\n")}`).toEqual([]);
}

const linhaDoBloco = (page: Page, nome: string) =>
  page.locator(".s-lista > li").filter({ has: page.locator(".s-bloco-nome strong", { hasText: new RegExp(`^${nome}$`) }) }).first();

test("abrir um bloco do meio da lista rola a prévia até ele e realça", async ({ page }) => {
  test.skip(!blocos.some((b) => b.type === "coupon" && b.enabled !== false), "config sem cupom ligado");
  const semErro = vigiarConsole(page);
  await entrar(page);
  const quadro = await quadroPronto(page);
  await noTopo(quadro);
  const cupom = quadro.locator(".bloco-cupom").first();
  expect(await naTela(cupom), "o cupom começa fora da tela da prévia").toBe(false);

  const linha = linhaDoBloco(page, "Cupom");
  await linha.locator(".s-bloco-nome").click();
  await expect(linha).toHaveClass(/s-aberto/);
  await esperaNaTela(cupom);
  expect(await rolagem(quadro)).toBeGreaterThan(0);
  await esperaRealce(quadro, cupom);
  // O realce é passageiro e não fica na página.
  await expect(quadro.locator(".previa-realce")).toHaveCount(0, { timeout: 4000 });

  // Fechar não mexe na prévia; pôr o cursor num campo do bloco, depois de rolar para longe, traz de volta.
  await noTopo(quadro);
  await linha.getByRole("textbox").first().focus();
  await esperaNaTela(cupom);
  // O cursor continua no campo: a prévia não rouba o foco.
  expect(await page.evaluate(() => document.activeElement?.closest(".s-lista > li")?.querySelector(".s-bloco-nome strong")?.textContent)).toBe("Cupom");
  // Outro campo do mesmo bloco, com ele já na tela: a prévia fica parada e não pisca a cada Tab.
  await expect(quadro.locator(".previa-realce")).toHaveCount(0, { timeout: 4000 });
  const y = await rolagem(quadro);
  await linha.getByRole("textbox").nth(1).focus();
  await page.waitForTimeout(400);
  await expect(quadro.locator(".previa-realce")).toHaveCount(0);
  expect(await rolagem(quadro)).toBe(y);
  semErro();
});

test("oferta: pela seção Ofertas e pelo bloco de cards, a prévia vai ao card daquela oferta", async ({ page }) => {
  const cards = blocos.find((b) => b.type === "cards" && b.enabled !== false);
  const id = cards?.items?.[1] ?? cards?.items?.[0];
  const oferta = ofertas.find((o) => o.id === id);
  test.skip(!oferta, "config sem bloco de cards com oferta");
  const semErro = vigiarConsole(page);
  await entrar(page);
  const quadro = await quadroPronto(page);
  const card = quadro.locator(".bloco-cards .card-oferta").filter({ has: quadro.locator("h2", { hasText: oferta!.title }) }).first();

  // Seção Ofertas: abrir o item (ou, se já vier aberto, pôr o cursor no título).
  await noTopo(quadro);
  expect(await naTela(card), "o card começa fora da tela da prévia").toBe(false);
  await abrirSecao(page, "Ofertas");
  const item = page.locator(".a-conteudo .c-item").filter({ has: page.locator(".c-item-nome", { hasText: oferta!.title }) }).first();
  const titulo = item.locator(".c-item-titulo");
  if ((await titulo.getAttribute("aria-expanded")) === "false") await titulo.click();
  else await item.getByRole("textbox").first().focus();
  await esperaNaTela(card);
  await esperaRealce(quadro, card);

  // Dentro do bloco de cards: abrir o card daquela oferta.
  await abrirSecao(page, "Blocos");
  await noTopo(quadro);
  await linhaDoBloco(page, "Ofertas").locator(".s-bloco-nome").click();
  const noBloco = page.locator(".k-cards .c-item").filter({ hasText: oferta!.title }).first();
  await noTopo(quadro);
  await noBloco.locator(".c-item-titulo").click();
  await esperaNaTela(card);
  await esperaRealce(quadro, card);

  // Cursor num campo da oferta: fica no campo.
  const campo = noBloco.getByRole("textbox").first();
  await campo.focus();
  await expect(campo).toBeFocused();
  semErro();
});

test("Perfil, Vitrine e Contato: a prévia vai ao topo, ao produto e ao botão do WhatsApp", async ({ page }) => {
  const semErro = vigiarConsole(page);
  await entrar(page);
  const quadro = await quadroPronto(page);

  // Perfil: com a prévia rolada para baixo, pôr o cursor no nome volta ao topo.
  await quadro.evaluate(() => window.scrollTo({ top: 1500, behavior: "instant" }));
  await abrirSecao(page, "Perfil");
  await page.locator(".a-conteudo").getByLabel("Nome").first().focus();
  await expect.poll(() => rolagem(quadro)).toBeLessThan(40);
  await esperaRealce(quadro, quadro.locator(".bloco-perfil").first());

  // Vitrine: abrir (ou focar) o último produto mostrado no bloco.
  const vitrine = blocos.find((b) => b.type === "products" && b.enabled !== false);
  const produtos = vitrine ? (vitrine.items ? catalogo.filter((p) => vitrine.items!.includes(p.id)) : catalogo) : [];
  const produto = produtos.at(-1);
  if (produto) {
    await noTopo(quadro);
    const alvo = quadro.locator(".produtos-lista > li").filter({ hasText: produto.title }).first();
    await abrirSecao(page, "Vitrine");
    const item = page.locator(".a-conteudo .c-item").filter({ has: page.locator(".c-item-nome", { hasText: produto.title }) }).first();
    const titulo = item.locator(".c-item-titulo");
    if ((await titulo.getAttribute("aria-expanded")) === "false") await titulo.click();
    else await item.getByRole("textbox").first().focus();
    await esperaNaTela(alvo);
    await esperaRealce(quadro, alvo);
  }

  // Contato: o WhatsApp leva ao primeiro botão de WhatsApp da bio.
  await quadro.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await abrirSecao(page, "Contato e site");
  await page.locator(".a-conteudo").getByLabel(/WhatsApp/).first().focus();
  const botao = quadro.locator('main a[href^="https://wa.me/"]').first();
  await esperaNaTela(botao);
  await esperaRealce(quadro, botao);
  semErro();
});

test("com movimento reduzido, a prévia salta sem animar", async ({ page }) => {
  test.skip(!blocos.some((b) => b.type === "coupon" && b.enabled !== false), "config sem cupom ligado");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await entrar(page);
  const quadro = await quadroPronto(page);
  await noTopo(quadro);
  await linhaDoBloco(page, "Cupom").locator(".s-bloco-nome").click();
  const cupom = quadro.locator(".bloco-cupom").first();
  await esperaNaTela(cupom);
  await expect(quadro.locator(".previa-realce")).toHaveCount(1);
  expect(await quadro.locator(".previa-realce").evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
});
