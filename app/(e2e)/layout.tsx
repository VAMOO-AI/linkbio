import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "../globals.css";

export const metadata: Metadata = { title: "Teste", robots: { index: false, follow: false } };

/** Rotas /e2e só existem no teste de ponta a ponta. Em produção, 404. */
export default function LayoutDeTeste({ children }: { children: React.ReactNode }) {
  if (process.env.LINKBIO_E2E !== "1") notFound();
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
