/**
 * O painel inteiro, botão por botão, contra o Supabase falso (`e2e/painel-servidor.ts`): cada seção,
 * os tipos de bloco, imagem, publicar, descartar, restaurar e sair.
 *
 * O que se afirma aqui é o que a pessoa vê, mais o que chegou ao banco: os dois lados, porque um
 * painel que mostra "salvo" sem gravar passaria só com o primeiro.
 *
 * A config varia entre os repos (o template tem produtos na vitrine, a bio de um cliente pode não ter), então nada
 * aqui depende do conteúdo da config além do que o próprio painel mostra na tela.
 */

import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { CHAVE_FALSA, EMAIL_TESTE, SENHA_TESTE, URL_FALSA } from "./painel-ambiente";
import arquivo from "../linkbio.config";

type Config = {
  profile: { name: string; avatar?: string };
  contact: { whatsapp: string };
  site: { url: string; share?: { title?: string; description?: string; image?: string } };
  blocks: { id: string; type: string; enabled?: boolean; body?: string }[];
  theme: { preset?: string; corners?: string; radius?: number };
};
type Estado = {
  versoes: { id: number; config: Config; created_by: string | null; nota: string | null }[];
  rascunhos: { email: string; config: Config }[];
  tentativas: number;
  arquivos: string[];
  /** Pedidos do app ao falso desde o último `limpar`: zero aqui significa que o painel está noutro banco. */
  pedidos: number;
};

const SECOES = ["Blocos", "Perfil", "Aparência", "Ofertas", "Vitrine", "Contato e site", "Contatos", "Versões"];

const MODELOS = ["Neutro", "Noite", "Editorial", "Vitrine", "Brutal", "Vibrante"];

/** Nome de cada tipo no diálogo "Adicionar bloco", na ordem em que ele aparece. */
const TIPOS = [
  "Perfil",
  "Botão principal",
  "Aviso",
  "Concierge",
  "Ofertas",
  "Vitrine",
  "Cupom",
  "Link",
  "Grupo de links",
  "Redes em linha",
  "Vídeo",
  "Galeria",
  "Depoimentos",
  "Perguntas frequentes",
  "Texto",
  "Divisor",
  "Contato",
  "Pix",
  "Agenda",
];

/**
 * Tipos que nascem com campo obrigatório vazio: o painel tem que avisar de qual bloco e de qual
 * campo se trata, em vez de salvar pela metade ou travar em silêncio. O trecho é o caminho em
 * português que o painel mostra antes da mensagem ("Blocos › Vídeo › ...").
 */
const ESPERA_INVALIDO: Record<string, string> = {
  Link: "Blocos › Link",
  "Grupo de links": "Blocos › Grupo de links",
  "Redes em linha": "Blocos › Redes em linha",
  Vídeo: "Blocos › Vídeo",
  Galeria: "Blocos › Galeria",
  Depoimentos: "Blocos › Depoimentos",
  "Perguntas frequentes": "Blocos › Perguntas frequentes",
};

/**
 * Caso à parte: o bloco Vitrine é válido onde há produtos em `catalog` (o template, com 5) e
 * inválido onde não há (uma bio sem nenhum). A config é que decide, então este aceita os
 * dois resultados — mas cobra a mensagem certa quando ele não entra.
 */
const VITRINE = "Vitrine";
const VITRINE_SEM_CATALOGO = "A vitrine precisa de produtos";

/** PNG 1×1 de verdade (70 bytes): a prévia precisa decodificar, não só receber a URL. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

const cabecalho = { apikey: CHAVE_FALSA };

/** O falso guarda as versões em ordem de inserção; o painel lê da mais nova para a mais antiga. */
const maisNova = (e: Estado) => [...e.versoes].sort((a, b) => b.id - a.id)[0]!;

/** Zera versões, rascunhos e imagens entre um caso e outro (o usuário de teste fica). */
async function limpar(request: APIRequestContext) {
  expect((await request.post(`${URL_FALSA}/__controle/limpar`, { headers: cabecalho })).status()).toBe(204);
}

async function estado(request: APIRequestContext): Promise<Estado> {
  const resposta = await request.get(`${URL_FALSA}/__controle/estado`, { headers: cabecalho });
  expect(resposta.ok()).toBe(true);
  return (await resposta.json()) as Estado;
}

async function entrar(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("E-mail").fill(EMAIL_TESTE);
  await page.getByLabel("Senha").fill(SENHA_TESTE);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("navigation", { name: "Seções" })).toBeVisible();
  await expect(page.locator(".a-estado")).toHaveText("Tudo publicado");
}

const menu = (page: Page) => page.getByRole("navigation", { name: "Seções" });
const secao = (page: Page, nome: string) => menu(page).getByRole("button", { name: nome });

async function abrirSecao(page: Page, nome: string) {
  await secao(page, nome).click();
  await expect(page.locator(".a-cabecalho h1")).toHaveText(nome);
}

/**
 * Clica e espera a página inteira recarregar. Descartar e restaurar terminam em
 * `window.location.reload()`, e sem esperar o reload a asserção seguinte lê o DOM velho — que ainda
 * mostra o estado anterior. Depois do reload o painel remonta na primeira seção ("Blocos"), então
 * quem checa outra seção precisa reabri-la.
 */
async function clicarERecarregar(page: Page, alvo: Locator) {
  const recarregou = page.waitForEvent("framenavigated", (quadro) => quadro === page.mainFrame());
  await alvo.click();
  await recarregou;
}

/** Adiciona um bloco pelo diálogo e deixa a lista com ele no fim. */
async function adicionarBloco(page: Page, nome: string) {
  await page.getByRole("button", { name: "Adicionar bloco" }).click();
  const dialogo = page.getByRole("dialog", { name: "Escolher bloco" });
  await expect(dialogo).toBeVisible();
  await dialogo
    .locator(".s-opcao")
    .filter({ has: page.getByText(nome, { exact: true }) })
    .click();
  await expect(dialogo).toBeHidden();
  await expect(page.locator(".s-lista > li").last()).toContainText(nome);
}

/** Apaga oferta, produto ou depoimento, passando pela confirmação. */
async function apagarItem(item: Locator) {
  await item.locator(".c-item-topo").first().getByRole("button", { name: "Remover", exact: true }).click();
  await item.getByRole("alertdialog", { name: "Confirmar exclusão" }).getByRole("button", { name: "Apagar" }).click();
}

/** Apaga um bloco pelo menu "...", passando pela confirmação. */
async function apagarBloco(bloco: Locator) {
  await bloco.getByRole("button", { name: /^Mais ações/ }).click();
  await bloco.getByRole("menu").getByRole("menuitem", { name: "Apagar" }).click();
  await bloco.locator(".s-confirmar").getByRole("button", { name: "Apagar" }).click();
}

/** Apaga o último bloco, passando pela confirmação. */
async function apagarUltimoBloco(page: Page) {
  await apagarBloco(page.locator(".s-lista > li").last());
}

/**
 * Item novo com campo obrigatório vazio não mostra erro até a pessoa sair do campo ou tentar
 * publicar: tocar em Publicar é o que revela a lista do que falta.
 */
async function revelarProblemas(page: Page) {
  if (/Falta preencher/.test(await page.locator(".a-estado").innerText())) await page.getByRole("button", { name: "Publicar" }).click();
}

/**
 * Bloco novo, desligado e publicado: a config publicada muda (o Publicar sai de "Tudo publicado"),
 * mas o que a bio mostra não, porque bloco desligado não desenha. É como se testa publicar sem
 * trocar a fonte da config da bio — decisão de cada bio.
 */
async function publicarDesligado(page: Page, nome: string, corpo?: string) {
  await abrirSecao(page, "Blocos");
  await adicionarBloco(page, nome);
  if (corpo) await page.locator(".s-bloco-corpo").getByLabel("Texto").fill(corpo);
  await page.locator(".s-lista > li").last().getByRole("switch").click();
  await expect(page.locator(".a-estado")).toHaveText(/Rascunho salvo/);
  await page.getByRole("button", { name: "Publicar" }).click();
  await expect(page.locator(".a-estado")).toHaveText("Tudo publicado");
}

/** O quadro da prévia: carrega uma vez por abertura do painel. */
async function esperarQuadro(page: Page) {
  const doQuadro = () => page.frames().filter((f) => f.url().includes("/admin-previa"));
  await expect.poll(() => doQuadro().length, { timeout: 20000 }).toBe(1);
  return doQuadro()[0]!;
}

test.beforeEach(async ({ request }) => {
  await limpar(request);
});

test("o painel abre com as seções, sem erro de console", async ({ page, request }) => {
  const erros: string[] = [];
  page.on("console", (m) => m.type() === "error" && erros.push(m.text()));
  page.on("pageerror", (e) => erros.push(String(e)));

  await entrar(page);
  // O painel abriu contra o falso, não contra outro banco que estivesse no ambiente.
  expect((await estado(request)).pedidos).toBeGreaterThan(0);

  for (const nome of SECOES) await abrirSecao(page, nome);
  await abrirSecao(page, "Versões");
  await expect(page.locator(".a-conteudo")).toContainText("Nenhuma versão publicada ainda");
  await abrirSecao(page, "Blocos");
  await expect(page.locator(".s-lista > li").first()).toBeVisible();

  expect(erros, `erros de console no painel:\n${erros.join("\n")}`).toEqual([]);
});

test("sair do app logo depois de digitar não perde a edição (salva ao esconder a página)", async ({ page, request }) => {
  await entrar(page);
  await abrirSecao(page, "Perfil");
  const nome = page.locator(".a-conteudo").getByLabel("Nome").first();
  await nome.fill("Saiu rápido");
  // Troca de app no celular: a página fica escondida antes do rascunho automático de 600 ms. O envio tem
  // de sair já (400 ms), não pelo temporizador: sem o salvamento ao esconder, este passo falha.
  const enviou = page.waitForRequest((r) => r.method() === "POST" && Boolean(r.headers()["next-action"]), { timeout: 400 });
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await enviou;
  await page.close();
  await expect.poll(async () => (await estado(request)).rascunhos[0]?.config.profile.name).toBe("Saiu rápido");
});

test("Perfil, Aparência e Contato gravam no rascunho", async ({ page, request }) => {
  await entrar(page);

  await abrirSecao(page, "Perfil");
  const nome = page.locator(".a-conteudo").getByLabel("Nome").first();
  const original = await nome.inputValue();
  await nome.fill("Nome do teste");
  await expect(page.locator(".a-estado")).toHaveText(/Rascunho salvo/);
  // Sempre `poll` no rascunho: "Rascunho salvo" pode ser do save anterior, e a leitura crua corre
  // contra o debounce de 600 ms do editor.
  await expect.poll(async () => (await estado(request)).rascunhos[0]?.config.profile.name).toBe("Nome do teste");

  await abrirSecao(page, "Contato e site");
  const whatsapp = page.locator(".a-conteudo").getByLabel("WhatsApp");
  const numeroOriginal = await whatsapp.inputValue();
  // O número é o do dono da bio, então o teste não chumba um valor: troca o último dígito. Fixo, ele
  // passaria só na bio em que o valor coincide com o do arquivo, e falharia calado em qualquer outra.
  const outroNumero = numeroOriginal.slice(0, -1) + (numeroOriginal.endsWith("9") ? "8" : "9");
  await whatsapp.fill(outroNumero);
  await expect(page.locator(".a-estado")).toHaveText(/Rascunho salvo/);
  await expect.poll(async () => (await estado(request)).rascunhos[0]?.config.contact.whatsapp).toBe(outroNumero);

  // Endereço do site que não é link: recusado em português, com o nome do campo, e o rascunho não
  // anda. É o caso que a Fase 1 não conseguiu medir (o rótulo deste campo é "Link").
  const site = page.locator(".a-conteudo").getByLabel("Link");
  const urlOriginal = await site.inputValue();
  await site.fill("meu site");
  await expect(page.locator(".a-estado")).toHaveText("1 campo para corrigir");
  await expect(page.locator(".a-problemas")).toContainText("Site › Link: Este campo deve ser um link completo, começando com https://");
  await expect.poll(async () => (await estado(request)).rascunhos[0]?.config.site.url).toBe(urlOriginal);
  // Desfaz já: o valor inválido continua no painel (só não é salvo) e somaria no caso seguinte.
  await site.fill(urlOriginal);
  await expect(page.locator(".a-estado")).toHaveText(/Rascunho salvo/);

  // Um campo obrigatório vazio não pode ser salvo: o painel aponta o caminho e o rascunho não muda.
  await abrirSecao(page, "Perfil");
  await nome.fill("");
  await expect(page.locator(".a-estado")).toHaveText("1 campo para corrigir");
  // Campo que já existia e ficou vazio: aparece na hora (não é item novo), dizendo o que falta.
  await expect(page.locator(".a-problemas")).toContainText("Falta preencher para publicar");
  await expect(page.locator(".a-problemas")).toContainText("Perfil › Nome: falta preencher");
  expect((await estado(request)).rascunhos[0]!.config.profile.name).toBe("Nome do teste");

  // Desfazer as DUAS edições que sobraram volta ao que está no ar: só aí o painel diz "Tudo
  // publicado" (nada a publicar). Só o nome de volta não bastaria — o número continuaria pendente,
  // e o painel diria "Rascunho salvo" com razão.
  await nome.fill(original);
  await abrirSecao(page, "Contato e site");
  await whatsapp.fill(numeroOriginal);
  await expect(page.locator(".a-estado")).toHaveText("Tudo publicado");
  await expect.poll(async () => (await estado(request)).rascunhos[0]?.config.profile.name).toBe(original);
  expect((await estado(request)).rascunhos[0]!.config.contact.whatsapp).toBe(numeroOriginal);
});

