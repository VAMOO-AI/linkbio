"use server";

import { redirect } from "next/navigation";
import { entrar, entrarComCodigo, exigirSessao, pedirCodigo, sair } from "@/lib/admin/sessao";
import { descartarRascunho, guardarImagem, restaurarArquivo, restaurarVersao, salvarRascunho, salvarVersao, type Problema, type ResultadoSalvar } from "@/lib/admin/dados";

export type EstadoLogin = { erro?: string; email?: string; info?: string };

const FORA_DO_AR = "Não foi possível falar com o banco agora. Tente de novo em instantes.";

/** Falha de rede ou do banco vira mensagem para a pessoa, não tela de erro. O redirect do Next passa direto. */
async function comAviso<T>(fn: () => Promise<T>, falha: (msg: string) => T): Promise<T> {
  try {
    return await fn();
  } catch (erro) {
    if (erro && typeof erro === "object" && "digest" in erro && String((erro as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw erro;
    console.error("[linkbio admin]", erro);
    return falha(FORA_DO_AR);
  }
}

export async function acaoEntrar(_: EstadoLogin, dados: FormData): Promise<EstadoLogin> {
  const email = String(dados.get("email") ?? "");
  const modo = String(dados.get("modo") ?? "senha");
  if (modo === "pedir") {
    const r = await comAviso(() => pedirCodigo(email), (erro) => ({ ok: false as const, erro }));
    if (!r.ok) return { erro: r.erro, email };
    return { email, info: r.mensagem };
  }
  if (modo === "codigo") {
    const r = await comAviso(() => entrarComCodigo(email, String(dados.get("codigo") ?? "")), (erro) => ({ ok: false as const, erro }));
    if (!r.ok) return { erro: r.erro, email };
    redirect("/admin");
  }
  const r = await comAviso(() => entrar(email, String(dados.get("senha") ?? "")), (erro) => ({ ok: false as const, erro }));
  // Devolve o e-mail: o React limpa o formulário depois do envio e a pessoa não precisa digitar de novo.
  if (!r.ok) return { erro: r.erro, email };
  redirect("/admin");
}

export async function acaoSair(): Promise<void> {
  await sair();
  redirect("/admin/login");
}

export async function acaoSalvar(config: unknown): Promise<ResultadoSalvar> {
  const email = await exigirSessao();
  return comAviso(() => salvarVersao(config, email), (mensagem) => ({ ok: false as const, problemas: [{ caminho: "", mensagem }] }));
}

export async function acaoRestaurar(id: number): Promise<ResultadoSalvar> {
  const email = await exigirSessao();
  return comAviso(() => restaurarVersao(id, email), (mensagem) => ({ ok: false as const, problemas: [{ caminho: "", mensagem }] }));
}

export async function acaoRestaurarArquivo(): Promise<ResultadoSalvar> {
  const email = await exigirSessao();
  return comAviso(() => restaurarArquivo(email), (mensagem) => ({ ok: false as const, problemas: [{ caminho: "", mensagem }] }));
}

export async function acaoEnviarImagem(dados: FormData): Promise<{ ok: true; url: string } | { ok: false; erro: string }> {
  await exigirSessao();
  const arquivo = dados.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) return { ok: false, erro: "Escolha uma imagem." };
  return comAviso(() => guardarImagem(arquivo), (erro) => ({ ok: false as const, erro }));
}

export async function acaoRascunho(config: unknown): Promise<{ ok: true; em: string } | { ok: false; problemas: Problema[] }> {
  const email = await exigirSessao();
  return comAviso(() => salvarRascunho(config, email), (mensagem) => ({ ok: false as const, problemas: [{ caminho: "", mensagem }] }));
}

export async function acaoDescartar(): Promise<{ ok: boolean }> {
  const email = await exigirSessao();
  return comAviso<{ ok: boolean }>(async () => { await descartarRascunho(email); return { ok: true }; }, () => ({ ok: false }));
}

