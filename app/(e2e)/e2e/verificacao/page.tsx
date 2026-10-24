import type { Metadata } from "next";
import { metadadosDeBusca } from "@/lib/seo";

const base = new URL("https://casa.exemplo.com");

/** Mesmo helper da bio, com códigos de teste: confere a tag que o Next escreve. */
export function generateMetadata(): Metadata {
  return metadadosDeBusca(
    { verificacao: { google: "codigoGoogleDeTeste_1234567890", bing: "0123456789ABCDEF0123456789ABCDEF" } },
    base,
  );
}

export default function PaginaVerificacao() {
  return <p>verificação</p>;
}
