import { expect, test } from "@playwright/test";

function jsonLd(html: string): Record<string, unknown> {
  const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!m?.[1]) throw new Error("JSON-LD ausente");
  return JSON.parse(m[1]) as Record<string, unknown>;
}

test("a bio de pessoa publica Person com as redes", async ({ page }) => {
  await page.goto("/");
  const json = jsonLd(await page.content());
  expect(json["@type"]).toBe("Person");
  expect(json.sameAs).toEqual(["https://instagram.com/marina.exemplo", "https://youtube.com/@marinaexemplo"]);
  expect(json).not.toHaveProperty("logo");
});

test("empresa publica Organization com logo", async ({ page }) => {
  await page.goto("/e2e/seo/empresa");
  const json = jsonLd(await page.content());
  expect(json["@type"]).toBe("Organization");
  expect(json.logo).toBe("https://casa.exemplo.com/logo.png");
  expect(json.sameAs).toEqual(["https://instagram.com/casaverde"]);
});

test("robots tira o painel do índice e o sitemap aponta a home", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toMatch(/Disallow:\s*\/admin\b/);
  expect(robots).toMatch(/Disallow:\s*\/admin-previa/);
  expect(robots).toMatch(/Sitemap:\s*https?:\/\/\S+\/sitemap\.xml/);
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toMatch(/<loc>https?:\/\/[^<]+\/?<\/loc>/);
});