test("os 6 modelos trocam e ficam no rascunho", async ({ page, request }) => {
  await entrar(page);
  await abrirSecao(page, "Aparência");
  const galeria = page.getByRole("radiogroup", { name: "Modelo" });
  const rascunho = async () => (await estado(request)).rascunhos[0]?.config.theme.preset;

  // Primeiro um modelo que não é o atual, para a primeira volta da lista ser mudança de verdade.
  await galeria.getByRole("radio").filter({ hasText: MODELOS.at(-1)! }).click();
  await expect.poll(rascunho).toBe(MODELOS.at(-1)!.toLowerCase());

  for (const modelo of MODELOS) {
    const opcao = galeria.getByRole("radio").filter({ hasText: modelo });
    await opcao.click();
    await expect(opcao).toHaveAttribute("aria-checked", "true");
    await expect(galeria.locator('[role="radio"][aria-checked="true"]')).toHaveCount(1);
    // A prova é o rascunho: esperar pelo texto do estado passaria com o "Rascunho salvo" da volta anterior.
    await expect.poll(rascunho).toBe(modelo.toLowerCase());
  }
});

test("Ofertas e Vitrine: item novo entra e sai", async ({ page }) => {
  await entrar(page);

  for (const [secao_, botao] of [
    ["Ofertas", "Adicionar oferta"],
    ["Vitrine", "Adicionar produto"],
  ] as const) {
    await abrirSecao(page, secao_);
    const itens = page.locator(".a-conteudo .c-item");
    const antes = await itens.count();
    await page.getByRole("button", { name: botao }).click();
    await expect(itens).toHaveCount(antes + 1);
    // Item novo nasce vazio e obrigatório: o painel avisa (sem vermelho) em vez de salvar pela metade.
    await expect(page.locator(".a-estado")).toHaveText(/^Falta preencher \d+ campos?$/);
    await apagarItem(itens.last());
    await expect(itens).toHaveCount(antes);
    // Sem o item, a config volta a ser a de antes: ou igual à do ar, ou ainda um rascunho, se a
    // raiz da config não trazia a lista (uma bio pode não ter `catalog`).
    await expect(page.locator(".a-estado")).toHaveText(/Tudo publicado|Rascunho salvo/);
  }
});

test("os tipos de bloco entram na lista e viram um estado explicável", async ({ page, request }) => {
  // Uma volta por tipo: perto dos 30 s padrão com os três navegadores rodando juntos.
  test.slow();
  await entrar(page);
  await abrirSecao(page, "Blocos");
  const inicio = await page.locator(".s-lista > li").count();
  const falhas: string[] = [];

  for (const tipo of TIPOS) {
    await adicionarBloco(page, tipo);

    // Depois de adicionar o painel se decide: salva o rascunho ou aponta o que falta — nunca fica
    // em "Salvando rascunho...". Tela e banco têm que contar a mesma história.
    const estadoTela = page.locator(".a-estado");
    await expect(estadoTela).not.toHaveText(/^(Tudo publicado|Salvando)/, { timeout: 5000 });
    await revelarProblemas(page);
    const problemas = (await page.locator(".a-problemas li").allInnerTexts()).join(" | ").replace(/\s+/g, " ");
    const explica = /campos? para corrigir|Falta preencher/.test(await estadoTela.innerText());
    const esperado = ESPERA_INVALIDO[tipo] ?? (tipo === VITRINE ? VITRINE_SEM_CATALOGO : null);

    if (explica && !esperado) {
      falhas.push(`${tipo}: bloco novo pediu conteúdo sem precisar ("${problemas}")`);
    } else if (explica && esperado && !problemas.includes(esperado)) {
      falhas.push(`${tipo}: devia apontar "${esperado}" e apontou "${problemas}"`);
    } else if (!explica && esperado && tipo !== VITRINE) {
      falhas.push(`${tipo}: entrou válido mesmo nascendo com campo obrigatório vazio`);
    } else if (!explica) {
      const noRascunho = (await estado(request)).rascunhos[0]?.config.blocks.length ?? -1;
      if (noRascunho !== inicio + 1) falhas.push(`${tipo}: a tela mostra ${inicio + 1} blocos e o rascunho tem ${noRascunho}`);
    }

    await apagarUltimoBloco(page);
    await expect(page.locator(".s-lista > li")).toHaveCount(inicio);
    await expect(estadoTela).not.toHaveText(/Salvando|para corrigir|Falta preencher/);
  }

  expect(falhas, `tipos de bloco com problema:\n${falhas.join("\n")}`).toEqual([]);
});

test("bloco: ligar, desligar, subir, descer, duplicar e apagar", async ({ page, request }) => {
  // No computador: a alça de arrastar existe no DOM mas o CSS a esconde no celular (o teste de
  // tamanhos cobre isso). Aqui interessa a função.
  await page.setViewportSize({ width: 1280, height: 900 });
  await entrar(page);
  await abrirSecao(page, "Blocos");
  const blocos = page.locator(".s-lista > li");
  const inicio = await blocos.count();
  const quadro = await esperarQuadro(page);

  await adicionarBloco(page, "Texto");
  await page.locator(".s-bloco-corpo").getByLabel("Texto").fill("Bloco do teste");
  await expect(page.locator(".a-estado")).toHaveText(/Rascunho salvo/);
  const desenhados = await quadro.locator(".pagina > *").count();

  // Desligar tira da prévia na hora e guarda a decisão no rascunho.
  await blocos.last().getByRole("switch").click();
  await expect(quadro.locator(".pagina > *")).toHaveCount(desenhados - 1);
  await expect(page.locator(".a-estado")).toHaveText(/Rascunho salvo/);
  const rascunho = (await estado(request)).rascunhos[0]!.config;
  expect(rascunho.blocks.at(-1)).toMatchObject({ type: "text", enabled: false });

  // Ligar de volta: o campo `enabled` sai do rascunho, não vira `true`.
  await blocos.last().getByRole("switch").click();
  await expect(quadro.locator(".pagina > *")).toHaveCount(desenhados);
  await expect(page.locator(".a-estado")).toHaveText(/Rascunho salvo/);
  expect((await estado(request)).rascunhos[0]!.config.blocks.at(-1)).not.toHaveProperty("enabled");

  // Subir e descer (no menu "...") trocam a ordem do próprio bloco.
  const nomes = async () => blocos.locator(".s-bloco-nome strong").allInnerTexts();
  const ordem = await nomes();
  await (await abrirMenu(blocos.last())).getByRole("menuitem", { name: "Subir" }).click();
  expect(await nomes()).toEqual([...ordem.slice(0, -2), ordem.at(-1)!, ordem.at(-2)!]);
  await (await abrirMenu(blocos.nth(inicio - 1))).getByRole("menuitem", { name: "Descer" }).click();
  expect(await nomes()).toEqual(ordem);

  // Duplicar: a cópia entra logo depois e leva o conteúdo junto.
  await (await abrirMenu(blocos.last())).getByRole("menuitem", { name: "Duplicar" }).click();
  await expect(blocos).toHaveCount(inicio + 2);
  await expect
    .poll(async () => (await estado(request)).rascunhos[0]?.config.blocks.at(-1))
    .toMatchObject({ type: "text", body: "Bloco do teste" });

  // A cópia precisa de id livre. O schema não exige id nem recusa repetido, então o invariante é
  // entre os blocos que têm id — e duplicar o MESMO bloco duas vezes é onde o sufixo repetia.
  await (await abrirMenu(blocos.nth(inicio))).getByRole("menuitem", { name: "Duplicar" }).click();
  await expect(blocos).toHaveCount(inicio + 3);
  const ids = (await estado(request))
    .rascunhos[0]!.config.blocks.map((b) => b.id)
    .filter((id): id is string => typeof id === "string");
  expect(new Set(ids).size).toBe(ids.length);
  await expect(page.locator(".a-problemas")).toHaveCount(0);

  await apagarUltimoBloco(page);
  await expect(blocos).toHaveCount(inicio + 2);
  await expect.poll(async () => (await estado(request)).rascunhos[0]?.config.blocks.length).toBe(inicio + 2);
});

test("a prévia acompanha a digitação sem recarregar o quadro", async ({ page }) => {
  await entrar(page);
  const quadro = await esperarQuadro(page);
  await abrirSecao(page, "Perfil");

  const nome = page.locator(".a-conteudo").getByLabel("Nome").first();
  const antes = (await quadro.locator("h1").first().textContent()) ?? "";
  const t0 = Date.now();
  await nome.fill("Prévia ao vivo");
  await expect(quadro.locator("h1").first()).toHaveText("Prévia ao vivo", { timeout: 1000 });
  const ms = Date.now() - t0;

  // Antes disso eram 1723 a 3537 ms por tecla, com o quadro recarregando a cada uma.
  expect(ms, "a prévia demorou mais que o comportamento antigo").toBeLessThan(1000);
  expect(antes).not.toBe("Prévia ao vivo");
  expect(page.frames().filter((f) => f.url().includes("/admin-previa"))).toHaveLength(1);
  expect(quadro.url()).toContain("/admin-previa");
});

test("imagem: sobe, os bytes voltam, o link é aceito e o arquivo errado é recusado", async ({ page, request }) => {
  await entrar(page);
  await abrirSecao(page, "Perfil");
  const arquivo = page.locator('.a-conteudo input[type="file"]');
  const miniatura = page.locator(".c-imagem-previa img");
  const link = page.locator(".a-conteudo").getByLabel("Foto");
  const avatarNoRascunho = async () => (await estado(request)).rascunhos[0]?.config.profile.avatar;

  await arquivo.setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: PNG });
  await expect(miniatura).toHaveAttribute("src", new RegExp(`^${URL_FALSA}/storage/v1/object/public/linkbio/`));
  // 1×1 e não 0×0: só passa de 0 se o falso devolveu o PNG inteiro, com o content-type certo.
  expect(await miniatura.evaluate((e) => (e as HTMLImageElement).naturalWidth)).toBe(1);
  expect(await miniatura.evaluate((e) => (e as HTMLImageElement).naturalHeight)).toBe(1);
  expect((await estado(request)).arquivos).toHaveLength(1);

  // O falso é http e o schema só aceita imagem em https (ou caminho da pasta public/): o painel
  // avisa em vez de deixar passar um rascunho que nunca publicaria. Em produção o Supabase é https,
  // então isto aqui é do ambiente de teste — e por isso o link https do campo abaixo é que vira dado.
  await expect(page.locator(".a-estado")).toHaveText("1 campo para corrigir");
  await expect(page.locator(".a-problemas")).toContainText("Perfil › Foto");

  await link.fill("https://exemplo.com/avatar.png");
  await expect.poll(avatarNoRascunho).toBe("https://exemplo.com/avatar.png");
  await expect(page.locator(".a-estado")).toHaveText(/Rascunho salvo/);

  // Arquivo que não é imagem: recusado com o motivo, e o que estava no campo continua lá.
  await arquivo.setInputFiles({ name: "notas.txt", mimeType: "text/plain", buffer: Buffer.from("não é imagem") });
  await expect(page.locator(".c-erro")).toHaveText("Envie uma imagem JPG, PNG, WebP ou GIF.");
  await expect(link).toHaveValue("https://exemplo.com/avatar.png");
  expect((await estado(request)).arquivos).toHaveLength(1);
});

