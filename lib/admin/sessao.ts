import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { rest, supabaseConfigurado } from "@/lib/supabase";
import { conferirSenha, criarToken, lerToken } from "./cripto";
import {
  CODIGO_VALIDADE_SEG,
  JANELA_MIN,
  MSG_BLOQUEIO,
  MSG_CODIGO_RUIM,
  MSG_ENVIO_FALHOU,
  MSG_SEM_ENVIO,
  conferirCodigo,
  decidirConfirmacao,
  decidirPedido,
  expirado,
  hashCodigo,
} from "./codigo";
import { enviarCodigoPorEmail } from "./email";

const COOKIE = "lb_admin";
const VALIDADE = 7 * 24 * 3600;

/** O /admin só funciona com banco e segredo de sessão configurados. Devolve o que falta, em PT-BR. */
export function faltaParaOAdmin(): string[] {
  const falta: string[] = [];
  if (!supabaseConfigurado()) falta.push("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY");
  if ((process.env.ADMIN_SESSION_SECRET ?? "").length < 32) falta.push("ADMIN_SESSION_SECRET (32 caracteres ou mais)");
  return falta;
}

function segredo(): string {
  const s = process.env.ADMIN_SESSION_SECRET ?? "";
  if (s.length < 32) throw new Error("ADMIN_SESSION_SECRET ausente ou curto.");
  return s;
}

type Usuario = { id: string; email: string; password_hash: string | null };
type CodigoGuardado = { id: number; code_hash: string; expires_at: string; used_at: string | null };

async function usuarioPorEmail(email: string): Promise<Usuario | null> {
  const linhas = await rest<Usuario[]>(
    `admin_users?select=id,email,password_hash&email=eq.${encodeURIComponent(email)}&limit=1`,
    { cache: "no-store" },
  );
  return linhas?.[0] ?? null;
}

function desdeJanela(): string {
  return new Date(Date.now() - JANELA_MIN * 60_000).toISOString();
}

async function contarFalhas(email: string): Promise<number> {
  const falhas = await rest<{ id: number }[]>(
    `admin_login_attempts?select=id&email=eq.${encodeURIComponent(email)}&ok=eq.false&created_at=gte.${encodeURIComponent(desdeJanela())}`,
    { cache: "no-store" },
  );
  return falhas.length;
}

async function contarEnvios(email: string): Promise<number> {
  const envios = await rest<{ id: number }[]>(
    `admin_login_codes?select=id&email=eq.${encodeURIComponent(email)}&created_at=gte.${encodeURIComponent(desdeJanela())}`,
    { cache: "no-store" },
  );
  return envios.length;
}

async function registrarFalha(email: string): Promise<void> {
  await rest("admin_login_attempts", { method: "POST", body: JSON.stringify({ email, ok: false }) });
}

async function abrirSessao(usuario: Usuario): Promise<void> {
  await rest(`admin_users?id=eq.${usuario.id}`, {
    method: "PATCH",
    body: JSON.stringify({ last_login_at: new Date().toISOString() }),
  });
  (await cookies()).set(COOKIE, criarToken(usuario.email, segredo(), VALIDADE), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: VALIDADE,
  });
}

/**
 * E-mail da pessoa logada (e ainda cadastrada), ou null. Banco fora do ar conta como sem sessão.
 * `cache`: layout e page da mesma página pedem a sessão, e ela vale uma consulta só por requisição.
 */
export const obterSessao = cache(async function obterSessao(): Promise<string | null> {
  if (faltaParaOAdmin().length) return null;
  const email = lerToken((await cookies()).get(COOKIE)?.value, segredo());
  if (!email) return null;
  try {
    return (await usuarioPorEmail(email)) ? email : null;
  } catch (erro) {
    console.error("[linkbio admin] banco fora do ar ao conferir a sessão", erro);
    return null;
  }
});

/** Use no topo de toda página e ação do /admin. Sem sessão, vai para o login. */
export async function exigirSessao(): Promise<string> {
  const email = await obterSessao();
  if (!email) redirect("/admin/login");
  return email;
}

export type ResultadoLogin = { ok: true } | { ok: false; erro: string };
export type ResultadoPedido = { ok: true; mensagem: string } | { ok: false; erro: string };

function emailLimpo(bruto: string): string {
  return bruto.trim().toLowerCase();
}

