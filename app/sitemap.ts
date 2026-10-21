import type { MetadataRoute } from "next";
import { obterConfig } from "@/lib/config-fonte";
import { mapaDoSite } from "@/lib/seo";

/**
 * Mesmo prazo da página (app/(site)/page.tsx): a config vem da mesma tag que o /admin revalida ao
 * publicar. Sem este número a rota saía do build com cache de 1 ano e, na Vercel, o Publicar não a
 * alcançava: `site.url` novo só aparecia depois de um redeploy. Precisa ser um literal.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const config = await obterConfig();
  return mapaDoSite(config.site.url, process.env);
}