test("imagem: foto de 2 MB passa (acima do 1 MB padrão do Next); acima de 4 MB é reduzida no navegador, e o que não reduz é recusado", async ({ page, request }) => {
  await entrar(page);
  await abrirSecao(page, "Perfil");
  const arquivo = page.locator('.a-conteudo input[type="file"]');
  const miniatura = page.locator(".c-imagem-previa img");

  // PNG válido seguido de bytes extras: o navegador ignora o que vem depois do fim da imagem.
  const grande = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]);
  await arquivo.setInputFiles({ name: "grande.png", mimeType: "image/png", buffer: grande });
  await expect(miniatura).toHaveAttribute("src", new RegExp(`^${URL_FALSA}/storage/v1/object/public/linkbio/`));
  expect((await estado(request)).arquivos).toHaveLength(1);
  await expect(page.locator(".c-erro")).toHaveCount(0);

  // Foto de celular acima de 4 MB: o leigo não sabe reduzir, então o painel reduz antes de enviar.
  const demais = Buffer.concat([PNG, Buffer.alloc(4 * 1024 * 1024 + 1)]);
  const antes = await miniatura.getAttribute("src");
  await arquivo.setInputFiles({ name: "demais.png", mimeType: "image/png", buffer: demais });
  await expect(miniatura).not.toHaveAttribute("src", antes!);
  await expect(miniatura).toHaveAttribute("src", new RegExp(`^${URL_FALSA}/storage/v1/object/public/linkbio/.+\\.(webp|png)$`));
  expect(await miniatura.evaluate((e) => (e as HTMLImageElement).naturalWidth)).toBe(1);
  expect((await estado(request)).arquivos).toHaveLength(2);
  await expect(page.locator(".c-imagem .c-erro")).toHaveCount(0);

  // O que não dá para reduzir (GIF perderia a animação; arquivo que não é imagem de verdade) é
  // recusado antes de enviar, com o motivo.
  await arquivo.setInputFiles({ name: "animado.gif", mimeType: "image/gif", buffer: Buffer.alloc(4 * 1024 * 1024 + 1) });
  await expect(page.locator(".c-imagem .c-erro")).toContainText("passa de 4 MB");
  await arquivo.setInputFiles({ name: "quebrada.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(4 * 1024 * 1024 + 1) });
  await expect(page.locator(".c-imagem .c-erro")).toContainText("passa de 4 MB");
  expect((await estado(request)).arquivos).toHaveLength(2);
});

test("publicar cria versão, limpa o rascunho e não mexe na bio pública", async ({ page, request }) => {
  await entrar(page);
  await publicarDesligado(page, "Texto", "bloco desligado do teste");

  await expect(page.locator(".a-toast")).toContainText("Publicado. A bio já mostra a versão 1.");
  const depois = await estado(request);
  expect(depois.versoes).toHaveLength(1);
  expect(maisNova(depois).created_by).toBe(EMAIL_TESTE);
  expect(depois.rascunhos).toEqual([]);

  await abrirSecao(page, "Versões");
  await expect(page.locator(".s-versoes > li:not(.s-versao-arquivo)").first()).toContainText("Versão 1");
  await expect(page.locator(".s-versoes > li:not(.s-versao-arquivo)").first()).toContainText("No ar");
  await expect(page.locator(".s-versoes > li:not(.s-versao-arquivo)").first()).toContainText(EMAIL_TESTE);

  // A bio no ar continua a mesma: o bloco desligado não desenha.
  const bio = await (await request.get("/")).text();
  expect(bio).not.toContain("bloco desligado do teste");
});

test("digitou e tocou em Publicar na hora: publica o que está na tela (celular)", async ({ page, request }) => {
  // No celular a pessoa digita e toca direto em Publicar. O botão ficava travado enquanto o rascunho
  // salvava e o toque se perdia em silêncio: nada publicado, e ela achando que foi.
  await page.setViewportSize({ width: 375, height: 667 });
  await entrar(page);
  await abrirSecao(page, "Perfil");
  await page.getByRole("textbox", { name: /^Nome/ }).first().fill("Nome publicado na hora");
  // force: o toque acontece na hora, sem esperar o botão destravar (é o que o dedo faz).
  await page.getByRole("button", { name: "Publicar" }).click({ force: true });
  await expect(page.locator(".a-estado")).toHaveText("Tudo publicado");
  await expect(page.locator(".a-toast")).toContainText("Publicado.");
  await expect.poll(async () => (await estado(request)).versoes.length).toBe(1);
  expect(maisNova(await estado(request)).config.profile.name).toBe("Nome publicado na hora");
  // Um rascunho que ainda estava a caminho não faz o selo voltar para "não publicado".
  await page.waitForTimeout(1500);
  await expect(page.locator(".a-estado")).toHaveText("Tudo publicado");

  // Campo que só grava ao sair dele (o preço): o mesmo toque que sai do campo publica.
  const i = (arquivo as unknown as { catalog?: unknown[] }).catalog?.length ?? 0;
  test.skip(i === 0, "config sem produtos na vitrine");
  await abrirSecao(page, "Vitrine");
  await page.locator(".c-item-titulo").first().click();
  const preco = page.locator(".c-prefixo input").first();
  await preco.fill("123,45");
  await page.getByRole("button", { name: "Publicar" }).click({ force: true });
  await expect.poll(async () => (await estado(request)).versoes.length).toBe(2);
  const cfg = maisNova(await estado(request)).config as unknown as { catalog: { price_cents?: number }[] };
  expect(cfg.catalog.some((p) => p.price_cents === 12345)).toBe(true);
});

test("descartar volta tudo ao que está no ar", async ({ page, request }) => {
  await entrar(page);
  await abrirSecao(page, "Perfil");
  const nome = page.locator(".a-conteudo").getByLabel("Nome").first();
  const original = await nome.inputValue();

  await nome.fill("Nome que vai ser descartado");
  await expect(page.locator(".a-estado")).toHaveText(/Rascunho salvo/);
  expect((await estado(request)).rascunhos).toHaveLength(1);

  await page.getByRole("button", { name: "Descartar" }).click();
  await clicarERecarregar(page, page.locator(".a-confirmar").getByRole("button", { name: "Descartar" }));

  await expect(page.locator(".a-estado")).toHaveText("Tudo publicado");
  await abrirSecao(page, "Perfil");
  await expect(page.locator(".a-conteudo").getByLabel("Nome").first()).toHaveValue(original);
  expect((await estado(request)).rascunhos).toEqual([]);
});

test("restaurar traz o conteúdo de uma versão antiga como versão nova", async ({ page, request }) => {
  await entrar(page);
  await publicarDesligado(page, "Texto", "primeira publicação");
  await publicarDesligado(page, "Divisor");

  await abrirSecao(page, "Versões");
  const versoes = page.locator(".s-versoes > li:not(.s-versao-arquivo)");
  await expect(versoes).toHaveCount(2);
  await expect(versoes.first()).toContainText("Versão 2");
  await expect(versoes.first()).toContainText("No ar");
  const blocosNaV1 = (await estado(request)).versoes.find((v) => v.id === 1)!.config.blocks.length;

  await versoes.nth(1).getByRole("button", { name: "Restaurar" }).click();
  await clicarERecarregar(page, versoes.nth(1).getByRole("button", { name: "Voltar a esta" }));

  await expect(page.locator(".a-estado")).toHaveText("Tudo publicado");
  // A lista de versões some com o reload (o painel volta para "Blocos"); reabrir a seção é o caminho
  // de quem usa, e é onde as 3 versões precisam estar.
  await abrirSecao(page, "Versões");
  await expect(page.locator(".s-versoes > li:not(.s-versao-arquivo)")).toHaveCount(3);
  const ultima = maisNova(await estado(request));
  expect(ultima.nota).toBe("restaurada da versão 1");
  expect(ultima.config.blocks).toHaveLength(blocosNaV1);
});

test("voltar ao arquivo original publica o linkbio.config.ts como versão nova", async ({ page, request }) => {
  await entrar(page);
  await publicarDesligado(page, "Texto", "primeira publicação");
  expect(maisNova(await estado(request)).config.blocks).not.toEqual(arquivo.blocks);

  await abrirSecao(page, "Versões");
  const doArquivo = page.locator(".s-versao-arquivo");
  await expect(doArquivo).toContainText("Arquivo original");
  await doArquivo.getByRole("button", { name: "Restaurar" }).click();
  await clicarERecarregar(page, doArquivo.getByRole("button", { name: "Voltar ao arquivo" }));

  await expect(page.locator(".a-estado")).toHaveText("Tudo publicado");
  const ultima = maisNova(await estado(request));
  expect(ultima.nota).toBe("restaurada do arquivo original");
  // Mesmo conteúdo do arquivo (JSON tira os campos undefined, como faz o banco).
  expect(ultima.config).toEqual(JSON.parse(JSON.stringify(arquivo)));
  await abrirSecao(page, "Versões");
  await expect(page.locator(".s-versoes > li:not(.s-versao-arquivo)")).toHaveCount(2);
});

type Opcao = { id: string; label: string; offer?: string; reason?: string };
type Bloco = { type: string; items?: string[]; flow?: { question: string; options: Opcao[] }[] };
type Oferta = { id: string; title: string };
const doRascunho = async (request: APIRequestContext) => {
  const r = (await estado(request)).rascunhos[0];
  expect(r, "o rascunho foi salvo").toBeTruthy();
  return r!.config as unknown as { blocks: Bloco[]; offers: Oferta[] };
};
const blocoAberto = (page: Page, nome: string) =>
  page.locator(".s-bloco-nome").filter({ has: page.locator("strong", { hasText: new RegExp(`^${nome}$`) }) }).first();

test("concierge: a lógica fica visível e a 1ª pergunta decide o final", async ({ page, request }) => {
  const i = arquivo.blocks.findIndex((b) => b.type === "concierge");
  test.skip(i < 0, "config sem concierge");
  const conc = arquivo.blocks[i] as unknown as Bloco;
  await entrar(page);
  await blocoAberto(page, "Concierge").click();

  await expect(page.locator(".k-regra")).toContainText("Como o concierge decide");
  const passos = page.locator(".k-passo");
  await expect(passos).toHaveCount(conc.flow!.length);
  await expect(passos.first().locator(".k-selo")).toHaveText("Decide o final");
  // Só a 1ª pergunta tem "Leva para" e "Explicação no final": nas outras eles não teriam efeito.
  await expect(passos.first().getByRole("combobox", { name: "Leva para" })).toHaveCount(conc.flow![0]!.options.length);
  if (conc.flow!.length > 1) {
    await expect(passos.nth(1).locator(".k-selo")).toHaveText("Contexto");
    await expect(passos.nth(1).getByRole("combobox")).toHaveCount(0);
    await expect(passos.nth(1).getByRole("textbox", { name: /^Explicação/ })).toHaveCount(0);
  }

  // Muda para onde a 1ª resposta leva e a explicação; o rascunho guarda exatamente isso.
  const primeira = passos.first().locator(".k-resposta").first();
  await primeira.getByRole("combobox", { name: "Leva para" }).selectOption({ label: "Conversa no WhatsApp (sem oferta)" });
  await expect(primeira.locator(".k-conversa")).toBeVisible();
  await primeira.getByRole("textbox", { name: /^Explicação no final/ }).fill("Explicação editada no painel.");
  await expect(page.locator(".a-estado")).toHaveText(/Rascunho salvo/);
  let cfg = await doRascunho(request);
  expect(cfg.blocks[i]!.flow![0]!.options[0]!.offer).toBeUndefined();
  expect(cfg.blocks[i]!.flow![0]!.options[0]!.reason).toBe("Explicação editada no painel.");

  // Pergunta de contexto nova: só pede a pergunta e o texto das respostas.
  await page.getByRole("button", { name: "Adicionar pergunta de contexto" }).click();
  const nova = passos.last();
  await expect(nova.locator(".k-selo")).toHaveText("Contexto");
  await nova.getByRole("textbox", { name: /^Pergunta/ }).fill("Quando quer começar?");
  const respostas = nova.getByRole("textbox", { name: /^Texto da resposta/ });
  await respostas.nth(0).fill("Agora");
  await respostas.nth(1).fill("Mais para frente");
  await expect(page.locator(".a-estado")).toHaveText(/Rascunho salvo/);
  cfg = await doRascunho(request);
  const ultima = cfg.blocks[i]!.flow!.at(-1)!;
  expect(ultima.question).toBe("Quando quer começar?");
  expect(ultima.options.map((o) => o.label)).toEqual(["Agora", "Mais para frente"]);
  expect(new Set(ultima.options.map((o) => o.id)).size).toBe(2);
});

