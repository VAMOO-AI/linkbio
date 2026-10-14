/**
 * Contraste do painel no claro e no escuro (o painel segue o tema do sistema: `colorScheme` do
 * Playwright). Percorre as telas principais e mede, no CSS calculado, a razão de contraste de todo
 * texto visível contra o fundo que ele tem de verdade (subindo pelos pais e somando transparências):
 * 4,5:1 para texto comum, 3:1 para texto grande (WCAG AA). No escuro também confere que o fundo da
 * página é escuro, que nenhuma superfície ficou clara (texto claro sobre fundo claro) e que borda de
 * campo, chave ligada e anel de foco têm 3:1 contra o fundo.
 *
 * Contra o Supabase falso, como o `painel.spec.ts`. O bloco novo (para ver a lista de problemas) vira
 * rascunho no banco falso, então este arquivo roda num projeto próprio, depois dos outros e antes do
 * "sem-oferta" (ver playwright.config.ts), e limpa o banco antes e depois. A prévia (iframe da bio)
 * fica de fora: ela mostra a bio no tema dela, não no do painel.
 */

import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { CHAVE_FALSA, EMAIL_TESTE, SENHA_TESTE, URL_FALSA } from "./painel-ambiente";

async function limpar(request: APIRequestContext) {
  const r = await request.post(`${URL_FALSA}/__controle/limpar`, { headers: { apikey: CHAVE_FALSA } });
  expect(r.status()).toBe(204);
}

test.beforeEach(async ({ request }) => limpar(request));
test.afterAll(async ({ request }) => limpar(request));

type Falha = { onde: string; texto: string; razao: number; minimo: number; cor: string; fundo: string };
type Medida = { falhas: Falha[]; menor: number; menorComponente: number; medidos: number; claros: string[]; fundoPagina: number };

