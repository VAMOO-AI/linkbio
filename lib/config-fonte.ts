import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import arquivo from "@/linkbio.config";
import type { LinkbioConfig } from "@/config/schema";
import { segundosAteProximaFronteira } from "./janela";
import { resolverOrigem } from "./origem-config";
import { resolverTema } from "./resolver";

/** Tag do cache da config publicada. O /admin revalida esta tag ao salvar. */
export const TAG_CONFIG = "linkbio-config";

export type Versao = { id: number; created_at: string; created_by: string | null };

/**
 * A página é estática até o /admin publicar. Com alguma fronteira de `visivel` pela frente, esta
 * chamada encurta o revalidate da rota até esse instante (mínimo 1 minuto, máximo 1 ano). É o modelo
 * sem Cache Components: `unstable_cache` com `revalidate` entra no menor prazo da rota. A cron diária
 * fica com o keepalive — o plano grátis só permite uma, e uma hora marcada não pode esperar o dia.
 */
async function segurarPaginaAteAJanela(config: LinkbioConfig): Promise<void> {
  const segundos = segundosAteProximaFronteira(config.blocks, new Date(), config.site.tz);
  if (segundos === null) return;
  await unstable_cache(async () => null, ["linkbio-janela"], { revalidate: segundos, tags: [TAG_CONFIG] })();
}

/**
 * Config publicada: a última versão salva pelo /admin (tabela site_config), validada pelo mesmo schema.
 * Sem Supabase, sem versão salva ou com versão inválida, vale o linkbio.config.ts (o template funciona sem banco).
 */
export const obterConfig = cache(async (): Promise<LinkbioConfig> => {
  const origem = await resolverOrigem({
    supabaseUrl: process.env.SUPABASE_URL,
    chave: process.env.SUPABASE_SERVICE_ROLE_KEY,
    arquivo,
    cache: "force-cache",
    next: { tags: [TAG_CONFIG] },
  });
  await segurarPaginaAteAJanela(origem.config);
  return origem.config;
});

export const obterTema = cache(async () => resolverTema((await obterConfig()).theme));

/** A config do arquivo, para o /admin oferecer "voltar ao arquivo original". */
export const configDoArquivo = arquivo;