test("concierge: trocar quem decide o final mostra \"Leva para\" em todas as perguntas e a prévia segue a última resposta", async ({ page, request }) => {
  const i = arquivo.blocks.findIndex((b) => b.type === "concierge");
  const conc = arquivo.blocks[i] as unknown as (Bloco & { decide?: string }) | undefined;
  const ofertas = arquivo.offers as Oferta[];
  // Precisa de 2 perguntas, e a 2ª com uma resposta que leve a outra oferta que a 1ª resposta da 1ª.
  const r1 = conc?.flow?.[0]?.options.find((o) => o.offer);
  const r2 = conc?.flow?.[1]?.options.find((o) => o.offer && o.offer !== r1?.offer && o.reason);
  test.skip(!conc || conc.decide !== undefined || !r1 || !r2, "config sem concierge de 2 perguntas com destinos diferentes");
  await page.setViewportSize({ width: 1280, height: 900 });
  await entrar(page);
  await blocoAberto(page, "Concierge").click();

  const escolha = page.getByRole("radiogroup", { name: "Quem decide o final" });
  await expect(escolha.getByRole("radio", { name: "Só a 1ª pergunta" })).toHaveAttribute("aria-checked", "true");
  const passos = page.locator(".k-passo");
  // Modo "primeira": o destino guardado na 2ª pergunta aparece como ignorado, em vez de sumir.
  await expect(passos.nth(1).locator(".k-ignorado")).toContainText("Destino ignorado");
  await expect(passos.nth(1).locator(".k-ignorado")).toContainText(r2!.label);
  await expect(passos.nth(1).getByRole("combobox", { name: "Leva para" })).toHaveCount(0);

  // Modo "ultima": "Leva para" e "Explicação no final" em todas as perguntas.
  await escolha.getByRole("radio", { name: "A última resposta com destino" }).click();
  await expect(escolha.getByRole("radio", { name: "A última resposta com destino" })).toHaveAttribute("aria-checked", "true");
  // O selo já diz "Rascunho salvo" desde antes: espera o rascunho no banco ter a mudança.
  const decideNoRascunho = async () => ((await estado(request)).rascunhos[0]?.config.blocks[i] as { decide?: string } | undefined)?.decide;
  await expect.poll(decideNoRascunho).toBe("ultima");
  await expect(passos.nth(1).locator(".k-ignorado")).toHaveCount(0);
  await expect(passos.nth(1).locator(".k-selo")).toHaveText("Pode decidir o final");
  await expect(passos.nth(1).getByRole("combobox", { name: "Leva para" })).toHaveCount(conc!.flow![1]!.options.length);
  const k2 = conc!.flow![1]!.options.indexOf(r2!);
  await expect(passos.nth(1).getByRole("combobox", { name: "Leva para" }).nth(k2).locator("option:checked")).toHaveText(
    `Oferta: ${ofertas.find((o) => o.id === r2!.offer)!.title}`,
  );
  await expect(passos.nth(1).getByRole("textbox", { name: /^Explicação no final/ }).nth(k2)).toHaveValue(r2!.reason!);

  // A prévia já desenha o modo novo: 1ª resposta leva a uma oferta, a 2ª a outra; vale a 2ª.
  await expect(page.locator(".a-previa iframe.p-visivel")).toBeVisible({ timeout: 20000 });
  const quadro = page.frames().find((f) => f.url().includes("/admin-previa"))!;
  const cc = quadro.getByTestId("concierge").first();
  await expect(cc).toHaveAttribute("data-pronto", "true");
  await cc.getByTestId(`cc-chip-${r1!.id}`).click();
  await cc.getByTestId(`cc-chip-${r2!.id}`).click();
  for (let p = 2; p < conc!.flow!.length; p++) await cc.getByTestId(/cc-chip-/).first().click();
  await expect(cc.locator(".concierge-oferta")).toHaveText(ofertas.find((o) => o.id === r2!.offer)!.title);
  await expect(cc.locator(".concierge-motivo")).toHaveText(r2!.reason!);

  // Resposta marcada como "Não muda o final" perde o destino e vira contexto.
  await passos.nth(1).getByRole("combobox", { name: "Leva para" }).nth(k2).selectOption({ label: "Não muda o final (só contexto)" });
  await expect(passos.nth(1).getByRole("textbox", { name: /^Explicação no final/ })).toHaveCount(conc!.flow![1]!.options.length - 1);
  await expect.poll(async () => (await doRascunho(request)).blocks[i]!.flow![1]!.options[k2]).toEqual({ id: r2!.id, label: r2!.label });

  // De volta a "Só a 1ª pergunta": o campo sai do arquivo, e o destino que sobrou pode ser limpo.
  await escolha.getByRole("radio", { name: "Só a 1ª pergunta" }).click();
  await expect(passos.nth(1).locator(".k-ignorado")).toBeVisible();
  await passos.nth(1).getByRole("button", { name: "Limpar destino destas respostas" }).click();
  await expect(passos.nth(1).locator(".k-ignorado")).toHaveCount(0);
  await expect.poll(async () => (await doRascunho(request)).blocks[i]!.flow![1]!.options.every((op) => Object.keys(op).length === 2)).toBe(true);
  const cfg = await doRascunho(request);
  expect((cfg.blocks[i] as Bloco & { decide?: string }).decide).toBeUndefined();
  for (const op of cfg.blocks[i]!.flow![1]!.options) expect(Object.keys(op).sort()).toEqual(["id", "label"]);
  expect(cfg.blocks[i]!.flow![0]!.options).toEqual(conc!.flow![0]!.options);
});

test("cards: cada oferta do bloco é editada ali mesmo, e dá para criar oferta nova", async ({ page, request }) => {
  const i = arquivo.blocks.findIndex((b) => b.type === "cards");
  test.skip(i < 0, "config sem bloco de cards");
  const itens = (arquivo.blocks[i] as unknown as Bloco).items!;
  await entrar(page);
  await blocoAberto(page, "Ofertas").click();

  const cards = page.locator(".k-cards .c-item");
  await expect(cards).toHaveCount(itens.length);
  await cards.first().locator(".c-item-titulo").click();
  await cards.first().getByRole("textbox", { name: /^Título\s*(obrigatório)?$/ }).fill("Oferta editada no bloco");
  await expect(page.locator(".a-estado")).toHaveText(/Rascunho salvo/);
  let cfg = await doRascunho(request);
  expect(cfg.offers.find((o) => o.id === itens[0])!.title).toBe("Oferta editada no bloco");

  // Oferta nova: nasce no bloco, aberta, e o painel pede a descrição antes de salvar.
  await page.getByRole("button", { name: "Criar oferta nova" }).click();
  await expect(cards).toHaveCount(itens.length + 1);
  const nova = cards.last();
  await expect(nova.locator(".c-item-titulo")).toHaveText(/Nova oferta/);
  await nova.getByRole("textbox", { name: /^Descrição/ }).fill("Criada dentro do bloco de cards.");
  await expect(page.locator(".a-estado")).toHaveText(/Rascunho salvo/);
  cfg = await doRascunho(request);
  const criada = cfg.offers.at(-1)!;
  expect(criada.title).toBe("Nova oferta");
  expect(cfg.blocks[i]!.items).toContain(criada.id);
});

test("sair volta para o login e o painel fica fechado", async ({ page }) => {
  // No computador o Sair mora no rodapé do menu; no celular, no topo (teste abaixo).
  await page.setViewportSize({ width: 1280, height: 900 });
  await entrar(page);
  await expect(menu(page)).toContainText(EMAIL_TESTE);
  await menu(page).getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("no celular o Sair fica no topo e desconecta", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await entrar(page);
  await expect(page.locator(".a-menu-rodape button")).toBeHidden();
  const sair = page.locator(".a-topo").getByRole("button", { name: "Sair" });
  await expect(sair).toBeVisible();
  await sair.click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("no celular: alvos de toque de 44 px, título visível e nada estoura a largura", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await entrar(page);
  for (const nome of ["Blocos", "Perfil", "Aparência", "Ofertas", "Vitrine", "Contato e site", "Contatos", "Versões"]) {
    await abrirSecao(page, nome);
    const medida = await page.evaluate(() => {
      const w = document.documentElement.clientWidth;
      const pequenos = [...document.querySelectorAll(".adm button, .adm a, .adm input, .adm select")]
        .filter((e) => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && (e as HTMLInputElement).type !== "file" && (r.width < 44 || r.height < 44);
        })
        .map((e) => (e.getAttribute("aria-label") ?? e.textContent ?? e.tagName).trim().slice(0, 30));
      // A barra de abas gruda logo abaixo do topo, sem cobrir o título da seção.
      const topo = document.querySelector(".a-topo")!.getBoundingClientRect().bottom;
      const abas = document.querySelector(".a-menu")!.getBoundingClientRect();
      const titulo = document.querySelector(".a-cabecalho h1")!.getBoundingClientRect().top;
      return { largura: document.documentElement.scrollWidth - w, pequenos, abasNoTopo: abas.top >= topo - 1, tituloLivre: titulo >= abas.bottom };
    });
    expect(medida.largura, `${nome}: estouro horizontal`).toBeLessThanOrEqual(0);
    expect(medida.pequenos, `${nome}: alvos abaixo de 44 px`).toEqual([]);
    expect(medida.abasNoTopo, `${nome}: abas coladas no topo`).toBe(true);
    expect(medida.tituloLivre, `${nome}: título coberto pelas abas`).toBe(true);
  }
  // Rolando, a barra de abas gruda logo abaixo do topo (que muda de altura quando quebra linha).
  await abrirSecao(page, "Blocos");
  await page.mouse.wheel(0, 600);
  await expect
    .poll(() =>
      page.evaluate(() =>
        Math.round(document.querySelector(".a-menu")!.getBoundingClientRect().top - document.querySelector(".a-topo")!.getBoundingClientRect().bottom),
      ),
    )
    .toBe(0);
});

test("no computador a prévia fica ao lado; no celular, no overlay", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await entrar(page);
  await expect(page.locator(".a-previa")).toBeVisible();
  await expect(page.locator(".a-botao-previa")).toHaveCount(1);
  await expect(page.locator(".a-botao-previa")).toBeHidden();
  await expect(page.locator(".a-fechar-previa")).toBeHidden();

  await page.setViewportSize({ width: 375, height: 667 });
  await expect(page.locator(".a-previa")).toBeHidden();
  await page.getByRole("button", { name: "Ver prévia" }).click();
  await expect(page.locator(".a-previa")).toBeVisible();
  await expect(page.getByRole("button", { name: "Fechar prévia" })).toBeVisible();
  await page.getByRole("button", { name: "Fechar prévia" }).click();
  await expect(page.locator(".a-previa")).toBeHidden();

  // O que o celular perde de propósito: a alça de arrastar (Subir/Descer do menu fazem o mesmo).
  // O Sair do rodapé some, mas o do topo aparece (teste "no celular o Sair fica no topo").
  await abrirSecao(page, "Blocos");
  // Por CSS de propósito: `getByRole` não enxerga o que está fora da árvore de acessibilidade, então
  // um `toBeHidden()` sobre ele passaria mesmo se o botão não existisse.
  const blocos = page.locator(".s-lista > li");
  await expect(page.locator(".s-lista .s-alca")).toHaveCount(await blocos.count());
  await expect(page.locator(".s-alca").first()).toBeHidden();
  await expect(blocos.first().getByRole("button", { name: /^Mais ações/ })).toBeVisible();
  const sair = page.locator(".a-menu-rodape button");
  await expect(sair).toHaveCount(1);
  await expect(sair).toBeHidden();
  await expect(page.locator(".a-previa")).toBeHidden();
});

/* ------------------------------------------------------------------------------------------------
 * Leigo: o que a pessoa digita do jeito dela, os erros de propósito e a bio montada do zero.
 * ---------------------------------------------------------------------------------------------- */

