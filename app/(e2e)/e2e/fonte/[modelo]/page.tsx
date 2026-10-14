import { notFound } from "next/navigation";
import { PRESETS } from "@/config/presets";
import type { Theme } from "@/config/schema";
import { resolverTema } from "@/lib/resolver";
import { cssDasFontes, hrefsParaPreload } from "@/lib/preloads-fonte";

/** HTML com os preloads do modelo, para o teste conferir duas fontes diferentes. */
export default async function PaginaFonte({ params }: { params: Promise<{ modelo: string }> }) {
  const { modelo } = await params;
  if (!(modelo in PRESETS)) notFound();
  const tema = resolverTema({ preset: modelo as Theme["preset"] });
  const hrefs = hrefsParaPreload(tema.font, cssDasFontes());
  return (
    <>
      {hrefs.map((href) => (
        <link key={href} rel="preload" href={href} as="font" type="font/woff2" crossOrigin="anonymous" />
      ))}
      <p>{modelo}</p>
    </>
  );
}
