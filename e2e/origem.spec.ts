import { expect, test, type Page } from "@playwright/test";

/** Conteúdo por origem: o script do <head> marca a origem antes de pintar e o CSS mostra ou esconde. */

async function abrir(page: Page, busca = "") {
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      (window as unknown as { origemNoParse: string | null }).origemNoParse = document.documentElement.getAttribute("data-origem");
    });
  });
  await page.goto(`/e2e/origem${busca}`);
}

test("sem origem: aparece o que não tem mostrar", async ({ page }) => {
  await abrir(page);
  await expect(page.getByText("Para todos")).toBeVisible();
  await expect(page.getByText("Só stories")).toBeHidden();
  await expect(page.getByText("Menos bio")).toBeVisible();
});

test("?src=stories mostra o bloco dos stories, e a origem já está no <html> antes do DOMContentLoaded", async ({ page }) => {
  await abrir(page, "?src=Stories");
  expect(await page.evaluate(() => (window as unknown as { origemNoParse: string | null }).origemNoParse)).toBe("stories");
  await expect(page.getByText("Só stories")).toBeVisible();
  await expect(page.getByText("Menos bio")).toBeVisible();
});

test("utm_source vale como origem; ?src=bio esconde e a origem fica na sessão ao voltar sem parâmetro", async ({ page }) => {
  await abrir(page, "?utm_source=bio");
  await expect(page.getByText("Menos bio")).toBeHidden();
  await page.goto("/e2e/origem");
  await expect(page.locator("html")).toHaveAttribute("data-origem", "bio");
  await expect(page.getByText("Menos bio")).toBeHidden();
});

test("origem inválida é ignorada", async ({ page }) => {
  await abrir(page, "?src=com%20espa%C3%A7o");
  await expect(page.locator("html")).not.toHaveAttribute("data-origem", /.*/);
  await expect(page.getByText("Só stories")).toBeHidden();
});

test("no envio, o formulário leva a origem e a campanha guardadas", async ({ page }) => {
  await abrir(page, "?src=stories&utm_campaign=outubro&fbclid=abc");
  let corpo = "";
  await page.route("**/e2e/origem", async (rota) => {
    if (rota.request().method() !== "POST") return rota.continue();
    corpo = rota.request().postData() ?? "";
    await rota.fulfill({ status: 204, body: "" });
  });
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect.poll(() => corpo).not.toBe("");
  const dados = new URLSearchParams(corpo);
  expect(dados.get("origem")).toBe("stories");
  expect(JSON.parse(dados.get("utm") ?? "{}")).toEqual({ utm_campaign: "outubro", fbclid: "abc" });
});

test("na bio, o script da origem não gera erro de hidratação nem de console", async ({ page }) => {
  const erros: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || /hydrat/i.test(m.text())) erros.push(m.text());
  });
  page.on("pageerror", (e) => erros.push(e.message));
  await page.goto("/?src=stories&utm_campaign=teste");
  await expect(page.locator("html")).toHaveAttribute("data-origem", "stories");
  await page.waitForLoadState("networkidle");
  expect(erros).toEqual([]);
});
