import type { ChaveDe } from "@/config/opcoes";
import { alvoItemLinks, hrefDoClique } from "@/lib/cliques";
import { IconeSocial } from "./social";

type Icone = "instagram" | "tiktok" | "youtube" | "whatsapp" | "linkedin" | "facebook" | "x" | "site";
type Item = { title: string; url: string; subtitle?: string; icon?: Icone };

type Props = { title?: string; layout: ChaveDe<"linksLayout">; items: Item[]; chave?: string | null };

/** Grupo de links: lista numa caixa, botões empilhados ou grade de ícones. */
export function LinksBlock({ title, layout, items, chave = null }: Props) {
  return (
    <section className="bloco-links" data-layout={layout} aria-label={title ?? "Links"}>
      {title && <p className="links-titulo">{title}</p>}
      <ul className="links-lista">
        {items.map((item, i) => (
          <li key={item.url}>
            <a href={hrefDoClique(chave ? alvoItemLinks(chave, i) : null, item.url)} target="_blank" rel="noopener">
              <span className="links-icone" aria-hidden="true">
                <IconeSocial icone={item.icon ?? "site"} />
              </span>
              <span className="links-texto">
                <span className="links-nome">{item.title}</span>
                {item.subtitle && layout !== "icones" && <span className="links-sub">{item.subtitle}</span>}
              </span>
              {layout === "lista" && (
                <span className="links-seta" aria-hidden="true">
                  ›
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
