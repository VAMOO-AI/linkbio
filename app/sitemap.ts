import type { MetadataRoute } from "next";
import { obterConfig } from "@/lib/config-fonte";
import { mapaDoSite } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const config = await obterConfig();
  return mapaDoSite(config.site.url, process.env);
}
