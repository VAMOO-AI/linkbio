import "server-only";
import type { ContatoLista, LeadGravado } from "./lead";
import { semColunaDeOrigem } from "./origem";
import { rest, supabaseConfigurado } from "./supabase";

export async function contarLeadsRecentes(hash: string, desdeIso: string): Promise<number> {
  const linhas = await rest<{ id: string }[]>(
    `leads?select=id&ip_hash=eq.${encodeURIComponent(hash)}&created_at=gte.${encodeURIComponent(desdeIso)}&limit=5`,
    { cache: "no-store" },
  );
  return linhas?.length ?? 0;
}

/** Grava o contato. Banco sem as colunas de origem (SQL novo não rodado) grava sem elas, sem perder o lead. */
export async function gravarLead(lead: LeadGravado): Promise<void> {
  try {
    await rest("leads", { method: "POST", body: JSON.stringify(lead), cache: "no-store" });
  } catch (erro) {
    if (!semColunaDeOrigem(erro)) throw erro;
    console.error("[linkbio] leads sem as colunas origem/utm: rode supabase/migrations/0010_origem.sql. Contato gravado sem a origem.");
    const { origem: _o, utm: _u, ...semOrigem } = lead;
    await rest("leads", { method: "POST", body: JSON.stringify(semOrigem), cache: "no-store" });
  }
}

export async function listarContatos(limite = 50): Promise<ContatoLista[]> {
  if (!supabaseConfigurado()) return [];
  const linhas = await rest<ContatoLista[]>(
    `leads?select=id,bloco,nome,whatsapp,email,created_at&order=created_at.desc&limit=${limite}`,
    { cache: "no-store" },
  );
  return (linhas ?? []).map((l) => ({ ...l, id: String(l.id) }));
}
