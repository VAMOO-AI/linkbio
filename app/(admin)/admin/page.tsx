import { redirect } from "next/navigation";
import { z } from "zod";
import { ConfigSchema } from "@/config/schema";
import { OPCOES } from "@/config/opcoes";
import { PRESETS } from "@/config/presets";
import { faltaParaOAdmin, exigirSessao } from "@/lib/admin/sessao";
import { lerCliques, lerConfigEditavel, listarVersoes, type ResumoCliques } from "@/lib/admin/dados";
import { listarContatos } from "@/lib/lead-banco";
import { Editor } from "./editor";
import type { Esquema } from "./campos";

export const dynamic = "force-dynamic";

export default async function Admin() {
  if (faltaParaOAdmin().length) redirect("/admin/login");
  const email = await exigirSessao();
  let dados;
  try {
    dados = await Promise.all([lerConfigEditavel(email), listarVersoes()]);
  } catch (erro) {
    console.error("[linkbio admin] banco fora do ar ao abrir o painel", erro);
    return (
      <main className="adm-login">
        <h1>Painel da bio</h1>
        <p className="adm-aviso adm-aviso-erro">Não foi possível falar com o banco agora. Recarregue a página em instantes.</p>
      </main>
    );
  }
  const [editavel, versoes] = dados;
  let cliques: ResumoCliques = { erro: false, botoes: [], origens: [] };
  try {
    cliques = await lerCliques(editavel.config);
  } catch (erro) {
    console.error("[linkbio admin] não foi possível ler os cliques", erro);
    cliques = { erro: true, botoes: [], origens: [] };
  }
  let contatos: Awaited<ReturnType<typeof listarContatos>> = [];
  let contatosErro = false;
  try {
    contatos = await listarContatos(30);
  } catch (erro) {
    contatosErro = true;
    console.error("[linkbio admin] contatos", erro);
  }
  // O schema vai ao navegador como JSON (o zod fica no servidor).
  const schema = z.toJSONSchema(ConfigSchema, { io: "input", unrepresentable: "any" });
  const modelos = Object.entries(PRESETS).map(([id, p]) => {
    const pal = (p.paletas.claro ?? p.paletas.escuro)!;
    const info = OPCOES.preset[id as keyof typeof OPCOES.preset];
    return {
      id,
      nome: info.rotulo,
      descricao: info.descricao,
      bg: pal.bg,
      surface: pal.surface,
      text: pal.text,
      dim: pal.dim,
      ctaBg: pal.ctaBg,
      ctaText: pal.ctaText,
      line: pal.line,
      accent: (p.accent.claro ?? p.accent.escuro)!,
    };
  });
  const json = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
  return (
    <Editor
      inicial={json(editavel.rascunho?.config ?? editavel.config)}
      publicada={json(editavel.config)}
      rascunhoEm={editavel.rascunho?.em ?? null}
      schema={json(schema) as Esquema}
      opcoes={json(OPCOES)}
      modelos={modelos}
      versoes={versoes}
      email={email}
      cliques={cliques}
      contatos={contatos}
      contatosErro={contatosErro}
    />
  );
}
