import { createHash } from "node:crypto";
import { MOTIVOS_ARQUIVO, type MotivoArquivo } from "./origem-config";
import { cabecalhosDaChave } from "./supabase-chave";

export type PingRecebido = {
  site: string;
  versao: string;
  fonte: "banco" | "arquivo";
  motivo?: MotivoArquivo;
};

const CHAVES = new Set(["site", "versao", "fonte", "motivo"]);

/** Só os quatro campos do ping. Qualquer extra, ou motivo fora da lista, recusa. */
export function lerPing(bruto: unknown): PingRecebido | null {
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return null;
  const o = bruto as Record<string, unknown>;
  if (Object.keys(o).some((k) => !CHAVES.has(k))) return null;
  if (typeof o.site !== "string" || !/^https:\/\/\S{1,180}$/.test(o.site)) return null;
  if (typeof o.versao !== "string" || !/^\d+\.\d+\.\d+$/.test(o.versao)) return null;
  if (o.fonte !== "banco" && o.fonte !== "arquivo") return null;
  if (o.fonte === "banco") {
    if (o.motivo !== undefined) return null;
    return { site: o.site, versao: o.versao, fonte: "banco" };
  }
  if (typeof o.motivo !== "string" || !(MOTIVOS_ARQUIVO as readonly string[]).includes(o.motivo)) return null;
  return { site: o.site, versao: o.versao, fonte: "arquivo", motivo: o.motivo as MotivoArquivo };
}

/** No máximo `limite` pings por hora, por IP. O mapa fica com quem chama. */
export function estourouPing(balde: Map<string, number[]>, ip: string, agora: number, limite = 30): boolean {
  const corte = agora - 3_600_000;
  const lista = (balde.get(ip) ?? []).filter((t) => t > corte);
  if (lista.length >= limite) {
    balde.set(ip, lista);
    return true;
  }
  lista.push(agora);
  balde.set(ip, lista);
  return false;
}

/** Caminho estável: o mesmo site regrava o mesmo arquivo. */
export function caminhoDoPing(site: string): string {
  const id = createHash("sha256").update(site).digest("hex").slice(0, 32);
  return `frota/${id}.json`;
}

async function enviarBlobPadrao(caminho: string, corpo: string, token: string): Promise<void> {
  const { put } = await import("@vercel/blob");
  await put(caminho, corpo, {
    access: "private",
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

/** 404 = este deploy não é o hub. 204 = gravou. 502 = o banco recusou. */
export async function gravarPing(e: {
  ligado: boolean;
  supabaseUrl?: string;
  chave?: string;
  tokenBlob?: string;
  ping: PingRecebido;
  agora?: Date;
  fetch?: typeof fetch;
  enviarBlob?: (caminho: string, corpo: string, token: string) => Promise<void>;
}): Promise<number> {
  if (!e.ligado) return 404;
  const tokenBlob = e.tokenBlob?.trim() ?? "";
  if (tokenBlob) {
    const corpo = JSON.stringify({
      site: e.ping.site,
      versao: e.ping.versao,
      fonte: e.ping.fonte,
      motivo: e.ping.motivo ?? null,
      visto_em: (e.agora ?? new Date()).toISOString(),
    });
    try {
      await (e.enviarBlob ?? enviarBlobPadrao)(caminhoDoPing(e.ping.site), corpo, tokenBlob);
      return 204;
    } catch {
      return 502;
    }
  }
  const url = e.supabaseUrl?.trim().replace(/\/$/, "");
  const chave = e.chave?.trim();
  if (!url || !chave) return 503;
  const buscar = e.fetch ?? fetch;
  let resp: Response;
  try {
    resp = await buscar(`${url}/rest/v1/frota_ping?on_conflict=site`, {
      method: "POST",
      headers: {
        ...cabecalhosDaChave(chave),
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        site: e.ping.site,
        versao: e.ping.versao,
        fonte: e.ping.fonte,
        motivo: e.ping.motivo ?? null,
        visto_em: (e.agora ?? new Date()).toISOString(),
      }),
      cache: "no-store",
    });
  } catch {
    return 502;
  }
  return resp.ok ? 204 : 502;
}
