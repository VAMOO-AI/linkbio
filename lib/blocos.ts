/**
 * Blocos que entram na página: `enabled: false` esconde sem apagar, e `visivel`
 * esconde fora do prazo (fuso `site.tz`, padrão América/São Paulo).
 * Função pura, sem importar a config: serve à página, ao layout e aos testes.
 */
import { dentroDaJanela, FUSO_PADRAO, type Janela } from "./janela";

export function blocosAtivos<T extends { enabled?: boolean; visivel?: Janela }>(
  blocks: readonly T[],
  agora: Date = new Date(),
  tz: string = FUSO_PADRAO,
): T[] {
  return blocks.filter((b) => b.enabled !== false && dentroDaJanela(b.visivel, agora, tz));
}
