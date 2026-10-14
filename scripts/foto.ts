/**
 * npm run foto [-- http://localhost:3000]
 * Fotografa a bio (com `npm run dev` rodando) no celular e no computador e grava em
 * analise/previa-celular.png e analise/previa-computador.png. O Claude compara com as fotos do site
 * (analise/site-*.png) para conferir se a bio tem a cara da marca.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const url = process.argv[2] ?? "http://localhost:3000";

// Só página web: file:// fotografaria arquivo local (o .env.local viraria imagem legível).
export function urlPermitida(u: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(u).protocol);
  } catch {
    return false;
  }
}

async function main() {
  if (!urlPermitida(url)) {
    console.error(`Endereço recusado: ${url}. A foto só aceita http:// ou https:// (ex.: http://localhost:3000).`);
    process.exit(1);
  }
  let chromium;
  try {
    ({ chromium } = await import("@playwright/test"));
  } catch {
    console.error("Navegador de teste ausente. Rode: npx playwright install chromium");
    process.exit(1);
  }
  mkdirSync("analise", { recursive: true });
  const navegador = await chromium.launch().catch(() => {
    console.error("Navegador de teste não instalado. Rode: npx playwright install chromium (1 a 2 min) e repita.");
    process.exit(1);
  });
  try {
    const celular = await navegador.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
    await celular.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
    await celular.screenshot({ path: join("analise", "previa-celular.png"), fullPage: true });
    const pc = await navegador.newPage({ viewport: { width: 1280, height: 800 } });
    await pc.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
    await pc.screenshot({ path: join("analise", "previa-computador.png") });
    console.log("Fotos da bio: analise/previa-celular.png e analise/previa-computador.png.");
  } catch (e) {
    console.error(`Não consegui abrir ${url}. A bio está rodando (npm run dev)? ${(e as Error).message.split("\n")[0]}`);
    process.exit(1);
  } finally {
    await navegador.close();
  }
}

main();
