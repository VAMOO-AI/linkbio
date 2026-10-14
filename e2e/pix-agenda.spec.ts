import { expect, test } from "@playwright/test";

test("Pix: QR visível, valor e código que um toque seleciona", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const bloco = page.locator(".bloco-pix");
  await expect(bloco).toBeVisible();
  await expect(bloco.locator(".pix-qr svg")).toBeVisible();
  await expect(bloco).toContainText("Fulano de Tal");
  await expect(bloco.locator(".pix-valor")).toContainText("49,90");
  const codigo = bloco.locator(".pix-codigo");
  const texto = (await codigo.textContent()) ?? "";
  expect(texto.startsWith("000201")).toBe(true);
  expect(texto).toMatch(/6304[0-9A-F]{4}$/);
  await expect(codigo).toHaveCSS("user-select", "all");
  await codigo.click();
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(texto);
  const copiou = await page.evaluate(() => {
    const w = window as unknown as { __pix?: string };
    Object.defineProperty(navigator.clipboard, "writeText", {
      configurable: true,
      value: (t: string) => {
        w.__pix = t;
        return Promise.resolve();
      },
    });
    const btn = document.querySelector(".bloco-pix .cupom-copiar");
    if (!(btn instanceof HTMLButtonElement)) return { pix: null, texto: "" };
    btn.click();
    return new Promise<{ pix: string | null; texto: string }>((resolve) => {
      setTimeout(() => resolve({ pix: w.__pix ?? null, texto: btn.textContent ?? "" }), 50);
    });
  });
  expect(copiou.texto).toBe("Copiado");
  expect(copiou.pix).toBe(texto);
  const estouro = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(estouro).toBe(false);
});

test("agenda: evento passado some, o futuro abre o Google e o .ics baixa", async ({ page, request }) => {
  await page.goto("/");
  const bloco = page.locator(".bloco-agenda");
  await expect(bloco).toBeVisible();
  await expect(bloco).toContainText("Encontro de exemplo");
  await expect(bloco).not.toContainText("Encontro que já passou");
  await expect(bloco.getByRole("link", { name: "Agendar horário" })).toHaveAttribute("href", "https://exemplo.com/agendar");
  await expect(bloco.getByRole("link", { name: "Google Agenda" })).toHaveAttribute("href", /^https:\/\/calendar\.google\.com\//);
  await expect(bloco.getByRole("link", { name: "Baixar .ics" })).toHaveAttribute("href", "/agenda/encontro.ics");

  const arquivo = await request.get("/agenda/encontro.ics");
  expect(arquivo.status()).toBe(200);
  expect(arquivo.headers()["content-type"]).toContain("text/calendar");
  const corpo = await arquivo.text();
  expect(corpo).toContain("BEGIN:VCALENDAR");
  expect(corpo).toContain("UID:encontro@linkbio");
  expect(corpo).toContain("DTSTART;TZID=America/Sao_Paulo:20990615T190000");
  expect(corpo).toContain("DURATION:PT60M");

  const passado = await request.get("/agenda/passado.ics");
  expect(passado.status()).toBe(200);
  expect(passado.headers()["content-type"]).toContain("text/calendar");

  expect((await request.get("/agenda/nao-existe.ics")).status()).toBe(404);
});
