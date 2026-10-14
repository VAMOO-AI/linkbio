import { enderecoBase, type AmbienteVercel } from "./compartilhar";

export type PerfilEstruturado = {
  name: string;
  bio: string;
  avatar: string;
  tipo?: "pessoa" | "empresa";
  socials?: { url: string }[];
};

export type JsonLd = {
  "@context": "https://schema.org";
  "@type": "Person" | "Organization";
  name: string;
  description: string;
  url: string;
  image?: string;
  logo?: string;
  sameAs?: string[];
};

function urlDaImagem(base: URL, avatar: string): string {
  return avatar.startsWith("/") ? `${base.origin}${avatar}` : avatar;
}

/** Person ou Organization (empresa, com logo). sameAs sai das redes do perfil. */
export function dadosEstruturados(config: { profile: PerfilEstruturado; site: { url: string } }, base: URL): JsonLd {
  const redes = (config.profile.socials ?? []).map((r) => r.url).filter(Boolean);
  const imagem = urlDaImagem(base, config.profile.avatar);
  const comum = {
    "@context": "https://schema.org" as const,
    name: config.profile.name,
    description: config.profile.bio,
    url: base.origin,
    ...(redes.length ? { sameAs: redes } : {}),
  };
  if (config.profile.tipo === "empresa") {
    return { ...comum, "@type": "Organization", logo: imagem };
  }
  return { ...comum, "@type": "Person", image: imagem };
}

export function mapaDoSite(siteUrl: string, env: AmbienteVercel = {}): { url: string }[] {
  return [{ url: enderecoBase(siteUrl, env).origin }];
}

export function regrasDeRobos(siteUrl: string, env: AmbienteVercel = {}) {
  const base = enderecoBase(siteUrl, env);
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/admin-previa", "/e2e"],
    },
    sitemap: new URL("/sitemap.xml", base).href,
  };
}
