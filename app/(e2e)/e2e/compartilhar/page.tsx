import { renderBlock } from "@/blocks/registry";
import exemplo from "@/linkbio.config";
import { resolverTema } from "@/lib/resolver";

/** Bloco profile com compartilhar: true, pelo mesmo registry da bio. */
export default function PaginaCompartilhar() {
  const config = { ...exemplo, site: { ...exemplo.site, url: "https://bio.exemplo.com" } };
  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: 16 }}>
      {renderBlock({ type: "profile", compartilhar: true }, 0, config, resolverTema(config.theme))}
    </main>
  );
}
