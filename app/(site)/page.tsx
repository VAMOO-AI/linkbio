import { PaginaPublica } from "./pagina";

/**
 * Página estática: a config publicada (banco ou linkbio.config.ts) é lida uma vez e fica em cache
 * até o /admin salvar uma versão nova (revalidação da tag). Também atualiza de hora em hora, para um
 * evento da agenda sumir depois que passa sem precisar publicar de novo. O número precisa ser um
 * literal (a doc do Next não aceita conta aqui).
 * Se algum bloco tem janela de data, a rota se renova sozinha na próxima fronteira (lib/config-fonte.ts).
 * O relógio do formulário não fica neste HTML (ele pode estar em cache): o proxy grava a hora da visita num cookie.
 */
export const revalidate = 3600;

export default function Page() {
  return <PaginaPublica />;
}
