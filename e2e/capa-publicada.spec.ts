/**
 * Capa ao compartilhar publicada pelo painel: com foto e com capa própria (imagem, título e texto).
 * Confere que a capa e as meta tags mudam na hora em que o painel publica (a rota /capa.jpg é
 * estática e é refeita junto com a página).
 *
 * PUBLICA uma bio diferente do arquivo: roda no projeto "capa" (playwright.config.ts), depois de
 * todos os outros, e no fim volta ao arquivo original.
 */
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import arquivo from "../linkbio.config";
import { baixarCapa, conferirMetas, metasDaBio } from "./capa-comum";
import { CHAVE_FALSA, EMAIL_TESTE, SENHA_TESTE, URL_FALSA } from "./painel-ambiente";

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

async function voltarAoArquivo(page: Page, painel: string) {
  await page.goto(painel);
  await abrirSecao(page, "Versões");
  const doArquivo = page.locator(".s-versao-arquivo");
  await doArquivo.getByRole("button", { name: "Restaurar" }).click();
  const recarregou = page.waitForEvent("framenavigated", (quadro) => quadro === page.mainFrame());
  await doArquivo.getByRole("button", { name: "Voltar ao arquivo" }).click();
  await recarregou;
  await expect(page.locator(".a-estado")).toHaveText("Tudo publicado");
}

async function publicar(page: Page) {
  await expect(page.locator(".a-estado")).toHaveText(/Rascunho salvo/);
  await page.getByRole("button", { name: "Publicar" }).click();
  await expect(page.locator(".a-estado")).toHaveText("Tudo publicado");
}

test("com foto e com capa própria: a capa e as meta tags seguem o que o painel publica", async ({ page, request }) => {
  test.slow();
  expect((await request.post(`${URL_FALSA}/__controle/limpar`, { headers: { apikey: CHAVE_FALSA } })).status()).toBe(204);

  const antes = await metasDaBio(request);
  const semFoto = await baixarCapa(request, antes["og:image"]!);

  await entrar(page);
  const painel = page.url();
  const c = page.locator(".a-conteudo");

  // 1. Com foto: a capa troca as iniciais pela foto; a URL da imagem muda (o WhatsApp baixa de novo).
  await abrirSecao(page, "Perfil");
  await c.getByLabel("Foto").fill("/gallery-1.svg");
  await publicar(page);
  const comFoto = await metasDaBio(request);
  conferirMetas(comFoto);
  expect(comFoto["og:image"]).not.toBe(antes["og:image"]);
  const capaComFoto = await baixarCapa(request, comFoto["og:image"]!);
  expect(capaComFoto.equals(semFoto)).toBe(false);

  // 2. Capa própria, com título e texto próprios, na seção "Contato e site".
  await page.goto(painel);
  await abrirSecao(page, "Contato e site");
  await c.getByRole("button", { name: "Adicionar capa ao compartilhar" }).click();
  await expect(c).toContainText("Ideal 1200 x 630 (deitada). Aparece quando você manda o link no WhatsApp");
  await c.getByLabel("Imagem da capa").fill("/gallery-2.svg");
  await c.getByLabel("Título do link").fill("Mentoria com vagas abertas");
  await c.getByLabel("Texto do link").fill("Quatro semanas para montar sua rotina.");
  await publicar(page);
  const propria = await metasDaBio(request);
  conferirMetas(propria);
  expect(propria["og:title"]).toBe("Mentoria com vagas abertas");
  expect(propria["twitter:title"]).toBe("Mentoria com vagas abertas");
  expect(propria["og:description"]).toBe("Quatro semanas para montar sua rotina.");
  expect(propria["og:image:alt"]).toBe("Mentoria com vagas abertas");
  expect(propria["og:site_name"]).toBe(arquivo.profile.name);
  const capaPropria = await baixarCapa(request, propria["og:image"]!);
  expect(capaPropria.equals(capaComFoto)).toBe(false);

  // Deixa a bio no ar como o arquivo de novo (e a capa junto).
  await voltarAoArquivo(page, painel);
  const depois = await metasDaBio(request);
  expect(depois["og:image"]).toBe(antes["og:image"]);
  expect((await baixarCapa(request, depois["og:image"]!)).equals(semFoto)).toBe(true);
});

