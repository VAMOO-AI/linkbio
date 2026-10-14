import { ConfigSchema, type LinkbioConfig } from "@/config/schema";
import { cabecalhosDaChave } from "./supabase-chave";

export const MOTIVOS_ARQUIVO = ["sem-supabase", "sem-versao", "versao-invalida", "erro-banco"] as const;
export type MotivoArquivo = (typeof MOTIVOS_ARQUIVO)[number];

export type OrigemConfig =
  | { fonte: "banco"; config: LinkbioConfig; ultimaPublicacao?: string }
  | { fonte: "arquivo"; motivo: MotivoArquivo; config: LinkbioConfig };

type BuscaInit = RequestInit & { next?: { tags?: string[] } };

export type OpcoesOrigem = {
  supabaseUrl?: string;
  chave?: string;
  arquivo: LinkbioConfig;
  fetch?: typeof fetch;
  cache?: RequestCache;
  next?: { tags?: string[] };
  log?: (...args: unknown[]) => void;
};

/**
 * De onde vem a config publicada. O `obterConfig` continua devolvendo só a config;
 * a rota de saúde e o ping usam o motivo quando a resposta cai no arquivo.
 */
export async function resolverOrigem(o: OpcoesOrigem): Promise<OrigemConfig> {
  const url = o.supabaseUrl?.trim().replace(/\/$/, "") ?? "";
  const chave = o.chave?.trim() ?? "";
  if (!url || !chave) return { fonte: "arquivo", motivo: "sem-supabase", config: o.arquivo };

  const log = o.log ?? console.error;
  const buscar = o.fetch ?? fetch;
  try {
    const init: BuscaInit = {
      headers: { ...cabecalhosDaChave(chave), "Content-Type": "application/json" },
      cache: o.cache ?? "force-cache",
    };
    if (o.next) init.next = o.next;
    const resp = await buscar(`${url}/rest/v1/site_config?select=config,created_at&order=id.desc&limit=1`, init);
    if (!resp.ok) {
      const corpo = await resp.text();
      throw new Error(`Supabase ${resp.status} em site_config: ${corpo.slice(0, 300)}`);
    }
    const texto = await resp.text();
    const linhas = (texto ? JSON.parse(texto) : null) as { config?: unknown; created_at?: unknown }[] | null;
    if (!Array.isArray(linhas) || linhas.length === 0) {
      return { fonte: "arquivo", motivo: "sem-versao", config: o.arquivo };
    }
    const linha = linhas[0]!;
    const r = ConfigSchema.safeParse(linha.config);
    if (!r.success) {
      log("[linkbio] versão salva no banco é inválida; usando linkbio.config.ts", r.error.issues.slice(0, 3));
      return { fonte: "arquivo", motivo: "versao-invalida", config: o.arquivo };
    }
    const criada = typeof linha.created_at === "string" && linha.created_at ? linha.created_at : undefined;
    return { fonte: "banco", config: r.data, ultimaPublicacao: criada };
  } catch (erro) {
    log("[linkbio] não foi possível ler a config do banco; usando linkbio.config.ts", erro);
    return { fonte: "arquivo", motivo: "erro-banco", config: o.arquivo };
  }
}