type ConfigCompleta = Omit<Config, "blocks" | "theme"> & {
  offers: { id: string; title: string; price_cents?: number; cover?: { image?: string } }[];
  blocks: (Bloco & { videoId?: string; code?: string; expires?: string })[];
  theme: { preset?: string; accent?: string; font?: unknown };
};
const rascunhoCompleto = async (request: APIRequestContext) => (await doRascunho(request)) as unknown as ConfigCompleta;
const semSalvar = (page: Page) => expect(page.locator(".a-estado")).not.toHaveText(/Salvando/);

test("capa lenta não segura o rascunho: a prévia do WhatsApp corre por fora do salvamento", async ({ page, request }) => {
  // Sem sessão, a rota da prévia não desenha nada.
  expect((await request.post("/admin/capa-previa", { data: {} })).status()).toBe(401);
  await entrar(page);
  // A prévia da capa demora de propósito (imagem grande, rede lenta).
  let pedidos = 0;
  await page.route("**/admin/capa-previa", async (rota) => {
    pedidos++;
    await new Promise((ok) => setTimeout(ok, 8000));
    await rota.continue().catch(() => {});
  });
  await abrirSecao(page, "Contato e site");
  await page.locator(".a-conteudo").getByRole("button", { name: "Adicionar capa ao compartilhar" }).click();
  const titulo = page.locator(".a-conteudo").getByLabel("Título do link");
  await titulo.fill("Primeiro título");
  await expect.poll(() => pedidos, { timeout: 5000 }).toBeGreaterThan(0);
  // Com a capa ainda sendo desenhada, a edição seguinte salva no tempo normal.
  await titulo.fill("Título que salva mesmo com a capa lenta");
  await expect(page.locator(".a-estado")).toHaveText(/Rascunho salvo/, { timeout: 5000 });
  await expect
    .poll(async () => (await rascunhoCompleto(request)).site.share?.title, { timeout: 5000 })
    .toBe("Título que salva mesmo com a capa lenta");
});

test("leigo: WhatsApp, link, vídeo, cupom, data e preço entram do jeito que ele digita", async ({ page, request }) => {
  await entrar(page);
  const c = page.locator(".a-conteudo");

  await abrirSecao(page, "Contato e site");
  const whatsapp = c.getByLabel("WhatsApp");
  await whatsapp.fill("(21) 99876-5432"); // ficticio
  await whatsapp.press("Tab");
  await expect(whatsapp).toHaveValue("5521998765432"); // ficticio
  const site = c.getByLabel("Link");
  await site.fill("meusite.com.br");
  await site.press("Tab");
  await expect(site).toHaveValue("https://meusite.com.br");
  await expect(page.locator(".a-estado")).toHaveText(/Rascunho salvo/);
  await expect.poll(async () => (await rascunhoCompleto(request)).contact.whatsapp).toBe("5521998765432"); // ficticio
  expect((await rascunhoCompleto(request)).site.url).toBe("https://meusite.com.br");

  // Vídeo: o leigo cola o link inteiro, o painel guarda só o código.
  await abrirSecao(page, "Blocos");
  await adicionarBloco(page, "Vídeo");
  const video = page.locator(".s-bloco-corpo").getByLabel("Link do vídeo no YouTube");
  await video.fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s");
  await expect(video).toHaveValue("dQw4w9WgXcQ");
  await expect(page.locator(".a-estado")).toHaveText(/Rascunho salvo/);
  await expect.poll(async () => (await rascunhoCompleto(request)).blocks.at(-1)!.videoId).toBe("dQw4w9WgXcQ");

  // Cupom: minúsculo vira maiúsculo; a data vem do calendário do aparelho.
  await adicionarBloco(page, "Cupom");
  const corpo = page.locator(".s-bloco-corpo");
  await corpo.getByLabel("Código do cupom").fill("bem vinda");
  await expect(corpo.getByLabel("Código do cupom")).toHaveValue("BEMVINDA");
  await expect(corpo.getByLabel("Válido até")).toHaveAttribute("type", "date");
  await corpo.getByLabel("Válido até").fill("2026-12-31");
  await expect(page.locator(".a-estado")).toHaveText(/Rascunho salvo/);
  await expect.poll(async () => (await rascunhoCompleto(request)).blocks.at(-1)!.expires).toBe("2026-12-31");
  expect((await rascunhoCompleto(request)).blocks.at(-1)!.code).toBe("BEMVINDA");

  // Oferta nova pela seção Ofertas: nasce com identificador e destino; só a descrição falta.
  await abrirSecao(page, "Ofertas");
  await page.getByRole("button", { name: "Adicionar oferta" }).click();
  // Oferta nova: falta a descrição, mas nada fica vermelho antes de a pessoa passar pelo campo.
  await expect(page.locator(".a-estado")).toHaveText("Falta preencher 1 campo");
  await expect(page.locator(".a-problemas")).toHaveCount(0);
  await page.getByRole("button", { name: "Publicar" }).click();
  await expect(page.locator(".a-problemas")).toContainText('Ofertas › "Nova oferta" › Descrição: falta preencher');
  const nova = c.locator(".c-item").last();
  await nova.getByRole("textbox", { name: /^Descrição/ }).fill("Oferta criada pelo teste do leigo.");
  const preco = nova.getByLabel("Preço (R$)");
  const precoNoRascunho = async () => (await rascunhoCompleto(request)).offers.at(-1)!.price_cents;
  await preco.fill("R$ 1.290,50");
  await preco.press("Tab");
  await expect(preco).toHaveValue("1.290,50");
  await expect.poll(precoNoRascunho).toBe(129050);
  // Ponto como vírgula (teclado de computador) não multiplica o preço por 100.
  await preco.fill("97.90");
  await preco.press("Tab");
  await expect(preco).toHaveValue("97,90");
  await expect.poll(precoNoRascunho).toBe(9790);
  // Texto que não é preço: o painel avisa e o preço guardado não muda.
  await preco.fill("noventa reais");
  await preco.press("Tab");
  await expect(nova.getByRole("alert")).toHaveText(/Não entendi este preço/);
  await semSalvar(page);
  expect(await precoNoRascunho()).toBe(9790);
  const oferta = (await rascunhoCompleto(request)).offers.at(-1)!;
  expect(oferta.id).toMatch(/^oferta-\d+$/);
});

test("leigo: apagar oferta usada nos cards e no concierge não deixa nada escondido para trás", async ({ page, request }) => {
  const conc = arquivo.blocks.find((b) => b.type === "concierge") as unknown as Bloco | undefined;
  const cards = arquivo.blocks.find((b) => b.type === "cards") as unknown as Bloco | undefined;
  const alvo = conc?.flow?.[0]?.options.find((o) => o.offer && cards?.items?.includes(o.offer))?.offer;
  test.skip(!alvo || (arquivo.offers as Oferta[]).length < 2, "config sem oferta usada no concierge e nos cards");
  const titulo = (arquivo.offers as Oferta[]).find((o) => o.id === alvo)!.title;
  await entrar(page);

  await abrirSecao(page, "Ofertas");
  const item = page.locator(".a-conteudo .c-item").filter({ has: page.locator(".c-item-titulo", { hasText: titulo }) });
  await apagarItem(item);

  // Sobra só o que é escolha da pessoa: para onde a resposta da 1ª pergunta leva, dito em português.
  await expect(page.locator(".a-estado")).toHaveText(/campos? para corrigir/);
  const problemas = page.locator(".a-problemas li");
  await expect(problemas.first()).toContainText(`Uma resposta leva para a oferta "${alvo}", que foi apagada: escolha outra em "Leva para"`);
  expect(await problemas.count()).toBe(1);

  // O seletor mostra que a oferta sumiu (antes mostrava a primeira da lista, e escolhê-la não fazia nada).
  await abrirSecao(page, "Blocos");
  await blocoAberto(page, "Concierge").click();
  const seletor = page.locator(".k-passo").first().getByRole("combobox", { name: "Leva para" }).first();
  const idx = conc!.flow![0]!.options.findIndex((o) => o.offer === alvo);
  const doAlvo = page.locator(".k-passo").first().getByRole("combobox", { name: "Leva para" }).nth(idx);
  await expect(doAlvo.locator("option:checked")).toHaveText("Oferta apagada: escolha outra");
  await doAlvo.selectOption({ label: "Conversa no WhatsApp (sem oferta)" });
  await expect(page.locator(".a-estado")).toHaveText(/Rascunho salvo/);
  await expect(seletor).toBeVisible();

  const cfg = await doRascunho(request);
  expect(cfg.blocks.find((b) => b.type === "cards")!.items).not.toContain(alvo);
  expect(JSON.stringify(cfg.blocks)).not.toContain(`"offer":"${alvo}"`);
});

for (const [onde, largura] of [["no computador", 1280], ["no celular", 375]] as const) {
  test(`leigo ${onde}: monta a bio do zero pelo painel, publica e edita depois`, async ({ page, request }) => {
    test.slow();
    await page.setViewportSize({ width: largura, height: largura > 1000 ? 900 : 667 });
    await entrar(page);
    const c = page.locator(".a-conteudo");

    // Perfil e contato.
    await abrirSecao(page, "Perfil");
    await c.getByLabel("Nome").first().fill("Ana Leiga");
    await c.getByLabel("@ do perfil").fill("instagram.com/ana.leiga");
    await c.getByLabel("@ do perfil").press("Tab");
    await expect(c.getByLabel("@ do perfil")).toHaveValue("@ana.leiga");
    await c.getByLabel("Foto").fill("https://exemplo.com/ana.png");
    await abrirSecao(page, "Contato e site");
    await c.getByLabel("WhatsApp").fill("(11) 91234-5678"); // ficticio
    await c.getByLabel("WhatsApp").press("Tab");

    // Duas ofertas com preço em reais e capa.
    await abrirSecao(page, "Ofertas");
    const antigas = await c.locator(".c-item").count();
    for (const [titulo, preco] of [["Consulta", "R$ 97,00"], ["Mentoria", "1.290,50"]] as const) {
      await page.getByRole("button", { name: "Adicionar oferta" }).click();
      const item = c.locator(".c-item").last();
      await item.getByRole("textbox", { name: /^Título\s*(obrigatório)?$/ }).fill(titulo);
      await item.getByRole("textbox", { name: /^Descrição/ }).fill(`Sobre a ${titulo}.`);
      await item.getByLabel("Preço (R$)").fill(preco);
      await item.getByLabel("Preço (R$)").press("Tab");
      await item.getByRole("button", { name: "Adicionar capa" }).click();
      await item.getByLabel("Imagem").fill(`https://exemplo.com/${titulo.toLowerCase()}.png`);
    }

    // Tira todos os blocos do exemplo e depois as ofertas do exemplo.
    await abrirSecao(page, "Blocos");
    const blocos = page.locator(".s-lista > li");
    while ((await blocos.count()) > 0) await apagarBloco(blocos.first());
    await expect(page.locator(".a-problemas")).toContainText("A página precisa de pelo menos 1 bloco");
    await expect(page.getByRole("button", { name: "Publicar" })).toBeDisabled();
    await abrirSecao(page, "Ofertas");
    for (let k = 0; k < antigas; k += 1) {
      await apagarItem(c.locator(".c-item").first());
    }
    await expect(c.locator(".c-item")).toHaveCount(2);

    // Monta a página: perfil, concierge, ofertas, cupom, vídeo e links.
    await abrirSecao(page, "Blocos");
    for (const tipo of ["Perfil", "Concierge", "Ofertas", "Cupom", "Vídeo", "Grupo de links"]) await adicionarBloco(page, tipo);
    await page.locator(".s-bloco-corpo").getByLabel("Link", { exact: false }).last().fill("meusite.com.br/loja");
    await page.locator(".s-bloco-corpo").getByLabel("Link", { exact: false }).last().press("Tab");
    await blocoAberto(page, "Vídeo").click();
    await page.locator(".s-bloco-corpo").getByLabel("Link do vídeo no YouTube").fill("https://youtu.be/dQw4w9WgXcQ?si=abc");

    // Visual: outro modelo e outra cor.
    await abrirSecao(page, "Aparência");
    await page.getByRole("radiogroup", { name: "Modelo" }).getByRole("radio").filter({ hasText: "Noite" }).click();
    await c.getByLabel("Cor de destaque").fill("#ff5500");
    await expect(page.locator(".a-estado")).toHaveText(/Rascunho salvo/);

    await page.getByRole("button", { name: "Publicar" }).click();
    await expect(page.locator(".a-estado")).toHaveText("Tudo publicado");
    const publicada = maisNova(await estado(request)).config as unknown as ConfigCompleta;
    expect(publicada.profile.name).toBe("Ana Leiga");
    expect((publicada.profile as { handle?: string }).handle).toBe("@ana.leiga");
    expect(publicada.contact.whatsapp).toBe("5511912345678"); // ficticio
    expect(publicada.offers.map((o) => [o.title, o.price_cents, o.cover?.image])).toEqual([
      ["Consulta", 9700, "https://exemplo.com/consulta.png"],
      ["Mentoria", 129050, "https://exemplo.com/mentoria.png"],
    ]);
    expect(publicada.blocks.map((b) => b.type)).toEqual(["profile", "concierge", "cards", "coupon", "youtube", "links"]);
    expect(publicada.blocks[4]!.videoId).toBe("dQw4w9WgXcQ");
    expect(JSON.stringify(publicada.blocks[5])).toContain("https://meusite.com.br/loja");
    expect(publicada.theme.preset).toBe("noite");
    expect(publicada.theme.accent).toBe("#ff5500");

    // Editar depois: troca o título de uma oferta dentro do bloco de cards e publica de novo.
    await abrirSecao(page, "Blocos");
    await blocoAberto(page, "Ofertas").click();
    const card = page.locator(".k-cards .c-item").first();
    await card.locator(".c-item-titulo").click();
    await card.getByRole("textbox", { name: /^Título\s*(obrigatório)?$/ }).fill("Consulta de 1 hora");
    await expect(page.locator(".a-estado")).toHaveText(/Rascunho salvo/);
    await page.getByRole("button", { name: "Publicar" }).click();
    await expect(page.locator(".a-estado")).toHaveText("Tudo publicado");
    const depois = await estado(request);
    expect(depois.versoes).toHaveLength(2);
    expect((maisNova(depois).config as unknown as ConfigCompleta).offers[0]!.title).toBe("Consulta de 1 hora");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largura);
  });
}

