/**
 * Conferências da capa ao compartilhar, usadas por e2e/capa.spec.ts e e2e/capa-publicada.spec.ts:
 * as meta tags que o WhatsApp, o Instagram e o Telegram leem, e a imagem que eles baixam.
 */
import { expect, type APIRequestContext } from "@playwright/test";
import sharp from "sharp";

/** Acima disso o WhatsApp não mostra a capa grande. */
export const LIMITE_BYTES = 300 * 1024;

export type Metas = Record<string, string>;

/** Meta tags og:* e twitter:* do HTML (a primeira de cada nome). */
export async function metasDaBio(request: APIRequestContext): Promise<Metas> {
  const r = await request.get("/");
  expect(r.status()).toBe(200);
  const html = await r.text();
  const metas: Metas = {};
  for (const [, nome, valor] of html.matchAll(/<meta (?:property|name)="((?:og|twitter):[^"]+)" content="([^"]*)"/g)) {
    metas[nome!] ??= valor!.replaceAll("&amp;", "&").replaceAll("&quot;", '"');
  }
  return metas;
}

/** Conferência comum das tags: URL absoluta com https, tamanho e tipo declarados, texto alternativo. */
export function conferirMetas(m: Metas) {
  for (const t of ["og:title", "og:description", "og:url", "og:site_name", "og:image", "og:image:alt", "twitter:image"]) {
    expect(m[t], `falta a meta ${t}`).toBeTruthy();
  }
  expect(m["og:url"]).toMatch(/^https:\/\//);
  expect(m["og:image"]).toMatch(/^https:\/\/[^/]+\/capa\.jpg\?v=[0-9a-z]+$/);
  expect(m["og:image:type"]).toBe("image/jpeg");
  expect(m["og:image:width"]).toBe("1200");
  expect(m["og:image:height"]).toBe("630");
  expect(m["twitter:card"]).toBe("summary_large_image");
}

/**
 * Baixa a og:image deste servidor (o domínio da tag é o do site no ar; aqui vale o caminho) e confere
 * o que o WhatsApp exige: 200, JPG, 1200 x 630, abaixo de 300 KB. Devolve os bytes.
 */
export async function baixarCapa(request: APIRequestContext, ogImage: string): Promise<Buffer> {
  const u = new URL(ogImage);
  const r = await request.get(`${u.pathname}${u.search}`);
  expect(r.status()).toBe(200);
  expect(r.headers()["content-type"]).toBe("image/jpeg");
  const corpo = await r.body();
  expect(corpo.length, `capa com ${corpo.length} bytes`).toBeLessThan(LIMITE_BYTES);
  const meta = await sharp(corpo).metadata();
  expect(meta.format).toBe("jpeg");
  expect([meta.width, meta.height]).toEqual([1200, 630]);
  return corpo;
}
