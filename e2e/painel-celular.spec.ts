/**
 * O painel no celular, com o aparelho emulado (tela, toque, user agent): o que o QA de celular achou
 * e corrigiu. Contra o Supabase falso, como o `painel.spec.ts`, e sem gravar nada: este arquivo pode
 * rodar ao mesmo tempo que o outro sem um atrapalhar o banco do outro.
 *
 * Só no chromium (ver playwright.config.ts): no WebKit o cookie de sessão `Secure` não vinga em
 * http://localhost, então o login não passa daqui. O que é medido é CSS calculado, igual nos motores;
 * o caso que só o Safari mostrava (select baixinho) é conferido pela regra que o corrige.
 */

import { devices, expect, test, type Page } from "@playwright/test";
import { EMAIL_TESTE, SENHA_TESTE } from "./painel-ambiente";

const SECOES = ["Blocos", "Perfil", "Aparência", "Ofertas", "Vitrine", "Contato e site", "Contatos", "Versões"];

const APARELHOS = [
  { nome: "iPhone 14", aparelho: devices["iPhone 14"] },
  { nome: "Pixel 7", aparelho: devices["Pixel 7"] },
];

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

/** Campos visíveis com letra menor que 16 px: no iPhone, tocar neles dá zoom na página. */
const camposMiudos = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("input, select, textarea")]
      .filter((e) => e.getBoundingClientRect().width > 2)
      .filter((e) => !["checkbox", "radio", "file", "color", "hidden"].includes((e as HTMLInputElement).type))
      .filter((e) => parseFloat(getComputedStyle(e).fontSize) < 16)
      .map((e) => `${e.id || (e as HTMLInputElement).name || e.className} ${getComputedStyle(e).fontSize}`),
  );

