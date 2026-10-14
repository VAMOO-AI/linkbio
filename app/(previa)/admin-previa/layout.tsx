import type { Metadata } from "next";
import { themeParaCss } from "@/lib/theme";
import { resolverTema, modoExibido } from "@/lib/resolver";
import { variaveisDeFonte } from "@/lib/fontes";
import { cssDasFontes, hrefsParaPreload } from "@/lib/preloads-fonte";
import { exigirSessao } from "@/lib/admin/sessao";
import { lerConfigDaPrevia } from "@/lib/admin/dados";
import "../../instance.css";
import "../../globals.css";
import "./previa.css";

export const metadata: Metadata = { title: "Prévia da bio", robots: { index: false, follow: false } };

/**
 * Prévia ao vivo do /admin: a bio montada com o rascunho de quem está logado (ou a versão publicada).
 * O script do <head> aplica ?tema=claro|escuro antes de pintar; o do fim guarda a rolagem e segura os
 * links internos (a prévia não sai dela); link para fora (WhatsApp, oferta, botão final do concierge)
 * abre em aba nova, para quem testa a bio na prévia ver o destino funcionando. Quem assume o conteúdo depois disso é o ao-vivo.tsx, que o editor alimenta por postMessage.
 */
const SCRIPT_TEMA = `(function(){var t=new URLSearchParams(location.search).get('tema');if(t)document.documentElement.setAttribute('data-theme',t==='escuro'?'dark':'light');})();`;
const SCRIPT_PAGINA = `(function(){var k='linkbio-previa-y';try{var y=sessionStorage.getItem(k);if(y)window.scrollTo(0,+y);}catch(e){}
addEventListener('scroll',function(){try{sessionStorage.setItem(k,String(scrollY));}catch(e){}},{passive:true});
document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href]');if(!a)return;e.preventDefault();if(a.origin!==location.origin&&/^(https?|mailto|tel):/.test(a.href))window.open(a.href,'_blank','noopener');},true);})();`;

export default async function PreviaLayout({ children }: { children: React.ReactNode }) {
  const email = await exigirSessao();
  const config = await lerConfigDaPrevia(email);
  const tema = resolverTema(config.theme);
  const preloads = hrefsParaPreload(tema.font, cssDasFontes());
  return (
    <html
      lang={config.site.locale}
      className={`${variaveisDeFonte} previa`}
      data-theme={modoExibido(tema) ?? undefined}
      data-fundo={tema.background}
      data-botoes={tema.buttons}
      data-rotulos={tema.rotulos}
      data-fundo-imagem={tema.fundoImagem ? "" : undefined}
    >
      <head>
        {preloads.map((href) => (
          <link key={href} rel="preload" href={href} as="font" type="font/woff2" crossOrigin="anonymous" />
        ))}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
        <style id="lb-tema" dangerouslySetInnerHTML={{ __html: themeParaCss(tema) }} />
      </head>
      <body>
        <main className="pagina">{children}</main>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_PAGINA }} />
      </body>
    </html>
  );
}
