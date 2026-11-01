import { expect, test, type Page } from "@playwright/test";
import { EMAIL_TESTE, SENHA_TESTE } from "./painel-ambiente";

/**
 * Cabeçalhos de segurança (lib/seguranca.ts) e a CSP na prática: nenhuma página do e2e pode ter
 * violação. Firefox e WebKit nem sempre mostram a violação no console, então o teste escuta o evento
 * `securitypolicyviolation` (os três motores disparam) e, de reforço, o console.
 * Sites de terceiros (pixels, YouTube) são abortados como no pixel.spec: a CSP barra antes da rede,
 * então um site fora da lista vira violação mesmo com a requisição abortada.
 */

const TERCEIRO = /facebook\.net|facebook\.com|googletagmanager|google-analytics|doubleclick|clarity\.ms|bing\.com|youtube-nocookie\.com|ytimg\.com/i;

/** Junta as violações de todas as páginas e iframes até a chamada (exposeFunction vale em todo frame e navegação). */
async function vigiarCsp(page: Page): Promise<() => string[]> {
  const achadas: string[] = [];
  page.on("console", (m) => {
    if (/Content[- ]Security[- ]Policy|\bCSP\b/i.test(m.text())) achadas.push(`console: ${m.text()}`);
  });
  await page.exposeFunction("avisarViolacaoCsp", (texto: string) => achadas.push(texto));
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => {
      const avisar = (window as unknown as { avisarViolacaoCsp?: (t: string) => void }).avisarViolacaoCsp;
      avisar?.(`${e.effectiveDirective} bloqueou ${e.blockedURI || "(inline)"} em ${e.documentURI}`);
    });
  });
  await page.route(TERCEIRO, (r) => r.abort());
  return () => achadas;
}

/** Dá tempo das requisições tardias (pixel, iframe) saírem. Teto curto: no WebKit o iframe abortado não deixa a rede ficar ociosa. */
async function assentar(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
}

for (const caminho of ["/", "/admin"]) {
  test(`${caminho} manda a CSP aplicada, sem iframe de outro site, com nosniff`, async ({ request }) => {
    const r = await request.get(caminho, { maxRedirects: 0 });
    const h = r.headers();
    expect(h["x-frame-options"]).toBe("SAMEORIGIN");
    const csp = h["content-security-policy"];
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(h["content-security-policy-report-only"]).toBeUndefined();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });
}

test("a bio, o vídeo do YouTube e o concierge não violam a CSP", async ({ page }) => {
  const violacoes = await vigiarCsp(page);
  await page.goto("/");
  await expect(page.getByTestId("concierge").first()).toHaveAttribute("data-pronto", "true");
  await page.getByTestId("concierge").first().locator("button").first().click();
  await page.getByRole("button", { name: /^Assistir:/ }).first().click();
  await expect(page.locator("iframe.youtube-player")).toHaveAttribute("src", /^https:\/\/www\.youtube-nocookie\.com\/embed\//);
  await assentar(page);
  expect(violacoes()).toEqual([]);
});

test("pixels ligados (Meta, GA4 e Clarity), antes e depois do aceite, não violam a CSP", async ({ page }) => {
  const violacoes = await vigiarCsp(page);
  const pedidos: string[] = [];
  page.on("request", (r) => {
    if (TERCEIRO.test(r.url())) pedidos.push(r.url());
  });
  await page.goto("/e2e/pixel");
  await page.getByRole("button", { name: "Aceitar" }).click();
  // Os três scripts saíram para a rede: a CSP deixou passar (e o teste abortou).
  await expect.poll(() => pedidos.some((u) => u.includes("connect.facebook.net"))).toBe(true);
  await expect.poll(() => pedidos.some((u) => u.includes("googletagmanager.com"))).toBe(true);
  await expect.poll(() => pedidos.some((u) => u.includes("clarity.ms"))).toBe(true);
  expect(violacoes()).toEqual([]);
});

test("agendamento, compartilhar, origem e números não violam a CSP", async ({ page }) => {
  const violacoes = await vigiarCsp(page);
  await page.goto("/e2e/agendamento");
  await page.locator(".bloco-agendamento").getByRole("button").first().click();
  await assentar(page);
  await page.goto("/e2e/compartilhar");
  await page.locator(".perfil-compartilhar summary").click();
  await expect(page.locator(".compartilhar-qr svg")).toBeVisible();
  await page.goto("/e2e/origem?src=instagram");
  await page.goto("/e2e/numeros");
  expect(violacoes()).toEqual([]);
});

test("concierge com IA não viola a CSP", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "a API de IA de mentira atende só o chromium (concierge-ia.spec)");
  const violacoes = await vigiarCsp(page);
  await page.goto("/concierge-ia-teste");
  const concierge = page.getByTestId("concierge").first();
  await expect(concierge).toHaveAttribute("data-pronto", "true");
  await concierge.getByTestId("cc-duvida").fill("Quero organizar minha semana");
  await concierge.getByTestId("cc-enviar").click();
  await expect(concierge.getByTestId("cc-recomendacao")).toBeVisible();
  expect(violacoes()).toEqual([]);
});

test("painel e prévia (iframe do próprio site) não violam a CSP", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "o painel roda só no chromium (banco falso único)");
  // A prévia ao lado do editor só aparece em tela larga (previa-segue.spec).
  await page.setViewportSize({ width: 1280, height: 800 });
  const violacoes = await vigiarCsp(page);
  await page.goto("/admin/login");
  await page.getByLabel("E-mail").fill(EMAIL_TESTE);
  await page.getByLabel("Senha").fill(SENHA_TESTE);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("navigation", { name: "Seções" })).toBeVisible();
  await expect(page.locator(".a-previa iframe.p-visivel")).toBeVisible({ timeout: 20000 });
  await assentar(page);
  expect(violacoes()).toEqual([]);
});
