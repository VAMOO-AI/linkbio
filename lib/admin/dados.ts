import "server-only";
import { cache } from "react";
import { revalidateTag } from "next/cache";
import { ConfigSchema, type LinkbioConfig } from "@/config/schema";
import { configDoArquivo, TAG_CONFIG } from "@/lib/config-fonte";
import { enviarArquivo, rest } from "@/lib/supabase";
import { ERRO_IMAGEM_GRANDE, TAMANHO_MAX_IMAGEM } from "@/lib/admin/limites";
import { mensagemParaLeigo } from "@/lib/admin/mensagens";
import { diaMenos, diaNoFuso, resumirCliques, type LinhaClique, type TotalBotao, type TotalOrigem } from "@/lib/cliques";
import { nomesDosBotoes } from "@/lib/cliques-destino";

export type Versao = { id: number; created_at: string; created_by: string | null; nota: string | null };
export type Problema = { caminho: string; mensagem: string };
export type ResultadoSalvar = { ok: true; versao: number } | { ok: false; problemas: Problema[] };

/**
 * A versão publicada (sem cache de CDN) ou, se não houver, o arquivo.
 * `cache`: dentro da mesma requisição, quem perguntar de novo recebe a mesma resposta.
 */
export const lerPublicada = cache(async function lerPublicada(): Promise<{
  config: LinkbioConfig;
  origem: "banco" | "arquivo";
  versao: number | null;
}> {
  const linhas = await rest<{ id: number; config: unknown }[]>("site_config?select=id,config&order=id.desc&limit=1", {
    cache: "no-store",
  });
  const r = linhas?.[0] ? ConfigSchema.safeParse(linhas[0].config) : null;
  if (r?.success) return { config: r.data, origem: "banco", versao: linhas[0]!.id };
  return { config: configDoArquivo, origem: "arquivo", versao: null };
});

type Rascunho = { config: unknown; updated_at: string };

async function lerRascunhoBruto(email: string): Promise<Rascunho | null> {
  const linhas = await rest<Rascunho[]>(
    `site_config_rascunho?select=config,updated_at&email=eq.${encodeURIComponent(email)}&limit=1`,
    { cache: "no-store" },
  );
  return linhas?.[0] ?? null;
}

/** O que o editor abre: o rascunho da pessoa, se existir; senão a versão publicada. */
export async function lerConfigEditavel(email: string) {
  const [publicada, rascunho] = await Promise.all([lerPublicada(), lerRascunhoBruto(email)]);
  return { ...publicada, rascunho: rascunho ? { config: rascunho.config as LinkbioConfig, em: rascunho.updated_at } : null };
}

/**
 * Config que a prévia abre: o último rascunho válido da pessoa ou a publicada.
 * `cache`: o layout e a page da prévia pedem a mesma coisa na mesma requisição.
 */
export const lerConfigDaPrevia = cache(async function lerConfigDaPrevia(email: string): Promise<LinkbioConfig> {
  const rascunho = await lerRascunhoBruto(email);
  const r = rascunho ? ConfigSchema.safeParse(rascunho.config) : null;
  return r?.success ? r.data : (await lerPublicada()).config;
});

/** Problemas para o painel: caminho para achar o campo e a mensagem sem o nome técnico dele. */
function problemasDe(issues: { path: PropertyKey[]; message: string }[]): Problema[] {
  return issues.map((i) => ({ caminho: i.path.map(String).join("."), mensagem: mensagemParaLeigo(i.message) }));
}

/**
 * Rascunho automático: só grava se a config for válida (a prévia sempre mostra algo que publicaria).
 * Inválida: devolve os problemas e mantém o último rascunho válido.
 */
export async function salvarRascunho(entrada: unknown, email: string): Promise<{ ok: true; em: string } | { ok: false; problemas: Problema[] }> {
  const r = ConfigSchema.safeParse(entrada);
  if (!r.success) return { ok: false, problemas: problemasDe(r.error.issues) };
  const em = new Date().toISOString();
  await rest("site_config_rascunho?on_conflict=email", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ email, config: entrada, updated_at: em }),
  });
  return { ok: true, em };
}

export async function descartarRascunho(email: string): Promise<void> {
  await rest(`site_config_rascunho?email=eq.${encodeURIComponent(email)}`, { method: "DELETE" });
}

export async function listarVersoes(limite = 20): Promise<Versao[]> {
  return rest<Versao[]>(`site_config?select=id,created_at,created_by,nota&order=id.desc&limit=${limite}`, {
    cache: "no-store",
  });
}

/** Valida com o mesmo schema do build; só grava config válida. Publica na hora (revalida a página). */
export async function salvarVersao(entrada: unknown, email: string, nota?: string): Promise<ResultadoSalvar> {
  const r = ConfigSchema.safeParse(entrada);
  if (!r.success) return { ok: false, problemas: problemasDe(r.error.issues) };
  const [linha] = await rest<{ id: number }[]>("site_config?select=id", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ config: r.data, created_by: email, nota: nota ?? null }),
  });
  revalidateTag(TAG_CONFIG, { expire: 0 });
  // Publicou: o rascunho de quem publicou deixa de existir (a prévia passa a mostrar o publicado).
  await descartarRascunho(email);
  return { ok: true, versao: linha!.id };
}

/** Volta a uma versão antiga criando uma versão nova com o conteúdo dela (o histórico nunca é apagado). */
export async function restaurarVersao(id: number, email: string): Promise<ResultadoSalvar> {
  const [linha] = await rest<{ config: unknown }[]>(`site_config?select=config&id=eq.${Number(id)}&limit=1`, {
    cache: "no-store",
  });
  if (!linha) return { ok: false, problemas: [{ caminho: "", mensagem: `Versão ${id} não encontrada.` }] };
  return salvarVersao(linha.config, email, `restaurada da versão ${id}`);
}

/**
 * Volta ao linkbio.config.ts: publica o conteúdo do arquivo como versão nova. É a saída da primeira
 * publicação, que antes não tinha para onde voltar (o histórico continua inteiro).
 */
export async function restaurarArquivo(email: string): Promise<ResultadoSalvar> {
  return salvarVersao(configDoArquivo, email, "restaurada do arquivo original");
}

const TIPOS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

export type ResumoCliques = { erro: boolean; botoes: TotalBotao[]; origens: TotalOrigem[] };

/** Totais dos últimos 30 dias. A data é a da bio, não a do servidor. */
export async function lerCliques(config: LinkbioConfig): Promise<ResumoCliques> {
  const hoje = diaNoFuso(config.site.tz);
  const linhas = await rest<LinhaClique[]>(`cliques?select=dia,alvo,origem,total&dia=gte.${diaMenos(hoje, 29)}`, {
    cache: "no-store",
  });
  return { erro: false, ...resumirCliques(linhas ?? [], nomesDosBotoes(config), hoje) };
}

export async function guardarImagem(arquivo: File): Promise<{ ok: true; url: string } | { ok: false; erro: string }> {
  const ext = TIPOS[arquivo.type];
  if (!ext) return { ok: false, erro: "Envie uma imagem JPG, PNG, WebP ou GIF." };
  if (arquivo.size > TAMANHO_MAX_IMAGEM) return { ok: false, erro: ERRO_IMAGEM_GRANDE };
  const nome = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
  const url = await enviarArquivo("linkbio", nome, arquivo, arquivo.type);
  return { ok: true, url };
}
