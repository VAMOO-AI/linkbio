import { scriptDeCookies } from "@/lib/aviso-cookies";

/** Mesmo aviso da bio, com IDs de teste, para o fluxo de aceite e recusa. */
export default function PaginaPixel() {
  const script = scriptDeCookies({ meta: "123456789012345", ga4: "G-TESTE1234", clarity: "teste1234a" });
  return (
    <>
      <a href="https://wa.me/5511987654321">WhatsApp</a>
      <a href="/r/cta.falar?wa=1">WhatsApp pelo atalho</a>
      <a href="/r/links.curso.0">Curso</a>
      <div data-linkbio-evento="Lead" data-linkbio-evento-id="pedido-1" data-linkbio-evento-metodo="formulario" />
      {script && <script dangerouslySetInnerHTML={{ __html: script }} />}
    </>
  );
}
