import { renderBlock } from "@/blocks/registry";
import { blocosAtivos } from "@/lib/blocos";
import { chavesDosBlocos } from "@/lib/cliques";
import { obterConfig, obterTema } from "@/lib/config-fonte";
import { supabaseConfigurado } from "@/lib/supabase";

/**
 * Página da bio. `testeIa` só é ligado pela página de teste, quando ANTHROPIC_BASE_URL existe:
 * a página publicada continua no modo da config.
 */
export async function PaginaPublica({ testeIa = false }: { testeIa?: boolean }) {
  const config = await obterConfig();
  const tema = await obterTema();
  // Só com a contagem ligada e o banco no ar. Sem isso, `chave` fica null e o HTML dos links não muda.
  const chaves = config.features.analytics === true && supabaseConfigurado() ? chavesDosBlocos(config.blocks) : null;
  const captura = supabaseConfigurado();
  // A chave fica neste módulo de servidor. O registro dos blocos também roda na prévia, no navegador.
  const chaveIa = Boolean(process.env.ANTHROPIC_API_KEY);
  return (
    <>
      {blocosAtivos(config.blocks, new Date(), config.site.tz).map((block, i) =>
        renderBlock(block, i, config, tema, chaves ? (chaves[config.blocks.indexOf(block)] ?? null) : null, {
          captura,
          abertoEm: 0,
          ia: block.type === "concierge" && chaveIa && (block.mode === "ia" || testeIa),
          teste: testeIa,
        }),
      )}
    </>
  );
}
