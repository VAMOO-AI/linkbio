/**
 * Conexão da conta Google (npm run google:conectar). Fluxo de app instalado: o navegador da pessoa
 * volta para um endereço local (127.0.0.1) com o código, que vira o refresh token. PKCE e `state`
 * protegem o código. Funções puras: o script cuida do servidor local e do banco.
 */
import { createHash, randomBytes } from "node:crypto";
import { ESCOPOS_GOOGLE, type Busca } from "./google";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function novoPkce(): { verificador: string; desafio: string; state: string } {
  const verificador = base64url(randomBytes(48));
  return {
    verificador,
    desafio: base64url(createHash("sha256").update(verificador).digest()),
    state: base64url(randomBytes(24)),
  };
}

/** `prompt=consent` + `access_type=offline`: sem isso o Google não devolve o refresh token de novo. */
export function urlDeAutorizacao(o: { clientId: string; redirect: string; desafio: string; state: string }): string {
  const p = new URLSearchParams({
    client_id: o.clientId,
    redirect_uri: o.redirect,
    response_type: "code",
    scope: ESCOPOS_GOOGLE.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    code_challenge: o.desafio,
    code_challenge_method: "S256",
    state: o.state,
  });
  return `${AUTH_URL}?${p}`;
}

export type Troca = { ok: true; refreshToken: string; accessToken: string } | { ok: false; erro: string };

export async function trocarCodigo(
  o: { clientId: string; clientSecret: string; redirect: string; codigo: string; verificador: string },
  busca: Busca,
): Promise<Troca> {
  const resp = await busca(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: o.clientId,
      client_secret: o.clientSecret,
      redirect_uri: o.redirect,
      code: o.codigo,
      code_verifier: o.verificador,
      grant_type: "authorization_code",
    }).toString(),
  });
  const corpo = (await resp.json().catch(() => ({}))) as {
    refresh_token?: string;
    access_token?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!resp.ok) return { ok: false, erro: `${corpo.error ?? resp.status}: ${corpo.error_description ?? ""}`.trim() };
  if (!corpo.access_token) return { ok: false, erro: "o Google não devolveu o acesso." };
  if (!corpo.refresh_token) {
    return { ok: false, erro: "o Google não devolveu o refresh token. Remova o acesso do app em myaccount.google.com/permissions e rode de novo." };
  }
  const escopos = (corpo.scope ?? "").split(" ");
  const faltam = ESCOPOS_GOOGLE.filter((e) => !escopos.includes(e));
  if (faltam.length) return { ok: false, erro: "faltou marcar as permissões da agenda na tela do Google. Rode de novo e marque todas." };
  return { ok: true, refreshToken: corpo.refresh_token, accessToken: corpo.access_token };
}
