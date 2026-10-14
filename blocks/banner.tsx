import { alvoBanner, hrefDoClique } from "@/lib/cliques";
import { linkWhatsApp } from "@/lib/whatsapp";

type Acao = { wa: string } | { url: string };

export function BannerBlock({
  title,
  text,
  label,
  action,
  whatsapp,
  chave = null,
}: {
  title: string;
  text?: string;
  label?: string;
  action?: Acao;
  whatsapp: string;
  chave?: string | null;
}) {
  const direto = action ? ("wa" in action ? linkWhatsApp(whatsapp, action.wa) : action.url) : undefined;
  const href = direto ? hrefDoClique(chave ? alvoBanner(chave) : null, direto) : undefined;
  return (
    <aside className="bloco-banner" aria-label={title}>
      <div className="banner-texto">
        <p className="banner-titulo">{title}</p>
        {text && <p className="banner-sub">{text}</p>}
      </div>
      {href && label && (
        <a className="banner-acao" href={href} target="_blank" rel="noopener">
          {label}
        </a>
      )}
    </aside>
  );
}
