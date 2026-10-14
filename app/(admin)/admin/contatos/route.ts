import "server-only";
import { obterSessao } from "@/lib/admin/sessao";
import { csvDeContatos } from "@/lib/lead";
import { listarContatos } from "@/lib/lead-banco";

export const dynamic = "force-dynamic";

/** Planilha dos contatos. Só quem entrou no painel baixa. */
export async function GET(): Promise<Response> {
  const semCache = { "Cache-Control": "no-store" };
  if (!(await obterSessao())) {
    return new Response("Entre no painel para baixar os contatos.", { status: 401, headers: semCache });
  }
  let csv: string;
  try {
    csv = csvDeContatos(await listarContatos(5000));
  } catch (erro) {
    console.error("[linkbio admin] csv de contatos", erro);
    return new Response("Não foi possível montar a planilha agora.", { status: 500, headers: semCache });
  }
  return new Response(csv, {
    headers: {
      ...semCache,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="contatos.csv"',
    },
  });
}
