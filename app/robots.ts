import type { MetadataRoute } from "next";
import { obterConfig } from "@/lib/config-fonte";
import { regrasDeRobos } from "@/lib/seo";

/** Mesmo prazo da página e do sitemap (ver app/sitemap.ts). Precisa ser um literal. */
export const revalidate = 3600;

export default async function robots(): Promise<MetadataRoute.Robots> {
  const config = await obterConfig();
  return regrasDeRobos(config.site.url, process.env);
}
