import { resolverOrigem, type MotivoArquivo, type OpcoesOrigem, type OrigemConfig } from "./origem-config";
import { versaoDoPacote } from "./versao-pacote";

export type CorpoSaude = {
  versao: string;
  fonte: "banco" | "arquivo";
  motivo?: MotivoArquivo;
  ultimaPublicacao?: string;
  ok: boolean;
};

/** JSON público: sem config, sem chave, sem texto de erro do banco. */
export function corpoDaSaude(origem: OrigemConfig, versao: string): CorpoSaude {
  if (origem.fonte === "banco") {
    const corpo: CorpoSaude = { versao, fonte: "banco", ok: true };
    if (origem.ultimaPublicacao) corpo.ultimaPublicacao = origem.ultimaPublicacao;
    return corpo;
  }
  const ok = origem.motivo === "sem-supabase" || origem.motivo === "sem-versao";
  return { versao, fonte: "arquivo", motivo: origem.motivo, ok };
}

/** Leitura fresca (sem cache) para a rota /api/saude. */
export async function consultarSaude(o: OpcoesOrigem & { versao?: string; root?: string }): Promise<CorpoSaude> {
  const origem = await resolverOrigem({ ...o, cache: "no-store" });
  return corpoDaSaude(origem, o.versao ?? versaoDoPacote(o.root));
}
