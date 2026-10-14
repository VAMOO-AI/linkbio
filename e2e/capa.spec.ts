/**
 * Capa ao compartilhar da bio do arquivo (linkbio.config.ts de exemplo, sem foto: a capa mostra as
 * iniciais). As variações publicadas pelo painel (com foto, capa própria) estão em capa-publicada.spec.ts.
 */
import { expect, test } from "@playwright/test";
import arquivo from "../linkbio.config";
import { baixarCapa, conferirMetas, metasDaBio } from "./capa-comum";

test("bio do exemplo: meta tags completas e capa 1200 x 630 em JPG abaixo de 300 KB", async ({ request }) => {
  const m = await metasDaBio(request);
  conferirMetas(m);
  expect(m["og:title"]).toBe(`${arquivo.profile.name} ${arquivo.profile.handle}`);
  expect(m["og:description"]).toBe(arquivo.profile.bio);
  expect(m["og:site_name"]).toBe(arquivo.profile.name);
  expect(m["og:image:alt"]).toContain(arquivo.profile.name);
  // Sem VERCEL_* no teste, o endereço do exemplo fica (na Vercel ele vira o domínio do projeto).
  expect(new URL(m["og:url"]!).origin).toBe(new URL(arquivo.site.url).origin);
  await baixarCapa(request, m["og:image"]!);
});