test("fonte: dá para usar uma para os títulos e outra para o texto", async ({ page, request }) => {
  await entrar(page);
  await abrirSecao(page, "Aparência");
  await page.getByRole("radiogroup", { name: "Como usar a fonte" }).getByRole("radio", { name: "Títulos e texto separados" }).click();
  // Com o catálogo grande (18 fontes), o painel mostra uma lista suspensa em vez de botões.
  await page.getByRole("combobox", { name: /Fonte do texto/ }).selectOption({ label: "Inter" });
  await expect(page.locator(".a-estado")).toHaveText(/Rascunho salvo/);
  await expect.poll(async () => typeof (await rascunhoCompleto(request)).theme.font).toBe("object");
  const fonte = (await rascunhoCompleto(request)).theme.font as { display: string; body: string };
  expect(fonte.display).not.toBe(fonte.body);
  await page.getByRole("radiogroup", { name: "Como usar a fonte" }).getByRole("radio", { name: "Uma fonte para tudo" }).click();
  await expect.poll(async () => (await rascunhoCompleto(request)).theme.font).toBe(fonte.display);
});

/* ------------------------------------------------------------------------------------------------
 * Apagar pede confirmação, a ordem de etiquetas e produtos da vitrine muda, e a prévia do celular
 * fecha com Esc e com o voltar do Android.
 * ---------------------------------------------------------------------------------------------- */

test("apagar oferta, produto e depoimento pede confirmação antes", async ({ page }) => {
  await entrar(page);
  const c = page.locator(".a-conteudo");

  for (const [nome, frase] of [
    ["Ofertas", (t: string) => `Apagar a oferta "${t}"? Ela sai também dos cards.`],
    ["Vitrine", (t: string) => `Apagar o produto "${t}"? Ele sai também das vitrines.`],
  ] as const) {
    await abrirSecao(page, nome);
    const itens = c.locator(".c-item");
    if ((await itens.count()) === 0) await page.getByRole("button", { name: /^Adicionar / }).click();
    const antes = await itens.count();
    const primeiro = itens.first();
    const titulo = ((await primeiro.locator(".c-item-nome").textContent()) ?? "").trim();
    await primeiro.locator(".c-item-topo").first().getByRole("button", { name: "Remover", exact: true }).click();
    const pergunta = primeiro.getByRole("alertdialog", { name: "Confirmar exclusão" });
    await expect(pergunta).toContainText(frase(titulo));
    // Nada sumiu ainda: só a pergunta apareceu. Cancelar deixa tudo como estava.
    await expect(itens).toHaveCount(antes);
    await pergunta.getByRole("button", { name: "Cancelar" }).click();
    await expect(pergunta).toBeHidden();
    await expect(itens).toHaveCount(antes);
    await primeiro.locator(".c-item-topo").first().getByRole("button", { name: "Remover", exact: true }).click();
    await primeiro.getByRole("alertdialog").getByRole("button", { name: "Apagar" }).click();
    await expect(itens).toHaveCount(antes - 1);
  }

  // Depoimento, dentro do bloco: a pergunta cita quem deu o depoimento.
  await abrirSecao(page, "Blocos");
  await adicionarBloco(page, "Depoimentos");
  const corpo = page.locator(".s-bloco-corpo");
  const depoimentos = corpo.locator(".c-item");
  await expect(depoimentos).toHaveCount(1);
  await depoimentos.first().getByRole("textbox", { name: /^Nome/ }).fill("Joana Teste");
  await depoimentos.first().locator(".c-item-topo").getByRole("button", { name: "Remover", exact: true }).click();
  await expect(depoimentos.first().getByRole("alertdialog")).toContainText("Apagar o depoimento de Joana Teste?");
  await expect(depoimentos).toHaveCount(1);
  await depoimentos.first().getByRole("alertdialog").getByRole("button", { name: "Apagar" }).click();
  await expect(depoimentos).toHaveCount(0);

  // Bloco: já pedia confirmação, com a saída de só esconder.
  await (await abrirMenu(page.locator(".s-lista > li").last())).getByRole("menuitem", { name: "Apagar" }).click();
  await expect(page.locator(".s-confirmar")).toContainText('Apagar o bloco "Depoimentos"? Para só esconder, use a chave ao lado.');
});

test("etiquetas do perfil mudam de ordem", async ({ page, request }) => {
  await entrar(page);
  await abrirSecao(page, "Perfil");
  const etiquetas = page.locator(".a-conteudo .c-etiqueta");
  const campo = page.locator(".a-conteudo .c-etiqueta-input");
  // Só as duas do teste, para não depender das etiquetas do exemplo.
  while ((await etiquetas.count()) > 0) await etiquetas.first().getByRole("button", { name: /^Remover / }).click();
  for (const t of ["Primeira", "Segunda"]) {
    await campo.fill(t);
    await campo.press("Enter");
  }
  await expect(etiquetas).toHaveText(["Primeira", "Segunda"]);
  await expect(page.getByRole("button", { name: "Mover Primeira para antes" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Mover Segunda para depois" })).toBeDisabled();
  await page.getByRole("button", { name: "Mover Segunda para antes" }).click();
  await expect(etiquetas).toHaveText(["Segunda", "Primeira"]);
  const tags = async () => ((await estado(request)).rascunhos[0]?.config.profile as { tags?: string[] } | undefined)?.tags;
  await expect.poll(tags).toEqual(["Segunda", "Primeira"]);
  await page.getByRole("button", { name: "Mover Segunda para depois" }).click();
  await expect.poll(tags).toEqual(["Primeira", "Segunda"]);
});

test("produtos de uma vitrine mudam de ordem", async ({ page, request }) => {
  await entrar(page);
  await abrirSecao(page, "Blocos");
  await adicionarBloco(page, "Vitrine");
  const corpo = page.locator(".s-bloco-corpo");
  const pilulas = corpo.locator(".c-pilula");
  test.skip((await pilulas.count()) < 2, "config com menos de 2 produtos na vitrine");
  const [a, b] = [((await pilulas.nth(0).textContent()) ?? "").trim(), ((await pilulas.nth(1).textContent()) ?? "").trim()];
  await pilulas.nth(0).click();
  await pilulas.nth(1).click();
  const ordem = corpo.getByRole("list", { name: "Ordem na vitrine" });
  await expect(ordem.getByRole("listitem")).toHaveText([a, b]);
  await ordem.getByRole("button", { name: `Descer ${a}` }).click();
  await expect(ordem.getByRole("listitem")).toHaveText([b, a]);
  const itens = async () => ((await estado(request)).rascunhos[0]?.config.blocks.at(-1) as { items?: string[] } | undefined)?.items;
  await expect.poll(async () => (await itens())?.length).toBe(2);
  const [idA, idB] = (await itens())!.slice().reverse();
  await ordem.getByRole("button", { name: `Subir ${a}` }).click();
  await expect.poll(itens).toEqual([idA, idB]);
});

test("celular: a prévia fecha com Esc, com o voltar do aparelho e pelo botão, sem sair do painel", async ({ page }) => {
  await entrar(page);
  // Chega ao painel vindo da bio: o voltar "de sempre" tem para onde ir (a bio), fora do painel.
  await page.goto("/");
  await page.goto("/admin");
  await expect(page.getByRole("navigation", { name: "Seções" })).toBeVisible();
  const previa = page.locator(".a-previa");
  const abrir = () => page.getByRole("button", { name: "Ver prévia" }).click();

  await abrir();
  await expect(previa).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(previa).toBeHidden();

  // Voltar do Android: fecha a prévia e continua no painel.
  await abrir();
  await expect(previa).toBeVisible();
  await page.goBack();
  await expect(previa).toBeHidden();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("navigation", { name: "Seções" })).toBeVisible();

  // Fechar pelo botão desfaz a entrada que a prévia pôs no histórico: nada sobra para o voltar.
  await abrir();
  await page.getByRole("button", { name: "Fechar prévia" }).click();
  await expect(previa).toBeHidden();
  await expect.poll(() => page.evaluate(() => Boolean((history.state as { previa?: boolean } | null)?.previa))).toBe(false);

  // Com a prévia fechada, voltar é o voltar de sempre: sai do painel e volta para a bio.
  await page.goBack();
  await expect(page).toHaveURL(/:\d+\/$/);
});

/* ------------------------------------------------------------------------------------------------
 * UI/UX no computador: ordem dos botões, indicadores de como alterar e o problema que leva ao campo.
 * ---------------------------------------------------------------------------------------------- */

test("computador: Descartar antes de Publicar, e a confirmação põe o Cancelar entre os dois", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await entrar(page);
  await abrirSecao(page, "Perfil");
  await page.locator(".a-cartao input[type=text]").first().fill("Outro nome");
  await expect(page.locator(".a-estado")).toHaveText(/Rascunho salvo/);

  const x = async (l: Locator) => (await l.boundingBox())!.x;
  const publicar = page.getByRole("button", { name: "Publicar" });
  const descartar = page.getByRole("button", { name: "Descartar" });
  // Publicar é sempre o último à direita; o estado vem antes de tudo.
  expect(await x(page.locator(".a-estado"))).toBeLessThan(await x(descartar));
  expect(await x(descartar)).toBeLessThan(await x(publicar));
  await expect(descartar).toHaveAttribute("title", /volta ao que está no ar/);

  await descartar.click();
  const confirmar = page.getByRole("alertdialog", { name: "Confirmar descarte" });
  await expect(confirmar).toContainText("Voltar tudo ao que está no ar?");
  const cancelar = confirmar.getByRole("button", { name: "Cancelar" });
  const sim = confirmar.getByRole("button", { name: "Descartar" });
  // O botão vermelho fica longe do Publicar: Cancelar no meio.
  expect(await x(cancelar)).toBeLessThan(await x(sim));
  expect(await x(sim)).toBeLessThan(await x(publicar));
  await cancelar.click();
  await expect(confirmar).toHaveCount(0);
});

test("computador: cada seção e cada bloco aberto dizem o que são e onde aparecem", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await entrar(page);
  await expect(page.locator(".a-cabecalho p")).toContainText("na ordem em que aparece");

  // A linha do bloco avisa que abre e diz se está na bio; aberta, explica o bloco numa linha.
  const primeiro = page.locator(".s-lista > li").first();
  await expect(primeiro.locator(".s-bloco-seta")).toBeVisible();
  await expect(primeiro.locator(".s-bloco-visivel")).toHaveText("Na bio");
  await primeiro.getByRole("switch").click();
  await expect(primeiro.locator(".s-bloco-visivel")).toHaveText("Escondido");
  await primeiro.getByRole("switch").click();
  await expect(primeiro.locator(".s-bloco-visivel")).toHaveText("Na bio");
  await primeiro.locator(".s-bloco-nome").click();
  await expect(primeiro.locator(".s-bloco-ajuda")).toBeVisible();
  // O menu "..." diz ao passar o mouse o que tem dentro.
  await expect(primeiro.getByRole("button", { name: /^Mais ações/ })).toHaveAttribute("title", "Mais ações: subir, descer, duplicar, apagar");

  await abrirSecao(page, "Perfil");
  await expect(page.locator(".a-cabecalho p")).toContainText("O topo da bio");
  await expect(page.locator(".a-cartao")).toContainText("Aparece em destaque no topo da bio.");

  await abrirSecao(page, "Contato e site");
  await expect(page.locator(".a-cartao")).toContainText("Recebe as mensagens de todos os botões de WhatsApp da bio.");
});

