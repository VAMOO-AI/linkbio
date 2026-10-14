import { devices, expect, test, type Page } from "@playwright/test";
import arquivo from "../linkbio.config";
import { URL_APP } from "./painel-ambiente";

type OpcaoConcierge = { id: string; label: string; offer?: string; reason?: string };
type BlocoConcierge = { type: "concierge"; decide?: string; flow: { id: string; options: OpcaoConcierge[] }[] };

// F1 — concierge em modo roteiro, renderizado inline na página
// (sem diálogo, sem input livre: pergunta → chips → recomendação + CTA).

async function semOverflowHorizontal(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
  });
  expect(
    overflow.scrollWidth,
    `overflow horizontal: scrollWidth=${overflow.scrollWidth} > clientWidth=${overflow.clientWidth}`,
  ).toBeLessThanOrEqual(overflow.clientWidth);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  // Clique antes da hidratação se perde (visto no Firefox): espera a ilha do concierge ficar pronta.
  await expect(page.getByTestId("concierge").first()).toHaveAttribute("data-pronto", "true");
});

test("página sem overflow horizontal em 375px", async ({ page }) => {
  await semOverflowHorizontal(page);
});

test("concierge roteiro: responde chips até recomendação com CTA", async ({
  page,
}) => {
  const concierge = page.getByTestId("concierge").first();
  await expect(concierge).toBeVisible();

  // Avança no máximo 10 passos clicando no primeiro chip disponível.
  for (let i = 0; i < 10; i++) {
    const chips = concierge.getByTestId(/cc-chip-/);
    if ((await chips.count()) === 0) break;
    await chips.first().click();
  }

  const recomendacao = concierge.getByTestId("cc-recomendacao");
  await expect(recomendacao).toBeVisible();
  const cta = concierge.getByTestId("cc-cta");
  await expect(cta).toBeVisible();
  const href = await cta.getAttribute("href");
  expect(href, "CTA do concierge aponta para URL válida").toMatch(
    /^(https:\/\/|https:\/\/wa\.me\/)/,
  );
  await semOverflowHorizontal(page);
});

test("concierge: refazer volta ao primeiro passo", async ({ page }) => {
  const concierge = page.getByTestId("concierge").first();
  await expect(concierge).toBeVisible();

  for (let i = 0; i < 10; i++) {
    const chips = concierge.getByTestId(/cc-chip-/);
    if ((await chips.count()) === 0) break;
    await chips.first().click();
  }
  await expect(concierge.getByTestId("cc-recomendacao")).toBeVisible();

  await concierge.getByRole("button", { name: /recomeçar/i }).click();
  await expect(concierge.getByTestId(/cc-chip-/).first()).toBeVisible();
});

test("concierge: resposta sem oferta leva direto à conversa no WhatsApp", async ({ page }) => {
  const concierge = page.getByTestId("concierge").first();
  const semOferta = concierge.getByTestId("cc-chip-nao-sei");
  test.skip((await semOferta.count()) === 0, "config sem resposta nao-sei no primeiro passo");
  await semOferta.click();
  for (let i = 0; i < 10; i++) {
    const chips = concierge.getByTestId(/cc-chip-/);
    if ((await chips.count()) === 0) break;
    await chips.first().click();
  }
  await expect(concierge.getByTestId("cc-recomendacao")).toBeVisible();
  const href = (await concierge.getByTestId("cc-cta").getAttribute("href")) ?? "";
  expect(href).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
  expect(decodeURIComponent(href)).toContain("Vim pelo concierge: Ainda não sei");
  await semOverflowHorizontal(page);
});

