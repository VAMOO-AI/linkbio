/**
 * npm run admin:segredo
 * Gera o ADMIN_SESSION_SECRET e grava no .env.local SEM mostrar o valor (ele não pode passar pela conversa).
 * Se já houver um segredo com 32 caracteres ou mais, mantém (trocar desloga quem está no painel).
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { gravarVariavel, lerVariavel } from "../lib/env-local";

const ARQUIVO = ".env.local";
const texto = existsSync(ARQUIVO) ? readFileSync(ARQUIVO, "utf8") : "";
if (lerVariavel(texto, "ADMIN_SESSION_SECRET").length >= 32 && !process.argv.includes("--trocar")) {
  console.log("OK: o .env.local já tem ADMIN_SESSION_SECRET. Nada mudou (use --trocar para gerar outro).");
} else {
  writeFileSync(ARQUIVO, gravarVariavel(texto, "ADMIN_SESSION_SECRET", randomBytes(48).toString("base64")));
  console.log("OK: ADMIN_SESSION_SECRET gravado no .env.local (o valor não é mostrado).");
}
