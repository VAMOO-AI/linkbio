import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, expect, test } from "vitest";
import { cssDasFontes, hrefsParaPreload } from "../lib/preloads-fonte";

const pasta = mkdtempSync(join(tmpdir(), "preload-build-"));
const cwdOriginal = process.cwd();
afterAll(() => {
  process.chdir(cwdOriginal);
  rmSync(pasta, { recursive: true, force: true });
});

test("build com CSS em static/immutable/chunks (Vercel) pré-carrega de immutable/media", () => {
  mkdirSync(join(pasta, ".next/static/immutable/chunks"), { recursive: true });
  writeFileSync(
    join(pasta, ".next/static/immutable/chunks/a.css"),
    '@font-face{font-family:Plus Jakarta Sans;src:url(../media/jakarta-latim.woff2)format("woff2");unicode-range:U+0000-00FF,U+20AC}.f{--lb-f-jakarta:"Plus Jakarta Sans","Plus Jakarta Sans Fallback"}',
  );
  process.chdir(pasta);
  expect(hrefsParaPreload({ display: "jakarta", body: "jakarta" }, cssDasFontes())).toEqual([
    "/_next/static/immutable/media/jakarta-latim.woff2",
  ]);
});