// Bio do arquivo (sem `decide`): vale o modo "primeira", o de sempre. A 1ª resposta decide o final,
// mesmo quando a resposta da pergunta seguinte tem oferta e explicação próprias.
test("concierge: sem `decide`, a 1ª pergunta decide o final e as outras viram contexto", async ({ page }) => {
  const bloco = arquivo.blocks.find((b) => b.type === "concierge") as unknown as BlocoConcierge | undefined;
  test.skip(!bloco || bloco.decide !== undefined || bloco.flow.length < 2, "config sem concierge de 2 perguntas no modo padrão");
  const primeira = bloco!.flow[0]!.options.find((o) => o.offer)!;
  const outra = bloco!.flow[1]!.options.find((o) => o.offer && o.offer !== primeira.offer) ?? bloco!.flow[1]!.options[0]!;
  test.skip(!primeira, "1ª pergunta sem oferta");
  const concierge = page.getByTestId("concierge").first();
  await concierge.getByTestId(`cc-chip-${primeira.id}`).click();
  await concierge.getByTestId(`cc-chip-${outra.id}`).click();
  for (let i = 2; i < bloco!.flow.length; i++) await concierge.getByTestId(/cc-chip-/).first().click();
  const titulo = arquivo.offers.find((o) => o.id === primeira.offer)!.title;
  await expect(concierge.locator(".concierge-oferta")).toHaveText(titulo);
  await expect(concierge.locator(".concierge-motivo")).toHaveText(primeira.reason!);
});

// A mensagem do WhatsApp leva as respostas numa linha própria, ANTES do texto-modelo: o modelo pode
// terminar em campos para preencher ("O principal gargalo:"), e o cursor do WhatsApp fica no fim.
test("concierge: o contexto vai na 1ª linha da mensagem, separado do texto por uma linha em branco", async ({ page }) => {
  const concierge = page.getByTestId("concierge").first();
  const semOferta = concierge.getByTestId("cc-chip-nao-sei");
  test.skip((await semOferta.count()) === 0, "config sem resposta nao-sei no primeiro passo");
  await semOferta.click();
  const rotulos = ["Ainda não sei"];
  for (let i = 0; i < 10; i++) {
    const chips = concierge.getByTestId(/cc-chip-/);
    if ((await chips.count()) === 0) break;
    rotulos.push((await chips.first().textContent())!.trim());
    await chips.first().click();
  }
  const href = (await concierge.getByTestId("cc-cta").getAttribute("href")) ?? "";
  const texto = new URL(href).searchParams.get("text")!;
  const [contexto, branco, ...resto] = texto.split("\n");
  expect(contexto).toBe(`(Vim pelo concierge: ${rotulos.join(" · ")})`);
  expect(branco).toBe("");
  expect(resto.join("\n")).not.toContain("Vim pelo concierge");
  expect(resto.join("\n").length).toBeGreaterThan(0);
});

// iPhone: ao chegar ao resultado, o conteúdo do bloco deslizava ~16 px para a esquerda. O foco no
// resultado rolava a área escondida do bloco (overflow: hidden + brilho que passa da borda).
test("iPhone: responder tudo não desloca o conteúdo do concierge para o lado", async ({ browser, browserName }) => {
  test.skip(browserName !== "webkit", "Safari do iPhone");
  const { defaultBrowserType: _motor, ...iphone } = devices["iPhone 14"];
  const contexto = await browser.newContext({ ...iphone, baseURL: URL_APP });
  const page = await contexto.newPage();
  await page.goto("/");
  const cc = page.getByTestId("concierge").first();
  await expect(cc).toHaveAttribute("data-pronto", "true");
  const medir = () =>
    cc.evaluate((el) => ({ rolagem: el.scrollLeft, icone: Math.round(el.querySelector(".concierge-icone")!.getBoundingClientRect().left) }));
  const antes = await medir();
  for (let i = 0; i < 10; i++) {
    const chips = cc.getByTestId(/cc-chip-/);
    if ((await chips.count()) === 0) break;
    // Resposta no topo da tela: o resultado nasce acima dela, fora da tela, e o foco precisa rolar até ele
    // (é o caso de quem chega ao concierge rolando a bio; numa bio de cliente, o deslize aparecia assim).
    await chips.first().evaluate((el) => el.scrollIntoView({ block: "start" }));
    await chips.first().click();
  }
  await expect(cc.getByTestId("cc-recomendacao")).toBeVisible();
  await expect(cc.locator(".concierge-oferta")).toBeFocused();
  expect(await medir()).toEqual(antes);
  // O Safari, ao focar, às vezes alinha o resultado pela borda esquerda (o deslize de 16 px visto no
  // iPhone, que depende do momento do toque). Pedir esse mesmo alinhamento torna o caso determinístico:
  // o bloco não pode ter área escondida para rolar.
  await cc.locator(".concierge-oferta").evaluate((el) => el.scrollIntoView({ block: "nearest", inline: "start" }));
  expect(await medir()).toEqual(antes);
  await contexto.close();
});