function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Pede o código. A resposta é a mesma para e-mail cadastrado ou não. */
export async function pedirCodigo(emailBruto: string): Promise<ResultadoPedido> {
  const email = emailLimpo(emailBruto);
  if (!emailValido(email)) return { ok: false, erro: "Informe um e-mail válido." };
  if (!(process.env.RESEND_API_KEY ?? "").trim()) return { ok: false, erro: MSG_SEM_ENVIO };

  const falhas = await contarFalhas(email);
  const envios = await contarEnvios(email);
  const usuario = await usuarioPorEmail(email);
  const decisao = decidirPedido({ emailValido: true, falhas, envios, cadastrado: Boolean(usuario) });
  if (decisao.tipo === "bloqueado") return { ok: false, erro: decisao.erro };

  const pepper = segredo();
  const codigo = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const code_hash = decisao.tipo === "enviar" ? hashCodigo(codigo, pepper) : hashCodigo(randomBytes(32).toString("hex"), pepper);
  const expires_at = new Date(Date.now() + CODIGO_VALIDADE_SEG * 1000).toISOString();

  await rest(`admin_login_codes?email=eq.${encodeURIComponent(email)}&used_at=is.null`, {
    method: "PATCH",
    body: JSON.stringify({ used_at: new Date().toISOString() }),
  });
  await rest("admin_login_codes", {
    method: "POST",
    body: JSON.stringify({ email, code_hash, expires_at, used_at: null }),
  });

  if (decisao.tipo === "enviar") {
    try {
      await enviarCodigoPorEmail(email, codigo);
    } catch (erro) {
      console.error("[linkbio admin] falha ao enviar o código", erro instanceof Error ? erro.message : erro);
      await rest(
        `admin_login_codes?email=eq.${encodeURIComponent(email)}&code_hash=eq.${encodeURIComponent(code_hash)}&used_at=is.null`,
        { method: "PATCH", body: JSON.stringify({ used_at: new Date().toISOString() }) },
      ).catch(() => undefined);
      return { ok: false, erro: MSG_ENVIO_FALHOU };
    }
  }
  return { ok: true, mensagem: decisao.mensagem };
}

/** Confere o código, marca como usado e abre a sessão. Não devolve o código nem o hash. */
export async function entrarComCodigo(emailBruto: string, codigoBruto: string): Promise<ResultadoLogin> {
  const email = emailLimpo(emailBruto);
  const codigo = codigoBruto.trim();
  const formatoOk = /^\d{6}$/.test(codigo);
  const falhas = formatoOk ? await contarFalhas(email) : 0;
  const usuario = formatoOk && falhas < 5 ? await usuarioPorEmail(email) : null;
  const linhas =
    formatoOk && falhas < 5
      ? await rest<CodigoGuardado[]>(
          `admin_login_codes?select=id,code_hash,expires_at,used_at&email=eq.${encodeURIComponent(email)}&used_at=is.null&order=created_at.desc&limit=5`,
          { cache: "no-store" },
        )
      : [];

  const pepper = formatoOk ? segredo() : "";
  const agora = Date.now();
  let escolhido: CodigoGuardado | null = null;
  let bateu = false;
  let vencido = false;
  let jaUsado = false;
  if (formatoOk && pepper && linhas.length === 0) conferirCodigo(codigo, hashCodigo("000000", pepper), pepper);
  for (const linha of linhas) {
    if (!conferirCodigo(codigo, linha.code_hash, pepper)) continue;
    bateu = true;
    if (linha.used_at) {
      jaUsado = true;
      continue;
    }
    if (expirado(Date.parse(linha.expires_at), agora)) {
      vencido = true;
      continue;
    }
    escolhido = linha;
    break;
  }

  const decisao = decidirConfirmacao({
    formatoOk,
    falhas,
    cadastrado: Boolean(usuario),
    confere: Boolean(escolhido) || (bateu && !vencido && !jaUsado),
    expirado: vencido && !escolhido,
    usado: jaUsado && !escolhido,
  });
  if (!decisao.ok || !escolhido || !usuario) {
    if (!decisao.ok && decisao.contaFalha && emailValido(email)) await registrarFalha(email);
    return { ok: false, erro: decisao.ok ? MSG_CODIGO_RUIM : decisao.erro };
  }

  const atualizados = await rest<Array<{ id: number }>>(
    `admin_login_codes?id=eq.${escolhido.id}&used_at=is.null&select=id`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ used_at: new Date().toISOString() }),
    },
  );
  if (!atualizados?.length) {
    await registrarFalha(email);
    return { ok: false, erro: MSG_CODIGO_RUIM };
  }
  await abrirSessao(usuario);
  return { ok: true };
}

export async function entrar(emailBruto: string, senha: string): Promise<ResultadoLogin> {
  const email = emailLimpo(emailBruto);
  if (!email || !senha) return { ok: false, erro: "Informe e-mail e senha." };
  const falhas = await contarFalhas(email);
  if (falhas >= 5) return { ok: false, erro: MSG_BLOQUEIO };
  const usuario = await usuarioPorEmail(email);
  const certo = usuario?.password_hash ? await conferirSenha(senha, usuario.password_hash) : false;
  await rest("admin_login_attempts", { method: "POST", body: JSON.stringify({ email, ok: certo }) });
  // Mesma mensagem para e-mail inexistente, senha errada e conta sem senha.
  if (!usuario || !certo) return { ok: false, erro: "E-mail ou senha incorretos." };
  await abrirSessao(usuario);
  return { ok: true };
}

export async function sair(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
