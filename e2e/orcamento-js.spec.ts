import { gzipSync } from "node:zlib";
import { expect, test } from "@playwright/test";

// React 19 + runtime do App Router já custam ~130 KB gzip; o código da bio, ~7 KB.
// O teto pega regressão como a config inteira (e o zod) vazando para uma ilha client.
const TETO_KB = 150;

test(`JS de primeira carga (gzip, sem polyfill noModule) abaixo de ${TETO_KB} KB`, async ({ page, request }) => {
  await page.goto("/");
  const srcs = await page
    .locator("script[src]:not([nomodule])")
    .evaluateAll((els) => els.map((el) => (el as HTMLScriptElement).src));

  let total = 0;
  for (const src of new Set(srcs)) {
    const corpo = await (await request.get(src)).body();
    expect(corpo.includes("ZodError"), `zod no bundle client: ${src}`).toBe(false);
    total += gzipSync(corpo).length;
  }
  const kb = total / 1024;
  console.log(`JS de primeira carga: ${kb.toFixed(1)} KB gzip`);
  expect(kb).toBeLessThan(TETO_KB);
});
