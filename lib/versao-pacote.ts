import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Versão do template, lida do package.json. Não é segredo. */
export function versaoDoPacote(root = process.cwd()): string {
  const pacote = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { version?: unknown };
  return typeof pacote.version === "string" ? pacote.version : "";
}