/** Mede a tela atual. Roda dentro da página: não pode usar nada de fora da função. */
function medir(escuro: boolean): Medida {
  type RGBA = [number, number, number, number];
  const ler = (c: string): RGBA => {
    const n = c.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0];
    return [n[0] ?? 0, n[1] ?? 0, n[2] ?? 0, c.startsWith("rgba") || n.length > 3 ? (n[3] ?? 1) : 1];
  };
  const canal = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const lum = ([r, g, b]: RGBA) => 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
  const razao = (a: RGBA, b: RGBA) => {
    const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
    return (x! + 0.05) / (y! + 0.05);
  };
  const sobre = (cima: RGBA, baixo: RGBA): RGBA => {
    const a = cima[3];
    return [cima[0] * a + baixo[0] * (1 - a), cima[1] * a + baixo[1] * (1 - a), cima[2] * a + baixo[2] * (1 - a), 1];
  };
  const hex = (c: RGBA) => `rgb(${c.slice(0, 3).map(Math.round).join(" ")})`;
  /** Fundo efetivo: as camadas de fundo dos pais, de baixo para cima, até a primeira opaca. */
  const fundoDe = (el: Element): RGBA => {
    const camadas: RGBA[] = [];
    for (let e: Element | null = el; e; e = e.parentElement) {
      const c = ler(getComputedStyle(e).backgroundColor);
      if (c[3] > 0) camadas.push(c);
      if (c[3] >= 1) break;
    }
    let base: RGBA = escuro ? [0, 0, 0, 1] : [255, 255, 255, 1];
    for (const c of camadas.reverse()) base = sobre(c, base);
    return base;
  };
  const opacidade = (el: Element) => {
    let o = 1;
    for (let e: Element | null = el; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity);
    return o;
  };
  const visivel = (el: Element) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility !== "visible" || cs.display === "none") return false;
    // .sr (só leitor de tela) e afins: recortados para 1 px.
    return !el.closest(".sr, [aria-hidden='true'], .s-miniatura, .p-moldura");
  };
  // Desativado (Subir no primeiro bloco, Publicar sem nada novo). O nome do bloco escondido é medido:
  // fica na cor secundária, legível.
  const desativado = (el: Element) => !!el.closest(":disabled, [aria-disabled='true']");
  const nome = (el: Element) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).join(".") : ""}`;

  const falhas: Falha[] = [];
  let menor = Infinity;
  let menorComponente = Infinity;
  let medidos = 0;
  const alvos = [...document.querySelectorAll("body *")].filter((el) => {
    if (el.matches("input, textarea, select")) return !["checkbox", "radio", "file", "color", "hidden"].includes((el as HTMLInputElement).type);
    return [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim());
  });
  for (const el of alvos) {
    if (!visivel(el) || desativado(el)) continue;
    const cs = getComputedStyle(el);
    const fundo = fundoDe(el);
    const cor = ler(cs.color);
    const texto = sobre([cor[0], cor[1], cor[2], cor[3] * opacidade(el)], fundo);
    const r = razao(texto, fundo);
    const px = parseFloat(cs.fontSize);
    const grande = px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700);
    const minimo = grande ? 3 : 4.5;
    medidos++;
    menor = Math.min(menor, r);
    const conteudo = (el as HTMLInputElement).value ?? el.textContent ?? "";
    if (r < minimo) falhas.push({ onde: nome(el), texto: conteudo.trim().slice(0, 40), razao: +r.toFixed(2), minimo, cor: hex(texto), fundo: hex(fundo) });
  }

  // Componentes (3:1): borda dos campos, chave ligada. Só no escuro: o claro não muda neste trabalho.
  if (escuro) {
    for (const el of document.querySelectorAll(".adm input[type='text'], .adm input[type='email'], .adm input[type='password'], .adm textarea, .adm select, .c-switch[aria-checked='true']")) {
      if (!visivel(el) || desativado(el)) continue;
      const cs = getComputedStyle(el);
      const pai = el.parentElement ? fundoDe(el.parentElement) : fundoDe(el);
      const linha = el.matches(".c-switch") ? ler(cs.backgroundColor) : ler(cs.borderTopColor);
      const r = razao(sobre(linha, pai), pai);
      menorComponente = Math.min(menorComponente, r);
      medidos++;
      if (r < 3) falhas.push({ onde: nome(el) + " (borda/trilho)", texto: "", razao: +r.toFixed(2), minimo: 3, cor: hex(sobre(linha, pai)), fundo: hex(pai) });
    }
  }

  // Superfície clara no escuro: elemento visível com fundo próprio claro fora das exceções de propósito
  // (botão principal invertido, pílula marcada, bolinha da chave, amostra de cor, aviso flutuante).
  const claros: string[] = [];
  if (escuro) {
    const permitido = ".b-primario, .adm-primario, .c-pilula[aria-pressed='true'], .a-toast, .c-switch-bola, .c-cor-amostra, .s-miniatura, .s-miniatura *, .p-moldura, .p-moldura *";
    for (const el of document.querySelectorAll("body, body *")) {
      const c = ler(getComputedStyle(el).backgroundColor);
      if (c[3] < 0.5 || !visivel(el) || el.matches(permitido)) continue;
      // Pontinhos de estado (erro no menu, "no ar" da prévia e das versões) são sinal, não superfície.
      const r = el.getBoundingClientRect();
      if (r.width < 16 && r.height < 16) continue;
      if (lum(sobre(c, fundoDe(el.parentElement ?? el))) > 0.4) claros.push(nome(el));
    }
  }
  return { falhas, menor: +menor.toFixed(2), menorComponente: +menorComponente.toFixed(2), medidos, claros, fundoPagina: +lum(fundoDe(document.body)).toFixed(3) };
}

const ESQUEMAS = [
  { nome: "claro", colorScheme: "light" as const },
  { nome: "escuro", colorScheme: "dark" as const },
];

async function conferir(page: Page, escuro: boolean, tela: string, relatorio: Record<string, number | number[]>) {
  await page.waitForTimeout(250);
  const m = await page.evaluate(medir, escuro);
  relatorio[tela] = escuro ? [m.menor, m.menorComponente] : m.menor;
  expect(m.medidos, `${tela}: nada medido`).toBeGreaterThan(3);
  expect(m.falhas, `${tela}: texto sem contraste`).toEqual([]);
  if (escuro) {
    expect(m.fundoPagina, `${tela}: o fundo da página deveria ser escuro`).toBeLessThan(0.05);
    expect(m.claros, `${tela}: superfície clara no escuro`).toEqual([]);
  }
}

async function abrirSecao(page: Page, nome: string) {
  await page.getByRole("navigation", { name: "Seções" }).getByRole("button", { name: nome }).click();
  await expect(page.locator(".a-cabecalho h1")).toHaveText(nome);
}

for (const { nome, colorScheme } of ESQUEMAS) {
  test.describe(`contraste do painel no ${nome}`, () => {
    test.use({ colorScheme });
    const escuro = colorScheme === "dark";

    test(`computador (1280 px): login, seções, bloco aberto, menu, confirmação e problemas`, async ({ page }) => {
      test.setTimeout(90_000);
      const relatorio: Record<string, number | number[]> = {};
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto("/admin/login");
      await page.getByLabel("E-mail").fill(EMAIL_TESTE);
      await conferir(page, escuro, "login", relatorio);
      await page.getByLabel("Senha").fill(SENHA_TESTE);
      await page.getByRole("button", { name: "Entrar" }).click();
      await expect(page.getByRole("navigation", { name: "Seções" })).toBeVisible();

      await conferir(page, escuro, "blocos", relatorio);
      const linha = page.locator(".s-lista > li").nth(2);
      await linha.locator(".s-mais").click();
      await expect(page.locator(".s-menu")).toBeVisible();
      await conferir(page, escuro, "menu", relatorio);
      await page.locator(".s-menu .s-menu-perigo").click();
      await expect(linha.locator(".s-confirmar")).toBeVisible();
      await conferir(page, escuro, "confirmar apagar", relatorio);
      await linha.locator(".s-confirmar .b-sec").click();
      await linha.locator(".s-bloco-nome").click();
      await expect(linha.locator(".s-bloco-corpo")).toBeVisible();
      await conferir(page, escuro, "bloco aberto", relatorio);

      // Foco pelo teclado num campo do bloco aberto: borda azul de 3:1 contra o cartão (só no escuro).
      if (escuro) {
        const campo = linha.locator(".s-bloco-corpo input[type='text']").first();
        await campo.focus();
        const r = await campo.evaluate((el) => {
          const ler = (c: string) => c.match(/[\d.]+/g)!.slice(0, 3).map(Number);
          const canal = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
          const lum = (c: number[]) => 0.2126 * canal(c[0]!) + 0.7152 * canal(c[1]!) + 0.0722 * canal(c[2]!);
          const a = lum(ler(getComputedStyle(el).borderTopColor));
          const b = lum(ler(getComputedStyle(el).backgroundColor));
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        });
        expect(r, "anel de foco do campo").toBeGreaterThanOrEqual(3);
      }
      await linha.locator(".s-bloco-nome").click();

      // Bloco novo vazio e "Publicar": a lista de problemas (vermelha) e o selo do topo.
      await page.getByRole("button", { name: "Adicionar bloco" }).click();
      await page.getByRole("dialog", { name: "Escolher bloco" }).locator(".s-opcao").first().waitFor();
      await conferir(page, escuro, "escolher bloco", relatorio);
      await page.getByRole("dialog", { name: "Escolher bloco" }).locator(".s-opcao").filter({ has: page.getByText("Link", { exact: true }) }).click();
      await page.getByRole("button", { name: "Publicar" }).click();
      await expect(page.locator(".a-problemas")).toBeVisible();
      await page.evaluate(() => scrollTo(0, 0));
      await conferir(page, escuro, "problemas", relatorio);

      for (const secao of ["Perfil", "Aparência", "Ofertas", "Vitrine", "Contato e site", "Contatos", "Versões"]) {
        await abrirSecao(page, secao);
        const primeiro = page.locator(".c-item-titulo").first();
        if ((secao === "Ofertas" || secao === "Vitrine") && (await primeiro.count()) && (await primeiro.getAttribute("aria-expanded")) !== "true") await primeiro.click();
        await conferir(page, escuro, secao, relatorio);
      }
      console.log(`menor razão (${nome}): ${JSON.stringify(relatorio)}`);
    });

    test(`celular (375 px): lista, menu e prévia aberta`, async ({ page }) => {
      const relatorio: Record<string, number | number[]> = {};
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto("/admin/login");
      await page.getByLabel("E-mail").fill(EMAIL_TESTE);
      await page.getByLabel("Senha").fill(SENHA_TESTE);
      await page.getByRole("button", { name: "Entrar" }).click();
      await expect(page.getByRole("navigation", { name: "Seções" })).toBeVisible();
      await conferir(page, escuro, "blocos 375", relatorio);
      await page.locator(".s-lista > li").nth(1).locator(".s-mais").click();
      await conferir(page, escuro, "menu 375", relatorio);
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Ver prévia" }).click();
      await expect(page.locator(".a-previa-aberta")).toBeVisible();
      await conferir(page, escuro, "prévia aberta 375", relatorio);
      console.log(`menor razão (${nome}): ${JSON.stringify(relatorio)}`);
    });
  });
}
