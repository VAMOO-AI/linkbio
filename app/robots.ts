import type { MetadataRoute } from "next";
import { obterConfig } from "@/lib/config-fonte";
import { regrasDeRobos } from "@/lib/seo";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const config = await obterConfig();
  return regrasDeRobos(config.site.url, process.env);
}
