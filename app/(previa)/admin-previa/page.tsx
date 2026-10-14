import { exigirSessao } from "@/lib/admin/sessao";
import { lerConfigDaPrevia } from "@/lib/admin/dados";
import { PreviaAoVivo } from "./ao-vivo";

export const dynamic = "force-dynamic";

/** O quadro carrega uma vez por abertura do painel; o resto das edições não passa por aqui. */
export default async function Previa() {
  return <PreviaAoVivo inicial={await lerConfigDaPrevia(await exigirSessao())} />;
}
