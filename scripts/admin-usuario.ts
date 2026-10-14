/**
 * npm run admin:usuario -- <email> [--senha [senha]]
 * Cadastra o e-mail de quem pode entrar no /admin. Sem --senha, não gera senha:
 * a pessoa entra com o código enviado ao e-mail. --senha gera uma forte e mostra UMA vez;
 * --senha <valor> grava essa senha.
 * Lê o endereço e a chave do Supabase do ambiente ou do .env.local
 * (também os nomes da integração da Vercel). Guarda só o hash (scrypt), ou nenhum.
 */
import { existsSync, readFileSync } from "node:fs";
import { hashSenha, senhaAleatoria } from "../lib/admin/cripto";
import { interpretarPedido } from "../lib/admin/usuario";
import { lerVariavel } from "../lib/env-local";
import { cabecalhosDaChave, lerSupabase } from "../lib/supabase-chave";

const NOMES = ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"] as const;

function ambiente(): Record<string, string | undefined> {
  const arquivo = existsSync(".env.local") ? readFileSync(".env.local", "utf8") : "";
  const env: Record<string, string | undefined> = { ...process.env };
  for (const nome of NOMES) {
    if (env[nome]) continue;
    const valor = arquivo ? lerVariavel(arquivo, nome) : "";
    if (valor) env[nome] = valor;
  }
  return env;
}

async function main() {
  const pedido = interpretarPedido(process.argv.slice(2));
  if (!pedido.ok) {
    console.error(pedido.erro);
    process.exit(2);
  }
  const credencial = lerSupabase(ambiente());
  if (!credencial) {
    console.error("Faltam o endereço e a chave secreta do Supabase (no ambiente ou no .env.local).");
    process.exit(1);
  }
  const { url, chave } = credencial;
  const headers = { ...cabecalhosDaChave(chave), "Content-Type": "application/json" };
  const busca = await fetch(`${url}/rest/v1/admin_users?select=id&email=eq.${encodeURIComponent(pedido.email)}&limit=1`, {
    headers: cabecalhosDaChave(chave),
  });
  if (!busca.ok) {
    console.error(`Erro ${busca.status}: ${await busca.text()}`);
    process.exit(1);
  }
  const existentes = (await busca.json()) as { id: string }[];
  const senha = pedido.senha ?? (pedido.gerar ? senhaAleatoria() : null);
  let hash: string | null = null;
  if (senha) {
    try {
      hash = await hashSenha(senha);
    } catch (erro) {
      console.error(erro instanceof Error ? erro.message : "Não foi possível guardar a senha.");
      process.exit(2);
    }
  }
  let resp: Response;
  if (!hash && existentes[0]) {
    console.log(`OK: ${pedido.email} pode entrar em /admin.`);
    return;
  }
  if (existentes[0]) {
    resp = await fetch(`${url}/rest/v1/admin_users?id=eq.${existentes[0].id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ password_hash: hash }),
    });
  } else {
    resp = await fetch(`${url}/rest/v1/admin_users`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ email: pedido.email, password_hash: hash }),
    });
  }
  if (!resp.ok) {
    const texto = await resp.text();
    if (/password_hash/.test(texto) && /null/i.test(texto)) {
      console.error("Falta atualizar o banco: rode a migration nova do painel (login por código) no SQL Editor.");
    } else {
      console.error(`Erro ${resp.status}: ${texto}`);
    }
    process.exit(1);
  }
  console.log(`OK: ${pedido.email} pode entrar em /admin.`);
  if (pedido.gerar && senha) console.log(`Senha gerada (anote agora, não aparece de novo): ${senha}`);
}

main();
