import { renderBlock } from "@/blocks/registry";
import { blocosAtivos } from "@/lib/blocos";
import { chavesDosBlocos } from "@/lib/cliques";
import { obterConfig, obterTema } from "@/lib/config-fonte";
import { cssDeOrigem } from "@/lib/origem";
import { supabaseConfigurado } from "@/lib/supabase";
import { agendamentoNoAmbiente } from "@/lib/agendamento/servidor";
import { avatarNaData } from "@/lib/perfil";
import { PorOrigem } from "./por-origem";

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
  const agendamento = agendamentoNoAmbiente();
  // Regras de origem viram CSS: o HTML é o mesmo para todo mundo e o <head> marca a origem (lib/origem.ts).
  const css = cssDeOrigem(config.blocks);
  const agora = new Date();
  const avatar = avatarNaData(config.profile, agora, config.site.tz);
  return (
    <>
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
      {blocosAtivos(config.blocks, agora, config.site.tz).map((block, i) => {
        const pos = config.blocks.indexOf(block);
        const el = renderBlock(block, i, config, tema, chaves ? (chaves[pos] ?? null) : null, {
          captura,
          abertoEm: 0,
          ia: block.type === "concierge" && chaveIa && (block.mode === "ia" || testeIa),
          teste: testeIa,
          agendamento,
          avatar,
        });
        return (
          <PorOrigem key={`bloco-${pos}`} origem={block.origem} pos={pos}>
            {el}
          </PorOrigem>
        );
      })}
    </>
  );
}
