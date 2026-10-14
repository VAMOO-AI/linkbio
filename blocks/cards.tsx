import Image from "next/image";
import type { ChaveDe } from "@/config/opcoes";
import type { Offer } from "@/config/schema";
import { alvoOfertaMais, alvoOfertaUrl, alvoOfertaWa, hrefDoClique } from "@/lib/cliques";
import { linkWhatsApp } from "@/lib/whatsapp";

function formataPreco(priceCents?: number): string | null {
  if (priceCents === undefined) return null;
  if (priceCents === 0) return "Grátis";
  return (priceCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Capa({ cover }: { cover: NonNullable<Offer["cover"]> }) {
  return (
    <div className="card-capa" data-tone={cover.tone ?? "escuro"}>
      {cover.image && <Image src={cover.image} alt="" fill sizes="(max-width: 560px) 80vw, 440px" />}
      {cover.tag && <span className="card-capa-tag">{cover.tag}</span>}
      {cover.headline && (
        <span className="card-capa-titulo" aria-hidden="true">
          {cover.headline}
        </span>
      )}
    </div>
  );
}

type Props = { eyebrow?: string; items: string[]; layout: ChaveDe<"cardsLayout">; offers: Offer[]; whatsapp: string; chave?: string | null };

export function CardsBlock({ eyebrow, items, layout, offers, whatsapp, chave = null }: Props) {
  const ofertas = items
    .map((id) => offers.find((o) => o.id === id))
    .filter((o): o is Offer => o !== undefined);
  // Sem oferta (a última foi apagada, por exemplo), o bloco some em vez de deixar um título solto.
  if (ofertas.length === 0) return null;

  return (
    <section className="bloco-cards" data-layout={layout} aria-label={eyebrow ?? "Ofertas"}>
      {eyebrow && (
        <div className="cards-topo">
          <p className="cards-eyebrow">{eyebrow}</p>
          {layout === "carrossel" && ofertas.length > 1 && (
            <span className="cards-dica" aria-hidden="true">
              arraste →
            </span>
          )}
        </div>
      )}
      <div className="cards-lista">
        {ofertas.map((oferta) => {
          const direto =
            oferta.url ?? linkWhatsApp(whatsapp, oferta.wa ?? `Oi! Quero saber mais sobre ${oferta.title}.`);
          const destino = hrefDoClique(chave ? (oferta.url ? alvoOfertaUrl(oferta.id) : alvoOfertaWa(oferta.id)) : null, direto);
          const mais = oferta.more_url ? hrefDoClique(chave ? alvoOfertaMais(oferta.id) : null, oferta.more_url) : undefined;
          const preco = formataPreco(oferta.price_cents);
          return (
            <article key={oferta.id} className="card-oferta">
              {oferta.cover && <Capa cover={oferta.cover} />}
              <div className="card-corpo">
                <h2>{oferta.title}</h2>
                <p className="card-porque">{oferta.why}</p>
                {preco && <p className="card-preco">{preco}</p>}
                <div className="card-acoes">
                  <a href={destino} target="_blank" rel="noopener" className="card-acao">
                    {oferta.cta ?? "Quero essa"}
                  </a>
                  {mais && (
                    <a href={mais} target="_blank" rel="noopener" className="card-mais">
                      {oferta.more_label ?? "Saiba mais"}
                    </a>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
