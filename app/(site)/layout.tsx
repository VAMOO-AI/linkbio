import type { Metadata } from "next";
import { themeParaCss } from "@/lib/theme";
import { obterConfig, obterTema } from "@/lib/config-fonte";
import { modoFixo } from "@/lib/resolver";
import { variaveisDeFonte } from "@/lib/fontes";
import { BLOCOS_SENSIVEIS_IN_APP } from "@/lib/inapp";
import { blocosAtivos } from "@/lib/blocos";
import { dadosDeCompartilhar, enderecoBase } from "@/lib/compartilhar";
import { scriptDeCookies } from "@/lib/aviso-cookies";
import { idsEfetivos } from "@/lib/pixel";
import { cssDasFontes, hrefsParaPreload } from "@/lib/preloads-fonte";
import { dadosEstruturados } from "@/lib/seo";
import { BannerInApp } from "./banner-in-app";
import "../instance.css";
import "../globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const config = await obterConfig();
  // site.url ainda do exemplo: o domínio da Vercel no lugar (lib/compartilhar.ts, enderecoBase).
  const base = enderecoBase(config.site.url, process.env);
  const c = dadosDeCompartilhar(config, base);
  return {
    title: `${config.profile.name} ${config.profile.handle}`,
    description: config.profile.bio,
    metadataBase: base,
    icons: { icon: "/favicon.svg" },
    openGraph: {
      title: c.titulo,
      description: c.descricao,
      url: c.url,
      siteName: c.nomeDoSite,
      locale: config.site.locale.replace("-", "_"),
      type: "profile",
      images: [c.imagem],
    },
    twitter: { card: "summary_large_image", title: c.titulo, description: c.descricao, images: [c.imagem] },
  };
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const config = await obterConfig();
  const tema = await obterTema();
  const temBlocoSensivel = blocosAtivos(config.blocks, new Date(), config.site.tz).some((b) => BLOCOS_SENSIVEIS_IN_APP.has(b.type));
  const base = enderecoBase(config.site.url, process.env);
  const jsonLd = dadosEstruturados(config, base);
  const preloads = hrefsParaPreload(tema.font, cssDasFontes());
  const pixels = idsEfetivos(config.features.pixel, process.env);
  // Sem ID, isto é null: o HTML não ganha script nem o texto do aviso.
  const scriptCookies = scriptDeCookies(pixels.meta, pixels.ga4);

  return (
    <html
      lang={config.site.locale}
      className={variaveisDeFonte}
      data-theme={modoFixo(tema) ?? undefined}
      data-fundo={tema.background}
      data-botoes={tema.buttons}
      data-rotulos={tema.rotulos}
      data-fundo-imagem={tema.fundoImagem ? "" : undefined}
    >
      <head>
        {preloads.map((href) => (
          <link key={href} rel="preload" href={href} as="font" type="font/woff2" crossOrigin="anonymous" />
        ))}
        <style dangerouslySetInnerHTML={{ __html: themeParaCss(tema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </head>
      <body>
        {temBlocoSensivel && <BannerInApp />}
        <main className="pagina">{children}</main>
        {scriptCookies && <script dangerouslySetInnerHTML={{ __html: scriptCookies }} />}
      </body>
    </html>
  );
}
