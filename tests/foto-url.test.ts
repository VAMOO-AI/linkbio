import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// `npm run foto -- file:///.env.local` fotografava a chave num PNG legível.
const raiz = join(__dirname, "..");
const foto = (url: string) =>
  spawnSync(process.execPath, [join(raiz, "node_modules", "tsx", "dist", "cli.mjs"), "scripts/foto.ts", url], {
    cwd: raiz,
    encoding: "utf8",
  });

describe("npm run foto", () => {
  it.each(["file:///etc/hosts", "file://.env.local", "javascript:alert(1)", "nao-e-url"])("recusa %s", (url) => {
    const r = foto(url);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("Endereço recusado");
  });
});
