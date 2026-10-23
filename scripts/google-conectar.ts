/**
 * npm run google:conectar
 * Liga o Google Agenda da bio: abre o login do Google no navegador, recebe a autorização num
 * endereço local e grava o refresh token na tabela agenda_google do Supabase.
 * O token nunca aparece na tela nem vai para arquivo. Precisa no ambiente ou no .env.local:
 * GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { novoPkce, trocarCodigo, urlDeAutorizacao } from "../lib/agendamento/conectar";
import { lerVariavel } from "../lib/env-local";
import { cabecalhosDaChave, lerSupabase } from "../lib/supabase-chave";

const NOMES = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
] as const;
const ESPERA_MS = 5 * 60 * 1000;

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

function abrir(url: string) {
  const [cmd, args] =
    process.platform === "darwin" ? ["open", [url]] : process.platform === "win32" ? ["cmd", ["/c", "start", '""', `"${url}"`]] : ["xdg-open", [url]];
  try {
    spawn(cmd as string, args as string[], { stdio: "ignore", detached: true, shell: process.platform === "win32" }).unref();
  } catch {
    // Sem navegador: o endereço já foi impresso.
  }
}

function pagina(titulo: string, texto: string): string {
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo}</title><body style="font-family:system-ui;max-width:32rem;margin:15vh auto;padding:0 16px;line-height:1.5"><h1 style="font-size:1.4rem">${titulo}</h1><p>${texto}</p></body></html>`;
}

async function main() {
  const env = ambiente();
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  const supabase = lerSupabase(env);
  const faltam = [!clientId && "GOOGLE_CLIENT_ID", !clientSecret && "GOOGLE_CLIENT_SECRET", !supabase && "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY"].filter(Boolean);
  if (faltam.length || !clientId || !clientSecret || !supabase) {
    console.error(`FALTA: ${faltam.join(", ")} no .env.local. Cole pelo editor de texto e rode de novo.`);
    process.exit(1);
  }

  const pkce = novoPkce();
  const servidor = createServer();
  await new Promise<void>((ok) => servidor.listen(0, "127.0.0.1", ok));
  const redirect = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/`;
  const url = urlDeAutorizacao({ clientId, redirect, desafio: pkce.desafio, state: pkce.state });

  const resultado = await new Promise<{ ok: true; conta: string } | { ok: false; erro: string }>((fim) => {
    const prazo = setTimeout(() => fim({ ok: false, erro: "passaram 5 minutos sem autorização. Rode de novo." }), ESPERA_MS);
    servidor.on("request", async (req, res) => {
      const u = new URL(req.url ?? "/", redirect);
      if (u.pathname !== "/") {
        res.writeHead(404).end();
        return;
      }
      const responder = (titulo: string, texto: string) => {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(pagina(titulo, texto));
      };
      if (u.searchParams.get("state") !== pkce.state) {
        responder("Link inválido", "Volte ao Claude e rode a conexão de novo.");
        return;
      }
      const erroGoogle = u.searchParams.get("error");
      const codigo = u.searchParams.get("code");
      if (erroGoogle || !codigo) {
        responder("Não autorizado", "A agenda não foi ligada. Volte ao Claude.");
        clearTimeout(prazo);
        fim({ ok: false, erro: erroGoogle === "access_denied" ? "a autorização foi recusada na tela do Google." : `o Google respondeu ${erroGoogle ?? "sem código"}.` });
        return;
      }
      const troca = await trocarCodigo({ clientId, clientSecret, redirect, codigo, verificador: pkce.verificador }, fetch);
      if (!troca.ok) {
        responder("Não deu certo", "Volte ao Claude para ver o motivo.");
        clearTimeout(prazo);
        fim(troca);
        return;
      }
      let conta = "";
      try {
        const r = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary", {
          headers: { authorization: `Bearer ${troca.accessToken}` },
        });
        if (r.ok) conta = ((await r.json()) as { id?: string }).id ?? "";
      } catch {
        // Só para mostrar "conectado como": não impede a conexão.
      }
      const gravado = await fetch(`${supabase.url}/rest/v1/agenda_google?on_conflict=id`, {
        method: "POST",
        headers: { ...cabecalhosDaChave(supabase.chave), "content-type": "application/json", Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({ id: 1, refresh_token: troca.refreshToken, conta: conta || null, updated_at: new Date().toISOString() }),
      });
      clearTimeout(prazo);
      if (!gravado.ok) {
        const corpo = await gravado.text();
        responder("Quase", "A autorização veio, mas não deu para guardar. Volte ao Claude.");
        fim({
          ok: false,
          erro: corpo.includes("agenda_google")
            ? "a tabela agenda_google não existe no Supabase. Rode o SQL de instalação (supabase/instalar.sql) e conecte de novo."
            : `o Supabase respondeu ${gravado.status}.`,
        });
        return;
      }
      responder("Agenda ligada", "Pronto. Pode fechar esta aba e voltar ao Claude.");
      fim({ ok: true, conta });
    });
    console.log("Abrindo o Google no navegador. Se não abrir, copie este endereço:");
    console.log(url);
    abrir(url);
  });

  servidor.close();
  if (!resultado.ok) {
    console.error(`NÃO CONECTOU: ${resultado.erro}`);
    process.exit(1);
  }
  console.log(`OK: Google Agenda conectada${resultado.conta ? ` (${resultado.conta})` : ""}. O acesso ficou guardado no banco.`);
}

void main();