test("prévia do link no painel, capa de outro formato inteira e link com prévia nova", async ({ page, request, context }) => {
  test.slow();
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  expect((await request.post(`${URL_FALSA}/__controle/limpar`, { headers: { apikey: CHAVE_FALSA } })).status()).toBe(204);
  const antes = await metasDaBio(request);

  await entrar(page);
  const painel = page.url();
  const c = page.locator(".a-conteudo");
  await abrirSecao(page, "Contato e site");

  // Sem capa própria: o cartão mostra a capa automática, nome + @ e a bio, e o domínio.
  const cartao = c.getByTestId("cartao-do-link");
  await expect(c.getByRole("heading", { name: "Assim aparece no WhatsApp" })).toBeVisible();
  await expect(cartao.locator(".cz-titulo")).toHaveText(`${arquivo.profile.name} ${arquivo.profile.handle}`);
  await expect(cartao.locator(".cz-descricao")).toHaveText(arquivo.profile.bio);
  await expect(cartao.getByRole("img", { name: "Capa automática: foto, nome e bio" })).toHaveAttribute("src", /^data:image\/jpeg;base64,/);
  const automatica = await cartao.locator("img").getAttribute("src");

  // O link com prévia nova é o da capa que está no ar: o mesmo ?v= da og:image.
  const vNoAr = new URL(antes["og:image"]!).searchParams.get("v");
  const linkNovo = c.getByLabel("Endereço com prévia nova");
  await expect(linkNovo).toHaveValue(new RegExp(`/\\?v=${vNoAr}$`));
  await expect(c).toContainText("O WhatsApp guarda a prévia de cada link");
  await expect(c.getByRole("link", { name: "Depurador de Compartilhamento do Facebook" })).toHaveAttribute("href", /^https:\/\/developers\.facebook\.com\/tools\/debug\/\?q=/);
  await c.getByRole("button", { name: "Copiar link com prévia nova" }).click();
  await expect(c.getByRole("button", { name: "Link copiado" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(await linkNovo.inputValue());
  // A página responde ao link com o final novo, com as mesmas meta tags.
  const comV = await request.get(`/${new URL(await linkNovo.inputValue()).search}`);
  expect(comV.status()).toBe(200);
  expect(await comV.text()).toContain(`content="${antes["og:image"]!.replaceAll("&", "&amp;")}"`);

  // Título e texto mudam no cartão na hora (antes de salvar o rascunho).
  await c.getByRole("button", { name: "Adicionar capa ao compartilhar" }).click();
  await c.getByLabel("Título do link").fill("IA para o seu negócio");
  await expect(cartao.locator(".cz-titulo")).toHaveText("IA para o seu negócio");
  await c.getByLabel("Texto do link").fill("Do seu jeito.");
  await expect(cartao.locator(".cz-descricao")).toHaveText("Do seu jeito.");

  // Imagem 4:3 (400 x 300), longe da 1,91:1: o painel avisa que entra inteira, com fundo.
  await c.getByLabel("Imagem da capa").fill("/gallery-1.svg");
  await expect(c.getByTestId("aviso-formato")).toContainText("Sua imagem (400 x 300) é mais alta que o formato do WhatsApp");
  await expect(c.getByTestId("aviso-formato")).toContainText("1200 x 630");
  await expect(cartao.getByRole("img", { name: "Capa enviada, como vai aparecer" })).toBeVisible();
  expect(await cartao.locator("img").getAttribute("src")).not.toBe(automatica);
  await expect(c).toContainText("A capa acima tem mudanças ainda não publicadas");

  // Publicou: a página e o /capa.jpg mudam na hora, e o link com prévia nova acompanha.
  await publicar(page);
  const depois = await metasDaBio(request);
  conferirMetas(depois);
  expect(depois["og:title"]).toBe("IA para o seu negócio");
  expect(depois["og:description"]).toBe("Do seu jeito.");
  expect(depois["og:image"]).not.toBe(antes["og:image"]);
  const capa = await baixarCapa(request, depois["og:image"]!);
  // Encaixada inteira: o miolo da capa (840 x 630) é a imagem toda, sem corte. O recorte antigo
  // ampliava para 1200 x 900 e cortava em cima e embaixo, e o miolo ficava bem diferente.
  const miolo = await sharp(capa).extract({ left: 180, top: 0, width: 840, height: 630 }).removeAlpha().raw().toBuffer();
  const inteira = await sharp("public/gallery-1.svg", { density: 300 }).resize(840, 630).flatten({ background: "#ffffff" }).raw().toBuffer();
  let diferenca = 0;
  for (let i = 0; i < miolo.length; i++) diferenca += Math.abs(miolo[i]! - inteira[i]!);
  expect(diferenca / miolo.length).toBeLessThan(8);
  const vNovo = new URL(depois["og:image"]!).searchParams.get("v");
  await expect(linkNovo).toHaveValue(new RegExp(`/\\?v=${vNovo}$`));
  await expect(c).not.toContainText("A capa acima tem mudanças ainda não publicadas");
  // O link mudou: o "Link copiado" de antes não vale para ele.
  await expect(c.getByRole("button", { name: "Copiar link com prévia nova" })).toBeVisible();

  await voltarAoArquivo(page, painel);
  expect((await metasDaBio(request))["og:image"]).toBe(antes["og:image"]);
});
