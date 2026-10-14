import { notFound } from "next/navigation";
import { PaginaPublica } from "../pagina";

/**
 * Só existe quando ANTHROPIC_BASE_URL está definida (o teste aponta a API falsa).
 * Em produção, sem essa variável, a rota não aparece.
 */
export default function Page() {
  if (!process.env.ANTHROPIC_BASE_URL) notFound();
  return <PaginaPublica testeIa />;
}