test("computador: tocar num problema abre o bloco certo e leva ao campo", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await entrar(page);
  await adicionarBloco(page, "Vídeo");
  // Bloco novo só mostra o que falta depois de tentar publicar (ou de sair do campo).
  await expect(page.locator(".a-estado")).toHaveText("Falta preencher 1 campo");
  await page.getByRole("button", { name: "Publicar" }).click();
  await expect(page.locator(".a-estado")).toHaveText(/campo para corrigir/);
  // Só o bloco com erro fica vermelho (antes o erro do bloco 14 acendia também o bloco 1).
  const comErro = page.locator(".s-lista > li.c-com-erro");
  await expect(comErro).toHaveCount(1);
  await expect(comErro).toContainText("Vídeo");

  // Fecha o bloco e vai para outra seção: o link do problema traz de volta, aberto, com o campo em foco.
  await page.locator(".s-lista > li").last().locator(".s-bloco-nome").click();
  await abrirSecao(page, "Perfil");
  await page.locator(".a-problemas").getByRole("button", { name: /Vídeo/ }).click();
  await expect(page.locator(".a-cabecalho h1")).toHaveText("Blocos");
  await expect(page.locator(".s-lista > li").last()).toHaveClass(/s-aberto/);
  await expect.poll(() => page.evaluate(() => document.activeElement?.closest(".c-campo")?.textContent ?? "")).toContain("Link do vídeo no YouTube");
});

test("computador estreito (1024 px): a prévia continua ao lado do conteúdo", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await entrar(page);
  await expect(page.locator(".a-previa")).toBeVisible();
  await expect(page.locator(".a-botao-previa")).toBeHidden();
  const conteudo = (await page.locator(".a-conteudo").boundingBox())!;
  const previa = (await page.locator(".a-previa").boundingBox())!;
  expect(previa.x).toBeGreaterThanOrEqual(conteudo.x + conteudo.width);
  // Nada estoura a largura.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1024);
});

