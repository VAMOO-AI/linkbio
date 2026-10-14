import Link from "next/link";
import { blocosAtivos } from "@/lib/blocos";
import { obterConfig } from "@/lib/config-fonte";

export const dynamic = "force-dynamic";

/** Tela depois do envio. O link do material sai da config, não do endereço. */
export default async function ContatoEnviado({
  searchParams,
}: {
  searchParams: Promise<{ bloco?: string | string[] }>;
}) {
  const pedido = (await searchParams).bloco;
  const id = Array.isArray(pedido) ? pedido[0] : pedido;
  const config = await obterConfig();
  const ativos = blocosAtivos(config.blocks);
  const bloco = ativos.find((b, i) => b.type === "lead" && (b.id ?? `lead-${i}`) === id);
  const sucesso = bloco?.type === "lead" ? bloco.sucesso : "Recebemos seu contato.";
  const entrega = bloco?.type === "lead" ? bloco.entrega?.url : undefined;
  return (
    <section className="bloco-lead" aria-label="Contato enviado">
      <h2 className="lead-titulo">{sucesso}</h2>
      {entrega && (
        <a className="bloco-cta" href={entrega}>
          Abrir o material
        </a>
      )}
      <Link className="lead-voltar" href="/">
        Voltar para a bio
      </Link>
    </section>
  );
}
