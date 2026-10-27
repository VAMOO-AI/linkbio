import { expect, test } from "@playwright/test";

type FbqFn = ((...args: unknown[]) => void) & { queue?: ArrayLike<unknown>[] };

declare global {
  interface Window {
    fbq?: FbqFn;
    gtag?: (...args: unknown[]) => void;
    clarity?: ((...args: unknown[]) => void) & { q?: ArrayLike<unknown>[] };
    dataLayer?: unknown[];
  }
}

const TERCEIRO = /facebook\.net|facebook\.com|googletagmanager|google-analytics|doubleclick|clarity\.ms/i;
/** Pixel e GA4: só depois do aceite. O Clarity entra antes, sem cookies (features.pixel.claritySemCookies). */
const SO_COM_ACEITE = /facebook\.net|facebook\.com|googletagmanager|google-analytics|doubleclick/i;
const NEGADO = ["consentv2", { ad_Storage: "denied", analytics_Storage: "denied" }];
const CONCEDIDO = ["consentv2", { ad_Storage: "denied", analytics_Storage: "granted" }];
const filaClarity = () => [...(window.clarity?.q ?? [])].map((item) => Array.from(item as ArrayLike<unknown>));

test("sem pixel, a bio não pede script de terceiro nem o aviso", async ({ page, request }) => {
  const terceiros: string[] = [];
  page.on("request", (req) => {
    if (TERCEIRO.test(req.url())) terceiros.push(req.url());
  });
  await page.goto("/");
  await expect(page.getByRole("dialog", { name: "Cookies" })).toHaveCount(0);
  expect(terceiros).toEqual([]);

  const html = await page.content();
  expect(html).not.toContain("linkbio-cookies");
  expect(html).not.toContain("fbevents");
  expect(html).not.toContain("googletagmanager");
  expect(html).not.toContain("connect.facebook.net");
  expect(html).not.toContain("clarity.ms");

  const srcs = await page.locator("script[src]:not([nomodule])").evaluateAll((els) => els.map((el) => (el as HTMLScriptElement).src));
  for (const src of srcs) {
    const corpo = await (await request.get(src)).text();
    expect(corpo, src).not.toContain("linkbio-cookies");
    expect(corpo, src).not.toContain("fbevents");
    expect(corpo, src).not.toContain("googletagmanager");
    expect(corpo, src).not.toContain("clarity.ms");
  }
});

test("com pixel, só o Clarity (sem cookies) carrega antes do aceite e o clique no WhatsApp vira contato", async ({ page }) => {
  const hits: string[] = [];
  await page.route(TERCEIRO, async (route) => {
    hits.push(route.request().url());
    await route.abort();
  });
  await page.goto("/e2e/pixel");
  await expect(page.getByRole("dialog", { name: "Cookies" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Cookies" })).toContainText("nada fica guardado no seu aparelho");
  await expect.poll(() => hits.filter((h) => /clarity\.ms/.test(h)).length).toBeGreaterThan(0);
  expect(hits.filter((h) => SO_COM_ACEITE.test(h))).toEqual([]);
  expect(await page.evaluate(filaClarity)).toContainEqual(NEGADO);
  expect(await page.evaluate(filaClarity)).not.toContainEqual(CONCEDIDO);

  await page.getByRole("button", { name: "Aceitar" }).click();
  await expect.poll(() => hits.length).toBeGreaterThan(0);
  await page.waitForFunction(
    () => typeof window.fbq === "function" && typeof window.gtag === "function" && typeof window.clarity === "function",
  );
  await page.evaluate(() => {
    window.addEventListener(
      "click",
      (e) => {
        const a = e.target instanceof Element ? e.target.closest("a") : null;
        if (a) e.preventDefault();
      },
      true,
    );
  });
  await page.getByRole("link", { name: "WhatsApp", exact: true }).click();
  await page.getByRole("link", { name: "WhatsApp pelo atalho" }).click();
  await page.getByRole("link", { name: "Curso" }).click();
  // A reserva do agendamento avisa por CustomEvent (lib/eventos.ts).
  await page.evaluate(() =>
    document.dispatchEvent(new CustomEvent("linkbio:evento", { detail: { nome: "Lead", id: "req-9", metodo: "agendamento" } })),
  );
  const eventos = await page.evaluate(() => ({
    fb: [...(window.fbq?.queue ?? [])].map((item) => Array.from(item as ArrayLike<unknown>)),
    dl: [...(window.dataLayer ?? [])].map((item) => Array.from(item as ArrayLike<unknown>)),
    cl: [...(window.clarity?.q ?? [])].map((item) => Array.from(item as ArrayLike<unknown>)),
  }));
  const fb = JSON.stringify(eventos.fb);
  const dl = JSON.stringify(eventos.dl);
  expect(fb.split("Contact").length - 1).toBe(2);
  // Lead da página (data-linkbio-evento) e da agenda, cada um com o eventID do próprio pedido.
  expect(eventos.fb).toContainEqual(["track", "Lead", {}, { eventID: "lead-pedido-1" }]);
  expect(eventos.fb).toContainEqual(["track", "Lead", {}, { eventID: "lead-req-9" }]);
  expect(dl.split("generate_lead").length - 1).toBe(4);
  expect(eventos.dl).toContainEqual(["event", "generate_lead", { method: "agendamento" }]);
  expect(eventos.cl).toContainEqual(NEGADO);
  expect(eventos.cl).toContainEqual(CONCEDIDO);
  expect(eventos.cl).not.toContainEqual(["consent"]);
  expect(eventos.cl).toContainEqual(["set", "origem", "direto"]);
  expect(eventos.cl).toContainEqual(["event", "toque_links.curso.0"]);
  expect(eventos.cl).toContainEqual(["event", "toque_cta.falar"]);
  expect(eventos.cl).toContainEqual(["event", "contact_whatsapp"]);
  expect(eventos.cl).toContainEqual(["event", "lead_agendamento"]);
});

test("recusar fica gravado e, ao recarregar, Pixel e GA4 não carregam; o Clarity segue sem cookies", async ({ page }) => {
  const hits: string[] = [];
  await page.route(TERCEIRO, async (route) => {
    hits.push(route.request().url());
    await route.abort();
  });
  await page.goto("/e2e/pixel");
  await page.getByRole("button", { name: "Recusar" }).click();
  await expect(page.getByRole("dialog", { name: "Cookies" })).toHaveCount(0);
  await page.reload();
  await page.waitForFunction(() => localStorage.getItem("linkbio-cookies") === "recusado");
  await expect(page.getByRole("dialog", { name: "Cookies" })).toHaveCount(0);
  expect(hits.filter((h) => SO_COM_ACEITE.test(h))).toEqual([]);
  expect(await page.evaluate(filaClarity)).toContainEqual(NEGADO);
  expect(await page.evaluate(filaClarity)).not.toContainEqual(CONCEDIDO);
  const cookies = (await page.context().cookies()).map((c) => c.name);
  expect(cookies.filter((n) => /^_cl/.test(n))).toEqual([]);
});