for (const { nome, aparelho } of APARELHOS) {
  test.describe(nome, () => {
    // Sem o defaultBrowserType: o projeto decide o motor.
    const { defaultBrowserType: _motor, ...resto } = aparelho;
    test.use(resto);

    test("nenhum campo com letra abaixo de 16 px (sem zoom do iPhone ao tocar)", async ({ page }) => {
      await page.goto("/admin/login");
      expect(await camposMiudos(page), "login").toEqual([]);
      await entrar(page);
      for (const secao of SECOES) {
        await abrirSecao(page, secao);
        expect(await camposMiudos(page), secao).toEqual([]);
      }
      // Um bloco aberto também: o editor de cada bloco tem campos próprios.
      await abrirSecao(page, "Blocos");
      await page.locator(".s-lista > li .s-bloco-nome").nth(1).click();
      await expect(page.locator(".s-bloco-corpo")).toBeVisible();
      expect(await camposMiudos(page), "bloco aberto").toEqual([]);
    });

    test("digitando, topo e abas soltam da tela e o Ver prévia sai da frente", async ({ page }) => {
      await entrar(page);
      await abrirSecao(page, "Perfil");
      const bio = page.getByRole("textbox", { name: /^Bio/ });
      // Rola para o campo ficar logo abaixo da faixa onde topo e abas grudam (ex.: "próximo campo" do teclado).
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await bio.focus();
      await expect(page.locator(".a-topo")).toHaveCSS("position", "static");
      await expect(page.locator(".a-menu")).toHaveCSS("position", "static");
      await expect(page.locator(".a-botao-previa")).toBeHidden();
      // Nada por cima do campo: o ponto do meio dele é ele mesmo.
      const coberto = await bio.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const noMeio = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 20));
        return noMeio !== el && !el.contains(noMeio);
      });
      expect(coberto).toBe(false);

      await bio.blur();
      await expect(page.locator(".a-topo")).toHaveCSS("position", "sticky");
      await expect(page.locator(".a-botao-previa")).toBeVisible();
    });

    test("bloco novo aparece inteiro, com o nome abaixo das abas", async ({ page }) => {
      await entrar(page);
      await page.getByRole("button", { name: "Adicionar bloco" }).click();
      const dialogo = page.getByRole("dialog", { name: "Escolher bloco" });
      await expect(dialogo).toBeVisible();
      // Escolha pelo toque: 44 px de altura em cada opção.
      const alturas = await dialogo.locator(".s-opcao").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
      expect(Math.min(...alturas)).toBeGreaterThanOrEqual(44);
      await dialogo.locator(".s-opcao").filter({ has: page.getByText("Texto", { exact: true }) }).click();
      await expect(dialogo).toBeHidden();
      const novo = page.locator(".s-lista > li").last();
      await expect(novo).toContainText("Texto");
      await expect
        .poll(() =>
          novo.evaluate((el) => {
            const abas = document.querySelector(".a-menu")!.getBoundingClientRect().bottom;
            return el.getBoundingClientRect().top >= abas - 1 && el.getBoundingClientRect().top < window.innerHeight / 2;
          }),
        )
        .toBe(true);
    });

    test("confirmar apagar e mudar a ordem das etiquetas com 44 px de toque", async ({ page }) => {
      await entrar(page);
      await abrirSecao(page, "Ofertas");
      const item = page.locator(".a-conteudo .c-item").first();
      await item.locator(".c-item-topo").getByRole("button", { name: "Remover", exact: true }).click();
      const pergunta = item.getByRole("alertdialog", { name: "Confirmar exclusão" });
      await expect(pergunta).toBeVisible();
      for (const nome of ["Apagar", "Cancelar"]) expect((await pergunta.getByRole("button", { name: nome }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
      // Sem gravar nada: este arquivo roda junto com o painel.spec.ts, no mesmo banco falso.
      await pergunta.getByRole("button", { name: "Cancelar" }).click();
      await expect(pergunta).toBeHidden();

      await abrirSecao(page, "Perfil");
      test.skip((await page.locator(".a-conteudo .c-etiqueta").count()) < 2, "perfil com menos de 2 etiquetas");
      const mover = page.locator(".a-conteudo .c-etiqueta").getByRole("button", { name: /^Mover / });
      expect(await mover.count()).toBeGreaterThan(0);
      for (const b of await mover.all()) {
        const caixa = (await b.boundingBox())!;
        expect(Math.min(caixa.width, caixa.height)).toBeGreaterThanOrEqual(44);
      }
    });

    test("menu ... do bloco com 44 px de toque, Esc fecha e Apagar pede confirmação", async ({ page }) => {
      await entrar(page);
      const bloco = page.locator(".s-lista > li").nth(1);
      const mais = bloco.getByRole("button", { name: /^Mais ações/ });
      expect(Math.min(...Object.values(await mais.boundingBox().then((c) => ({ w: c!.width, h: c!.height }))))).toBeGreaterThanOrEqual(44);
      await mais.click();
      const menu = bloco.getByRole("menu");
      await expect(menu.getByRole("menuitem")).toHaveText(["Subir", "Descer", "Duplicar", "Apagar"]);
      for (const item of await menu.getByRole("menuitem").all()) expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      // O menu cabe na tela (não estoura para o lado).
      const caixa = (await menu.boundingBox())!;
      expect(caixa.x).toBeGreaterThanOrEqual(0);
      expect(caixa.x + caixa.width).toBeLessThanOrEqual(page.viewportSize()!.width);
      await page.keyboard.press("Escape");
      await expect(menu).toBeHidden();
      await expect(mais).toBeFocused();
      // Sem gravar nada: Apagar pede confirmação e o Cancelar desiste.
      await mais.click();
      await menu.getByRole("menuitem", { name: "Apagar" }).click();
      const pergunta = bloco.getByRole("alertdialog", { name: "Confirmar exclusão" });
      await expect(pergunta).toBeVisible();
      await pergunta.getByRole("button", { name: "Cancelar" }).click();
      await expect(pergunta).toBeHidden();
    });

    test("select e Avançado com 44 px de toque", async ({ page }) => {
      await entrar(page);
      await abrirSecao(page, "Perfil");
      // Safari ignora altura, borda e padding do select nativo: a regra tira a aparência nativa.
      const selects = page.locator(".a-conteudo select");
      expect(await selects.count()).toBeGreaterThan(0);
      for (const s of await selects.all()) {
        await expect(s).toHaveCSS("appearance", "none");
        expect((await s.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      await abrirSecao(page, "Aparência");
      const avancado = page.locator(".c-avancado > summary").first();
      await expect(avancado).toBeVisible();
      expect((await avancado.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    });
  });
}

test.describe("320 px (celular pequeno)", () => {
  const { defaultBrowserType: _motor, ...pixel } = devices["Pixel 7"];
  test.use({ ...pixel, viewport: { width: 320, height: 640 } });

  test("a lista de blocos cabe na tela e o menu (com o Apagar) de cada bloco fica alcançável", async ({ page }) => {
    await entrar(page);
    const medida = await page.evaluate(() => {
      const w = document.documentElement.clientWidth;
      // O Apagar mora no menu "..." de cada bloco: o botão do menu é que tem de caber.
      const fora = [...document.querySelectorAll(".s-lista .s-mais")].filter((b) => b.getBoundingClientRect().right > w).length;
      return { estouro: document.documentElement.scrollWidth - w, fora };
    });
    expect(medida.estouro).toBeLessThanOrEqual(0);
    expect(medida.fora).toBe(0);
  });
});