test("listas: botão de adicionar no singular e item fechado mostra o preço", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await entrar(page);
  await abrirSecao(page, "Ofertas");
  await expect(page.getByRole("button", { name: "Adicionar oferta", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Adicionar oferta", exact: true }).click();
  const nova = page.locator(".a-conteudo .c-item").last();
  await nova.getByLabel(/^Preço/).fill("1.290,50");
  await nova.getByLabel(/^Preço/).blur();
  await expect(nova.locator(".c-item-resumo")).toHaveText("R$ 1.290,50");
  await abrirSecao(page, "Perfil");
  await expect(page.getByRole("button", { name: "Adicionar rede", exact: true })).toBeVisible();
});

/* ------------------------------------------------------------------------------------------------
 * Lista de blocos limpa (menu "...", arrastar, teclado), oferta em grupos e bloco novo sem vermelho.
 * ---------------------------------------------------------------------------------------------- */

const tiposNoRascunho = async (request: APIRequestContext) => (await estado(request)).rascunhos[0]?.config.blocks.map((b) => b.type);
const tiposDoArquivo = () => arquivo.blocks.map((b) => b.type as string);
const nomesNaLista = (page: Page) => page.locator(".s-lista > li .s-bloco-nome strong").allInnerTexts();
/** Abre o menu "..." de um bloco. */
async function abrirMenu(bloco: Locator) {
  await bloco.getByRole("button", { name: /^Mais ações/ }).click();
  const menu = bloco.getByRole("menu");
  await expect(menu).toBeVisible();
  return menu;
}

test("lista de blocos: na linha só alça, nome, chave e o menu ...; Subir, Descer, Esc e Apagar", async ({ page, request }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await entrar(page);
  const blocos = page.locator(".s-lista > li");
  const ordem = await nomesNaLista(page);
  expect(ordem.length).toBeGreaterThan(2);

  // A linha não tem mais Subir, Descer, Duplicar nem Apagar soltos: estão no menu.
  const linha = blocos.nth(1);
  for (const nome of ["Subir", "Descer", "Duplicar", "Apagar"]) await expect(linha.getByRole("button", { name: nome, exact: true })).toHaveCount(0);
  await expect(linha.locator(".s-alca")).toBeVisible();
  await expect(linha.getByRole("switch")).toBeVisible();
  await expect(linha.locator(".s-bloco-visivel")).toHaveText(/Na bio|Escondido/);

  // Abre com o foco no primeiro item; Esc fecha e devolve o foco ao botão.
  const botao = linha.getByRole("button", { name: /^Mais ações/ });
  let menu = await abrirMenu(linha);
  await expect(menu.getByRole("menuitem")).toHaveText(["Subir", "Descer", "Duplicar", "Apagar"]);
  await expect(menu.getByRole("menuitem", { name: "Subir" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitem", { name: "Descer" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(botao).toBeFocused();

  // Clique fora fecha.
  menu = await abrirMenu(linha);
  await page.locator(".a-cabecalho h1").click();
  await expect(menu).toBeHidden();

  // Subir e Descer mudam a ordem na tela e no rascunho.
  await (await abrirMenu(linha)).getByRole("menuitem", { name: "Subir" }).click();
  expect(await nomesNaLista(page)).toEqual([ordem[1], ordem[0], ...ordem.slice(2)]);
  const trocados = tiposDoArquivo();
  [trocados[0], trocados[1]] = [trocados[1]!, trocados[0]!];
  await expect.poll(() => tiposNoRascunho(request)).toEqual(trocados);
  // O foco segue o bloco para a posição nova.
  await expect(blocos.nth(0).getByRole("button", { name: /^Mais ações/ })).toBeFocused();
  await (await abrirMenu(blocos.nth(0))).getByRole("menuitem", { name: "Descer" }).click();
  expect(await nomesNaLista(page)).toEqual(ordem);
  await expect.poll(() => tiposNoRascunho(request)).toEqual(tiposDoArquivo());

  // Nas pontas, o item que não tem para onde ir fica desabilitado.
  menu = await abrirMenu(blocos.first());
  await expect(menu.getByRole("menuitem", { name: "Subir" })).toBeDisabled();
  await page.keyboard.press("Escape");
  menu = await abrirMenu(blocos.last());
  await expect(menu.getByRole("menuitem", { name: "Descer" })).toBeDisabled();

  // Apagar, separado no fim e em vermelho, ainda pede confirmação.
  await expect(menu.locator(".s-menu-perigo")).toHaveText("Apagar");
  await menu.getByRole("menuitem", { name: "Apagar" }).click();
  const pergunta = blocos.last().getByRole("alertdialog", { name: "Confirmar exclusão" });
  await expect(pergunta).toBeVisible();
  await pergunta.getByRole("button", { name: "Cancelar" }).click();
  await expect(blocos).toHaveCount(ordem.length);
});

test("lista de blocos: arrastar pela alça muda a ordem e vai para o rascunho", async ({ page, request }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await entrar(page);
  const blocos = page.locator(".s-lista > li");
  const ordem = await nomesNaLista(page);
  const alca = (await blocos.nth(0).locator(".s-alca").boundingBox())!;
  const destino = (await blocos.nth(2).boundingBox())!;

  // Leva o primeiro bloco para baixo do terceiro, em passos, como a mão faz.
  await page.mouse.move(alca.x + alca.width / 2, alca.y + alca.height / 2);
  await page.mouse.down();
  await page.mouse.move(alca.x + alca.width / 2, destino.y + destino.height * 0.8, { steps: 12 });
  await expect(blocos.nth(0)).toHaveClass(/s-arrastando/);
  await page.mouse.up();

  expect(await nomesNaLista(page)).toEqual([ordem[1], ordem[2], ordem[0], ...ordem.slice(3)]);
  const t = tiposDoArquivo();
  await expect.poll(() => tiposNoRascunho(request)).toEqual([t[1], t[2], t[0], ...t.slice(3)]);
  await expect(page.locator(".a-estado")).toHaveText(/Rascunho salvo/);
  await expect(page.locator(".s-arrastando")).toHaveCount(0);
});

test("lista de blocos: pelo teclado, setas na alça e Alt + setas no nome, com a posição anunciada", async ({ page, request }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await entrar(page);
  const blocos = page.locator(".s-lista > li");
  const ordem = await nomesNaLista(page);

  await blocos.nth(0).locator(".s-alca").focus();
  await page.keyboard.press("ArrowDown");
  expect(await nomesNaLista(page)).toEqual([ordem[1], ordem[0], ...ordem.slice(2)]);
  await expect(blocos.nth(1).locator(".s-alca")).toBeFocused();
  await expect(page.locator('.s-blocos [aria-live="polite"]')).toHaveText(`${ordem[0]} agora na posição 2 de ${ordem.length}.`);
  const t = tiposDoArquivo();
  await expect.poll(() => tiposNoRascunho(request)).toEqual([t[1], t[0], ...t.slice(2)]);

  // Alt + seta para cima no nome do bloco: volta, e o foco continua no nome dele.
  await blocos.nth(1).locator(".s-bloco-nome").focus();
  await page.keyboard.press("Alt+ArrowUp");
  expect(await nomesNaLista(page)).toEqual(ordem);
  await expect(blocos.nth(0).locator(".s-bloco-nome")).toBeFocused();
  await expect.poll(() => tiposNoRascunho(request)).toEqual(t);
});

test("oferta e produto: campos em grupos com título, na ordem do card", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await entrar(page);
  await abrirSecao(page, "Ofertas");
  await page.getByRole("button", { name: "Adicionar oferta", exact: true }).click();
  const oferta = page.locator(".a-conteudo .c-item").last();
  await expect(oferta.locator(".c-secao-titulo")).toHaveText(["Texto", "Preço", "Botão e destino", "Capa"]);
  const texto = oferta.getByRole("group", { name: "Texto" });
  await expect(texto.getByRole("textbox", { name: /^Título/ })).toBeVisible();
  await expect(texto.getByRole("textbox", { name: /^Descrição/ })).toBeVisible();
  // A dica de onde aparece continua embaixo do campo.
  await expect(texto).toContainText("Nome da oferta no card e no final do Concierge.");
  await expect(oferta.getByRole("group", { name: "Preço" }).getByLabel("Preço (R$)")).toBeVisible();
  const destino = oferta.getByRole("group", { name: "Botão e destino" });
  for (const nome of [/^Link/, /^Mensagem do WhatsApp/, /^Texto do botão/]) await expect(destino.getByRole("textbox", { name: nome })).toBeVisible();
  await expect(oferta.getByRole("group", { name: "Capa" }).getByRole("button", { name: "Adicionar capa" })).toBeVisible();
  // O identificador segue em Avançado, depois dos grupos.
  await expect(oferta.locator(".c-avancado > summary")).toHaveText("Avançado");

  await abrirSecao(page, "Vitrine");
  await page.getByRole("button", { name: "Adicionar produto", exact: true }).click();
  const produto = page.locator(".a-conteudo .c-item").last();
  await expect(produto.locator(".c-secao-titulo")).toHaveText(["Texto", "Preço", "Botão e destino", "Foto"]);
  await expect(produto.getByRole("group", { name: "Botão e destino" }).getByRole("textbox", { name: /^Link/ })).toBeVisible();
});

test("bloco novo: sem vermelho até sair do campo; Publicar mostra o que falta preencher", async ({ page, request }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await entrar(page);
  const versoesAntes = (await estado(request)).versoes.length;
  const estadoTela = page.locator(".a-estado");

  // Vídeo novo: campo obrigatório vazio, mas nada vermelho enquanto a pessoa não passou por ele.
  await adicionarBloco(page, "Vídeo");
  await expect(estadoTela).toHaveText("Falta preencher 1 campo");
  await expect(page.locator(".c-erro")).toHaveCount(0);
  await expect(page.locator(".s-lista > li.c-com-erro")).toHaveCount(0);
  await expect(page.locator(".a-problemas")).toHaveCount(0);
  await expect(secao(page, "Blocos").locator(".a-ponto-erro")).toHaveCount(0);

  // Sair do campo vazio: agora sim, o campo avisa (e a dica de como preencher continua).
  const video = page.locator(".s-bloco-corpo").getByLabel("Link do vídeo no YouTube");
  await video.focus();
  await video.press("Tab");
  const campoVideo = page.locator(".c-campo.c-com-erro").filter({ has: page.getByLabel("Link do vídeo no YouTube") });
  await expect(campoVideo).toContainText("Falta preencher.");
  await expect(campoVideo).toContainText("Cole o link inteiro do vídeo");
  await expect(estadoTela).toHaveText("1 campo para corrigir");

  // Link novo: nasce com "https://", que não conta como erro enquanto não for tocado.
  await adicionarBloco(page, "Link");
  await expect(page.locator(".s-lista > li").last()).not.toHaveClass(/c-com-erro/);
  await expect(page.locator(".s-lista > li.c-com-erro")).toHaveCount(1);

  // Publicar não publica: mostra tudo o que falta, dizendo "falta preencher".
  const publicar = page.getByRole("button", { name: "Publicar" });
  await expect(publicar).toBeEnabled();
  await publicar.click();
  const lista = page.locator(".a-problemas");
  await expect(lista).toContainText("Falta preencher para publicar");
  await expect(lista.locator("li")).toHaveText(["Blocos › Vídeo › Link do vídeo no YouTube: falta preencher", "Blocos › Link › Link: falta preencher"]);
  await expect(page.locator(".s-lista > li.c-com-erro")).toHaveCount(2);
  await expect(estadoTela).toHaveText("2 campos para corrigir");
  await expect(publicar).toBeDisabled();
  expect((await estado(request)).versoes.length).toBe(versoesAntes);
});

// ---------------------------------------------------------------- auditoria do painel (v0.4.x)

test("auditoria: escolher Cantos muda os cantos da bio mesmo com o raio em px antigo", async ({ page, request }) => {
  await entrar(page);
  const quadro = await esperarQuadro(page);
  const raio = () => quadro.locator("html").evaluate((h) => getComputedStyle(h).getPropertyValue("--radius").trim());
  await abrirSecao(page, "Aparência");
  const c = page.locator(".a-conteudo");
  // O raio em px antigo (theme.radius, em Avançado) passava por cima de Cantos: a escolha não mudava nada.
  await c.locator("details.c-avancado > summary").click();
  await c.getByLabel("Cantos em px (substitui Cantos)").fill("6");
  await expect(page.locator(".a-estado")).toHaveText(/Rascunho salvo|Tudo publicado/);
  await expect.poll(raio).toBe("6px");

  await c.getByRole("radiogroup", { name: "Cantos" }).getByRole("radio", { name: "Retos" }).click();
  await expect.poll(raio).toBe("4px");
  await expect(c.getByLabel("Cantos em px (substitui Cantos)")).toHaveValue("");
  await expect.poll(async () => (await estado(request)).rascunhos[0]?.config.theme).toMatchObject({ corners: "reto" });
  expect((await estado(request)).rascunhos[0]!.config.theme.radius).toBeUndefined();
  await c.getByRole("radiogroup", { name: "Cantos" }).getByRole("radio", { name: "Redondos" }).click();
  await expect.poll(raio).not.toBe("4px");
});

test("auditoria: título e texto do link aparecem inteiros, sem quebra de linha e com contador", async ({ page, request }) => {
  await entrar(page);
  await abrirSecao(page, "Contato e site");
  const c = page.locator(".a-conteudo");
  await c.getByRole("button", { name: "Adicionar capa ao compartilhar" }).click();
  const titulo = c.getByLabel("Título do link");
  const texto = c.getByLabel("Texto do link");
  // Caixa de várias linhas: numa linha só, o texto do link (até 200 letras) ficava cortado e não dava para revisar.
  await expect(texto).toHaveJSProperty("tagName", "TEXTAREA");
  await expect(titulo).toHaveJSProperty("tagName", "TEXTAREA");
  const longo = "Você pode desenvolver a capacidade de criar por dentro ou colocar a nossa equipe para construir por você";
  const espaco = longo.indexOf(" ", 35);
  // Enter no meio (no lugar de um espaço) vira espaço: o cartão do link é uma linha corrida.
  await texto.fill(`${longo.slice(0, espaco)}\n${longo.slice(espaco + 1)}`);
  await titulo.fill("IA para o seu negócio");
  await expect(texto).toHaveValue(longo);
  expect(await texto.evaluate((e) => e.scrollHeight <= e.clientHeight + 1)).toBe(true);
  await expect(c.getByText(`${longo.length} de 200 caracteres`)).toBeVisible();
  await expect(c.getByText("21 de 70 caracteres")).toBeVisible();
  await expect.poll(async () => (await estado(request)).rascunhos[0]?.config.site.share).toEqual({ title: "IA para o seu negócio", description: longo });
});

test("auditoria: galeria sem imagem e rede sem link dizem o que falta em português, com o nome da rede", async ({ page }) => {
  await entrar(page);
  await adicionarBloco(page, "Galeria");
  await adicionarBloco(page, "Redes em linha");
  await expect(page.locator(".a-estado")).toHaveText(/Falta preencher/);
  await revelarProblemas(page);
  const problemas = page.locator(".a-problemas");
  await expect(problemas).toContainText("Blocos › Galeria › Imagens: Adicione ao menos 1 imagem.");
  await expect(problemas).toContainText('Blocos › Redes em linha › Itens › "Instagram" › Link: falta preencher');
  await expect(problemas).not.toContainText("gallery");
});

test("auditoria: Vitrine sem produto diz o que fazer, como Ofertas", async ({ page }) => {
  await entrar(page);
  await abrirSecao(page, "Vitrine");
  const c = page.locator(".a-conteudo");
  for (let n = await c.locator(".c-itens > .c-item").count(); n > 0; n -= 1) await apagarItem(c.locator(".c-itens > .c-item").first());
  await expect(c.locator(".a-vazio")).toHaveText("Nenhum produto ainda: crie um aqui. Depois, ele aparece na bio pelo bloco Vitrine.");
  await c.getByRole("button", { name: "Adicionar produto" }).click();
  await expect(c.locator(".a-vazio")).toHaveCount(0);
});

/* ------------------------------------------------------------------------------------------------
 * v0.5.0, teste do Nicolas como mentorado: a prévia deixava o botão final do concierge sem ação, e
 * trocar de modelo deixava a paleta da versão que o modelo novo não tem (Publicar travava).
 * ---------------------------------------------------------------------------------------------- */

test("prévia: o botão final do concierge abre o destino numa aba nova", async ({ page }) => {
  await entrar(page);
  await esperarQuadro(page);
  // A prévia troca entre dois quadros para não piscar: usa o visível.
  const quadro = (await (await page.locator(".a-previa iframe.p-visivel").elementHandle())!.contentFrame())!;
  // Clique simulado não conta como gesto (o bloqueador de pop-up do navegador de teste barraria a aba):
  // confere o pedido de abrir, que é o que a correção faz.
  await quadro.evaluate(() => {
    const w = window as unknown as { __abertos: string[]; open: (u?: string | URL) => null };
    w.__abertos = [];
    w.open = (u) => (w.__abertos.push(String(u)), null);
  });
  const cc = quadro.getByTestId("concierge").first();
  await expect(cc).toHaveAttribute("data-pronto", "true");
  // A prévia é uma miniatura com recorte: o clique vai direto no elemento (o que se testa é o efeito dele).
  const abrir = cc.locator("button[aria-expanded='false']");
  if (await abrir.count()) await abrir.first().dispatchEvent("click");
  for (let i = 0; i < 6 && (await cc.getByTestId("cc-recomendacao").count()) === 0; i++) {
    await cc.getByTestId(/cc-chip-/).first().dispatchEvent("click");
  }
  await expect(cc.getByTestId("cc-recomendacao")).toHaveCount(1);
  const destino = await cc.getByTestId("cc-cta").getAttribute("href");
  await cc.getByTestId("cc-cta").dispatchEvent("click");
  const abertos = await quadro.evaluate(() => (window as unknown as { __abertos: string[] }).__abertos);
  expect(abertos).toHaveLength(1);
  expect(abertos[0]).toBe(new URL(destino!, quadro.url()).toString());
  expect(abertos[0]).not.toContain("/admin-previa");
});

test("trocar para um modelo só claro tira a paleta escura e Publicar não trava", async ({ page, request }) => {
  const base = JSON.parse(JSON.stringify(arquivo)) as { theme: Record<string, unknown> };
  base.theme = { preset: "noite", accent: "#f59e0b", palette: { escuro: { bg: "#0b1120", text: "#f1f5f9" } } };
  const semeou = await request.post(`${URL_FALSA}/rest/v1/site_config`, { headers: { ...cabecalho, "Content-Type": "application/json" }, data: { config: base, created_by: null, nota: null } });
  expect(semeou.ok()).toBe(true);
  await entrar(page);
  await abrirSecao(page, "Aparência");
  await page.getByRole("radiogroup", { name: "Modelo" }).getByRole("radio", { name: /Editorial/ }).click();
  await expect(page.locator(".a-estado")).toHaveText(/Rascunho salvo/);
  const tema = (await estado(request)).rascunhos[0]!.config.theme as Record<string, unknown>;
  expect(tema.preset).toBe("editorial");
  expect(tema.palette).toBeUndefined();
  expect(tema.accent).toBe("#f59e0b");
  await page.getByRole("button", { name: "Publicar" }).click();
  await expect(page.getByText("Corrija para publicar")).toHaveCount(0);
  await expect.poll(async () => (maisNova(await estado(request)).config.theme as Record<string, unknown>).preset).toBe("editorial");
  // A versão publicada aqui troca o visual da bio: limpa para os testes seguintes lerem o arquivo.
  await limpar(request);
});

test("Pix: chave com pontuação vira dígitos e o valor em reais vira centavos", async ({ page, request }) => {
  await entrar(page);
  await abrirSecao(page, "Blocos");
  await adicionarBloco(page, "Pix");
  const corpo = page.locator(".s-lista > li").last();
  await corpo.getByLabel("Chave Pix").fill("(11) 98888-7777"); // ficticio
  await corpo.getByLabel("Chave Pix").blur();
  await corpo.getByLabel("Nome de quem recebe").fill("José da Silva");
  await corpo.getByLabel("Valor (R$)").fill("49,90");
  await corpo.getByLabel("Valor (R$)").press("Tab");
  await expect(page.locator(".a-estado")).toHaveText(/Rascunho salvo/);
  const blocos = (await estado(request)).rascunhos[0]!.config.blocks as {
    type: string;
    chave?: string;
    nome?: string;
    valor_cents?: number;
  }[];
  const pix = [...blocos].reverse().find((b) => b.type === "pix");
  expect(pix?.chave).toBe("+5511988887777"); // ficticio
  expect(pix?.nome).toBe("José da Silva");
  expect(pix?.valor_cents).toBe(4990);
});

test("Agenda: evento novo já nasce com data e identificador", async ({ page, request }) => {
  await entrar(page);
  await abrirSecao(page, "Blocos");
  await adicionarBloco(page, "Agenda");
  const corpo = page.locator(".s-lista > li").last();
  await corpo.getByRole("button", { name: "Adicionar evento" }).click();
  await expect(page.locator(".a-estado")).toHaveText(/Rascunho salvo/);
  const blocos = (await estado(request)).rascunhos[0]!.config.blocks as {
    type: string;
    items?: { id: string; title: string; date: string }[];
  }[];
  const agenda = [...blocos].reverse().find((b) => b.type === "agenda");
  expect(agenda?.items).toHaveLength(2);
  expect(new Set(agenda?.items?.map((ev) => ev.id)).size).toBe(2);
  expect(agenda?.items?.[1]?.id).toMatch(/^evento-\d+$/);
  expect(agenda?.items?.[1]).toMatchObject({ title: "Encontro", date: "2099-12-31" });
});
