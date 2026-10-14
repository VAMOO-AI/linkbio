/**
 * npm run chave -- <NOME> <valor>
 * Grava uma chave que a pessoa colou no chat direto no .env.local, sem abrir o arquivo e sem
 * repetir o valor (mostra só o fim, para conferir). Aceita só as chaves que o setup e o painel pedem.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { gravarVariavel } from "../lib/env-local";

/** Chaves aceitas e como reconhecer uma colada errada (ex.: a chave pública no lugar da secreta). */
export const CHAVES: Record<string, { nome: string; valida: (v: string) => string | null }> = {
  APIFY_TOKEN: {
    nome: "token da Apify",
    valida: (v) => (/^[A-Za-z0-9_-]{20,}$/.test(v) ? null : "não parece um token da Apify (copie o \"Personal API token\" inteiro)"),
  },
  SUPABASE_URL: {
    nome: "endereço do projeto Supabase",
    valida: (v) => (/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(v) ? null : "o endereço do projeto é assim: https://xxxx.supabase.co"),
  },
  SUPABASE_SERVICE_ROLE_KEY: {
    nome: "chave secreta do Supabase",
    valida: (v) =>
      v.startsWith("sb_publishable_")
        ? "essa é a chave PÚBLICA; precisa da Secret key (começa com sb_secret_)"
        : /^(sb_secret_[A-Za-z0-9_-]{16,}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.test(v)
          ? null
          : "a chave secreta começa com sb_secret_ (ou, em projeto antigo, eyJ...)",
  },
};

export function gravarChave(texto: string, nome: string, valorBruto: string): { texto: string; aviso: string } {
  const regra = CHAVES[nome];
  if (!regra) throw new Error(`Chave desconhecida: ${nome}. Aceitas: ${Object.keys(CHAVES).join(", ")}.`);
  const valor = valorBruto.trim().replace(/^["']|["']$/g, "");
  const problema = regra.valida(valor);
  if (problema) throw new Error(`Não salvei: ${problema}.`);
  return { texto: gravarVariavel(texto, nome, valor), aviso: `${regra.nome} salvo (termina em ...${valor.slice(-4)}).` };
}

if (process.argv[1]?.endsWith("chave.ts")) {
  const [nome, valor] = process.argv.slice(2);
  if (!nome || valor === undefined) {
    console.error("Uso: npm run chave -- <NOME> <valor>   (ex.: npm run chave -- APIFY_TOKEN apify_api_...)");
    process.exit(2);
  }
  try {
    const antes = existsSync(".env.local") ? readFileSync(".env.local", "utf8") : readFileSync(".env.example", "utf8");
    const r = gravarChave(antes, nome, valor);
    writeFileSync(".env.local", r.texto);
    console.log(r.aviso);
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}
