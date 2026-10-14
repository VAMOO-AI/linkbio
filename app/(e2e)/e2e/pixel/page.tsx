import { scriptDeCookies } from "@/lib/aviso-cookies";

/** Mesmo aviso da bio, com IDs de teste, para o fluxo de aceite e recusa. */
export default function PaginaPixel() {
  const script = scriptDeCookies("123456789012345", "G-TESTE1234");
  return (
    <>
      <a href="https://wa.me/5511987654321">WhatsApp</a>
      <a href="/r/cta.falar?wa=1">WhatsApp pelo atalho</a>
      {script && <script dangerouslySetInnerHTML={{ __html: script }} />}
    </>
  );
}
